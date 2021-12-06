import {
  WebGLScene,
  getShader,
  readB64,
  setKeys,
} from './utils';

import {
    MeshFunctionObject,
    WireframeObject,
    ClippingFunctionObject,
} from './mesh';

import { ThickEdgesObject } from './edges';
import { ColormapObject } from './colormap';
import { CameraControls } from './camera';

import { Grid3D, Label3D }  from './grid';
import { GUI }  from './gui';

import * as THREE from 'three';
// import Stats from "https://cdnjs.cloudflare.com/ajax/libs/stats.js/r16/Stats.min";
import * as dat from 'dat.gui';

const css = require('./styles.css');

export {THREE};

export class Scene extends WebGLScene {

  labels: any;
  tooltip: any;

  render_data: any;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ortho_camera: THREE.OrthographicCamera;
  clipping_plane: THREE.Vector4;
  three_clipping_plane: THREE.Plane;
  world_clipping_plane: THREE.Plane;
  light_dir: THREE.Vector3;
  stats: any;
  event_handlers: any;

  gui: any;
  gui_status_default: any;
  gui_status: any;
  gui_functions: any;
  gui_container: any;
  uniforms: any;

  colormap_object: any;
  edges_object: any;
  wireframe_object: THREE.Line;
  mesh_object: any;
  clipping_function_object: THREE.Mesh;
  clipping_vectors_object: THREE.Mesh;
  axes_object: any;
  center_tag: any;
  grid: any;

  is_complex: boolean;
  trafo: any;
  mouse: THREE.Vector2;
  get_pixel: boolean;

  last_frame_time: number;

  multidim_controller: any;

  phase_controller: any;

  buffer_scene: THREE.Scene;
  buffer_object: THREE.Mesh;
  buffer_camera: THREE.OrthographicCamera;
  buffer_texture: any;

  mesh_center: THREE.Vector3;
  mesh_radius: number;

  pivot: THREE.Group;

  have_deformation: boolean;
  have_z_deformation: boolean;

  controls: any;

  funcdim: number;
  mesh_only: boolean;

  version_object: any;
  get_face_index: boolean;
  index_render_target: any;

  constructor() {
    super();
    this.have_webgl2 = false;

    this.event_handlers = {};
  }

  on( event_name, handler ) {
    if(this.event_handlers[event_name] == undefined)
      this.event_handlers[event_name] = [];

    this.event_handlers[event_name].push( handler );
  }

  handleEvent( event_name, args )
  {
    let handlers = this.event_handlers[event_name];
    if(handlers == undefined)
      return;

    for(var i=0; i<handlers.length; i++)
      handlers[i].apply(null, args);
  }

  getGuiSettings() {
      const settings = JSON.parse(JSON.stringify(this.gui_status)); // deep-copy settings
      this.controls.storeSettings( settings );
      return JSON.parse(JSON.stringify(settings));
  }

  setGuiSettings (settings) {
    setKeys(this.gui_status, settings);

    if(settings.camera)
        this.controls.loadSettings( settings.camera );

    // stats.showPanel(parseInt(this.gui_status.Misc.stats));
    for (var i in this.gui.__controllers)
      this.gui.__controllers[i].updateDisplay();
    for (var f in this.gui.__folders) {
      const folder = this.gui.__folders[f];
      for (var i in folder.__controllers)
        folder.__controllers[i].updateDisplay();
    }
    this.animate();
  }

  onResize() {
    const w = this.element.parentNode.clientWidth;
    const h = this.element.parentNode.clientHeight;

    const aspect = w/h;
    this.ortho_camera = new THREE.OrthographicCamera( -aspect, aspect, 1.0, -1.0, -100, 100 );
    if(this.colormap_object)
        this.colormap_object.onResize(w,h);
      this.camera.aspect = aspect;
      this.uniforms.aspect.value = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize( w, h );
      this.controls.update();
      this.animate();


      // this.index_render_target = 
      //   const pixels = new Float32Array(4);
      //   const render_target = new THREE.WebGLRenderTarget( 1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType, format: THREE.RGBAFormat });
  }

  updateClippingPlaneCamera()
  {
    const n = this.gui_status.Vectors.grid_size;
    var plane_center = new THREE.Vector3();
    this.three_clipping_plane.projectPoint(this.mesh_center, plane_center);
    var plane0 = this.three_clipping_plane.clone();
    plane0.constant = 0.0;
    const normal = this.three_clipping_plane.normal;


    var t2 = new THREE.Vector3();
    if(Math.abs(normal.z)<0.5)
      plane0.projectPoint(new THREE.Vector3(0,0,1), t2);
    else if(Math.abs(normal.y)<0.5)
      plane0.projectPoint(new THREE.Vector3(0,1,0), t2);
    else
      plane0.projectPoint(new THREE.Vector3(1,0,0), t2);

    var t1 = new THREE.Vector3().crossVectors(t2, plane0.normal);
    t1.setLength(2*this.mesh_radius/n);
    t2.setLength(2*this.mesh_radius/n);

    var position = plane_center.clone();
    position.addScaledVector(plane0.normal, 1);
    var target = plane_center.clone();
    target.addScaledVector(plane0.normal, -1);

    this.buffer_camera.position.copy(position);
    this.buffer_camera.up = t2;
    this.buffer_camera.lookAt(target);
    this.buffer_camera.updateProjectionMatrix();
    this.buffer_camera.updateMatrix();

    this.uniforms.clipping_plane_c.value = plane_center;
    this.uniforms.clipping_plane_t1.value = t1;
    this.uniforms.clipping_plane_t2.value = t2;
    this.uniforms.grid_size.value = n;
  }

  updateGridsize()
  {
    const n = this.gui_status.Vectors.grid_size;
    this.buffer_texture = new THREE.WebGLRenderTarget( n, n, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    this.uniforms.tex_values = new THREE.Uniform(this.buffer_texture.texture);
    let r = this.mesh_radius;
    this.buffer_camera = new THREE.OrthographicCamera( -r, r, r, -r, -10, 10 );

    const geo = <THREE.InstancedBufferGeometry>this.clipping_vectors_object.geometry;
    var arrowid = new Float32Array(2*n * n);
    for(var i=0; i<n; i++)
    for(var j=0; j<n; j++) {
      arrowid[2*(i*n + j)+0] = 1.0*(j+0.5)/n;
      arrowid[2*(i*n + j)+1] = 1.0*(i+0.5)/n;
    }
    geo.instanceCount = n*n;
    geo._maxInstanceCount = n*n;
    geo.setAttribute( 'arrowid', new THREE.InstancedBufferAttribute( arrowid, 2 ) );
    this.animate();
  }

  initCanvas (element, webgl_args)
  {
    WebGLScene.prototype.initCanvas.call(this, element, webgl_args);
    // label with NGSolve version at right lower corner
    this.version_object = document.createElement("div");
    var style = 'bottom: 10px; right: 10px';
    // this.version_object.setAttribute("style",this.label_style+style); TODO
    this.container.appendChild(this.version_object);

    window.addEventListener( 'resize', ()=>this.onResize(), false );
  }

  initRenderData (render_data)
  {
    if(this.gui!=null)
        this.gui.destroy();

    this.uniforms = {};
    let uniforms = this.uniforms;
    uniforms.colormap_min = new THREE.Uniform( 0.0 );
    uniforms.colormap_max = new THREE.Uniform( 1.0 );
    uniforms.function_mode = new THREE.Uniform( 0 );

    this.colormap_object = null;
    this.edges_object = null;
    this.wireframe_object = null;
    this.mesh_object = null;
    this.clipping_function_object = null;
    this.clipping_vectors_object = null;
    this.axes_object = null;
    this.buffer_scene = null;
    this.buffer_object = null;
    this.buffer_camera = null;
    this.buffer_texture = null;

    this.last_frame_time = new Date().getTime();
    this.render_data = render_data;
    this.funcdim = render_data.funcdim;
    this.is_complex = render_data.is_complex;
    console.log("THREE", THREE);
    // console.log("Stats", Stats);


    this.have_deformation = render_data.mesh_dim == render_data.funcdim && !render_data.is_complex;
    this.have_z_deformation = render_data.mesh_dim == 2 && render_data.funcdim>0;
    this.mesh_only = render_data.funcdim==0;

    this.mesh_center = new THREE.Vector3().fromArray(render_data.mesh_center);
    this.mesh_radius = render_data.mesh_radius;

    var version_text = document.createTextNode("NGSolve " + render_data.ngsolve_version);
    this.version_object.innerHTML = '';
    this.version_object.appendChild(version_text)

    this.scene = new THREE.Scene();
    // if(window.matchMedia('(prefers-color-scheme: dark)').matches)
    //   this.scene.background = new THREE.Color(0x292c2e);
    this.axes_object = new THREE.AxesHelper(0.15);
    this.axes_object.matrixAutoUpdate = false;
    this.labels = [];
    const s = 0.20;
    this.labels.push( Label3D( this.container, new THREE.Vector3(s,0,0), "X" ) );
    this.labels.push( Label3D( this.container, new THREE.Vector3(0,s,0), "Y" ) );
    this.labels.push( Label3D( this.container, new THREE.Vector3(0,0,s), "Z" ) );

    this.tooltip = document.createElement("div");
    var el_text = document.createTextNode("tooltip");
    this.tooltip.appendChild(el_text)

    this.container.appendChild(this.tooltip);

    this.tooltip.classList.add('tooltiptext');
    this.tooltip.style.top = '10px';
    this.tooltip.style.left = '10px';
    this.tooltip.style.visibility = 'hidden';

    this.pivot = new THREE.Group();
    this.pivot.matrixAutoUpdate = false;

    this.buffer_scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      40,                                         //FOV
      this.element.offsetWidth/ this.element.offsetHeight, // aspect
      1,                                          //near clipping plane
      100                                         //far clipping plane
    );

    this.camera.position.set( 0.0, 0.0, 3 );

    this.clipping_plane = new THREE.Vector4(0,0,1,0);
    uniforms.aspect = new THREE.Uniform( this.camera.aspect ); 
    uniforms.line_thickness = new THREE.Uniform( 0.001 ); 
    uniforms.clipping_plane = new THREE.Uniform( this.clipping_plane ); 
    uniforms.highlight_selected_face = new THREE.Uniform( false );
    uniforms.selected_face = new THREE.Uniform( -1 );
    // should cliping plane in pivot world be calculated in shader insted of passing it? 
    //currently not done because it is needed here anyways

    this.three_clipping_plane  = new THREE.Plane( );

    var light_dir = new THREE.Vector3(0.5,0.5,1.5);
    light_dir.normalize();
    uniforms.light_dir = new THREE.Uniform(light_dir);
    var light_mat = new THREE.Vector4(0.3, 0.7, 10, 0.3); // ambient, diffuse, shininess, specularity
    uniforms.light_mat = new THREE.Uniform(light_mat);

    uniforms.do_clipping = new THREE.Uniform( false );
    uniforms.render_depth = new THREE.Uniform( false );
    this.trafo = new THREE.Vector2(1.0/2.0/(this.mesh_center.length()+this.mesh_radius), 1.0/2.0);
    uniforms.trafo = new THREE.Uniform(this.trafo);

    this.get_pixel = false;
    this.mouse = new THREE.Vector2(0.0, 0.0);
    this.center_tag = null;

    let animate = ()=>this.animate();
    let gui = new GUI(this.container, render_data, animate);
    this.gui = gui;
    this.gui_status = gui.gui_status;
    let gui_status = this.gui_status;
    this.gui_status_default = gui.gui_status_default;

    console.log("GUI", gui);
    console.log("gui_status", gui_status);

    // var planeGeom = new THREE.PlaneBufferGeometry(10, 5, 10, 5);
    // console.log("planegeom", planeGeom);
    // var gridPlane = new THREE.LineSegments(planeGeom, new THREE.LineBasicMaterial({color: "black"}));
    // console.log("gridplane", gridPlane);

    // const grid = new THREE.GridHelper( 400, 40, 0x0000ff, 0x808080 );

    if(this.colormap_object == null) {
        this.colormap_object = new ColormapObject(this.render_data, this.uniforms, this.container, this.gui_status);

        this.colormap_object.updateTexture(gui_status);
    }

    uniforms.n_segments = new THREE.Uniform(5);
    if(render_data.edges.length)
    {
      this.edges_object = new ThickEdgesObject(render_data, uniforms);
      this.pivot.add(this.edges_object);
      gui.add(gui_status, "line_thickness", 1,20,1).onChange(animate);
      gui.add(gui_status, "edges").onChange(animate);
    }

    if(render_data.show_wireframe && render_data.Bezier_points.length>0)
    {
      this.wireframe_object = new WireframeObject(render_data, uniforms);
      this.pivot.add(this.wireframe_object);
      gui.add(gui_status, "subdivision", 1,20,1).onChange(animate);
      gui.add(gui_status, "mesh").onChange(animate);
    }

    if(this.have_z_deformation || this.have_deformation)
    {
      this.gui_status_default.deformation = render_data.deformation ? 1.0 : 0.0;
      gui_status.deformation = this.gui_status_default.deformation;
      gui.add(gui_status, "deformation", 0.0, 1.0, 0.0001).onChange(animate);
      uniforms.deformation = new THREE.Uniform( gui_status.deformation );
    }

    if(render_data.is_complex)
    {
      this.gui_status_default.eval = 5;
      gui_status.eval = 5;
      this.gui.c_eval = gui.add(gui_status, "eval", {"real": 5,"imag":6,"norm":3}).onChange(animate);

      let cgui = gui.addFolder("Complex");
      this.phase_controller = cgui.add(gui_status.Complex, "phase", 0, 2*Math.PI, 0.001).onChange(animate);
      cgui.add(gui_status.Complex, "animate").onChange(()=> {this.last_frame_time = new Date().getTime(); this.animate() });
      cgui.add(gui_status.Complex, "speed", 0.0, 10, 0.0001).onChange(animate);
      uniforms.complex_scale = new THREE.Uniform( new THREE.Vector2(1, 0) );
    }
    else if(render_data.funcdim==2)
    {
        gui_status.eval = 3;
        this.gui.c_eval = gui.add(gui_status, "eval", {"0": 0,"1":1,"norm":3}).onChange(animate);
    }
    else if(render_data.funcdim==3)
    {
        gui_status.eval = 3;
        this.gui.c_eval = gui.add(gui_status, "eval", {"0": 0,"1":1,"2":2,"norm":3}).onChange(animate);
    }

    if(this.gui.c_eval)
    {
      if(render_data.eval != undefined)
      {
        this.gui_status_default.eval = render_data.eval;
        this.gui.c_eval.setValue(render_data.eval);
      }
      this.gui.c_eval.onChange(()=> {
        if(gui_status.autoscale)
          this.gui.updateColormapToAutoscale();
      });
    }


    if(render_data.mesh_dim == 3)
    {
      let gui_clipping = gui.addFolder("Clipping");
      if(render_data.draw_vol)
      {
        if(render_data.clipping_function != undefined)
          {
              this.gui_status_default.Clipping.function = render_data.clipping_function;
              gui_status.Clipping.function = render_data.clipping_function;
          }

        this.clipping_function_object = new ClippingFunctionObject(render_data, uniforms);
        this.pivot.add(this.clipping_function_object);
        gui_clipping.add(gui_status.Clipping, "function").onChange(animate);
      }

      if(render_data.clipping)
        {
            this.gui_status_default.Clipping.enable = true;
            gui_status.Clipping.enable = true;
            if(render_data.clipping_x != undefined)
            {
                this.gui_status_default.Clipping.x = render_data.clipping_x;
                gui_status.Clipping.x = render_data.clipping_x;
            }
            if(render_data.clipping_y != undefined)
            {
                this.gui_status_default.Clipping.y = render_data.clipping_y;
                gui_status.Clipping.y = render_data.clipping_y;
            }
            if(render_data.clipping_z != undefined)
            {
                this.gui_status_default.Clipping.z = render_data.clipping_z;
                gui_status.Clipping.z = render_data.clipping_z;
            }
            if(render_data.clipping_dist != undefined)
            {
                this.gui_status_default.Clipping.dist = render_data.clipping_dist;
                gui_status.Clipping.dist = render_data.clipping_dist;
            }
        }
        else
            console.log("render data not clipping found!!!");

      gui_clipping.add(gui_status.Clipping, "enable").onChange(animate);
      gui_clipping.add(gui_status.Clipping, "x", -1.0, 1.0).onChange(animate);
      gui_clipping.add(gui_status.Clipping, "y", -1.0, 1.0).onChange(animate);
      gui_clipping.add(gui_status.Clipping, "z", -1.0, 1.0).onChange(animate);
      gui_clipping.add(gui_status.Clipping, "dist", -1.2*this.mesh_radius, 1.2*this.mesh_radius).onChange(animate);
    }

    if(render_data.show_mesh)
    {
      this.mesh_object = new MeshFunctionObject(render_data, uniforms);
      this.pivot.add( this.mesh_object );
      gui.add(gui_status, "elements").onChange(animate);
    }


    let draw_vectors = render_data.funcdim>1 && !render_data.is_complex;
    draw_vectors = draw_vectors && (render_data.draw_surf && render_data.mesh_dim==2 || render_data.draw_vol && render_data.mesh_dim==3);
    if(draw_vectors)
    {
      if(render_data.vectors)
        {
            this.gui_status_default.Vectors.show = true;
            gui_status.Vectors.show = true;
            if(render_data.vectors_grid_size)
            {
                this.gui_status_default.Vectors.grid_size = render_data.vectors_grid_size;
                gui_status.Vectors.grid_size = render_data.vectors_grid_size;
            }
            if(render_data.vectors_offset)
            {
                this.gui_status_default.Vectors.offset = render_data.vectors_offset;
                gui_status.Vectors.offset = render_data.vectors_offset;
            }
        }

      let gui_vec = gui.addFolder("Vectors");
      gui_vec.add(gui_status.Vectors, "show").onChange(animate);
      gui_vec.add(gui_status.Vectors, "grid_size", 1, 100, 1).onChange(()=>this.updateGridsize());
      gui_vec.add(gui_status.Vectors, "offset", -1.0, 1.0, 0.001).onChange(animate);


      if(render_data.mesh_dim==2)
        this.buffer_object = this.mesh_object.clone();
      else
        this.buffer_object = this.clipping_function_object.clone();

      this.buffer_scene.add(this.buffer_object);

      uniforms.clipping_plane_c = new THREE.Uniform( new THREE.Vector3() );
      uniforms.clipping_plane_t1 = new THREE.Uniform( new THREE.Vector3() );
      uniforms.clipping_plane_t2 = new THREE.Uniform( new THREE.Vector3() );
      uniforms.vectors_offset = new THREE.Uniform( gui_status.Vectors.offset );
      uniforms.grid_size = new THREE.Uniform( gui_status.Vectors.grid_size );

      this.clipping_vectors_object = this.createClippingVectors(render_data);
      this.pivot.add(this.clipping_vectors_object);
      this.updateGridsize();
    }

    if(this.mesh_only)
    {
        this.gui_status_default.colormap_min = -0.5;
        this.gui_status_default.colormap_max = render_data.mesh_regions_2d-0.5;
        gui_status.colormap_min = -0.5;
        gui_status.colormap_max = render_data.mesh_regions_2d-0.5;
        // this.setSelectedFaces();
    }
    uniforms.colormap_min.value = gui_status.colormap_min;
    uniforms.colormap_max.value = gui_status.colormap_max;

    if(render_data.multidim_data)
    {
      const md = render_data.multidim_data.length;

      if(render_data.multidim_interpolate)
      {
        if(render_data.multidim_animate)
        {
          this.gui_status_default.Multidim.animate = true;
          gui_status.Multidim.animate = true;
        }

        let gui_md = gui.addFolder("Multidim");
        this.multidim_controller = gui_md.add(gui_status.Multidim, "t", 0, md, 0.01).onChange( () => 
          {
            let s = gui_status.Multidim.t;
            const n = Math.floor(s);
            const t = s - n;
            if(n==0)
              this.interpolateRenderData(this.render_data,this.render_data.multidim_data[0], t);
            else if(s==md)
              this.setRenderData(this.render_data.multidim_data[md-1]);
            else
              this.interpolateRenderData(this.render_data.multidim_data[n-1],this.render_data.multidim_data[n], t);

          });
        gui_md.add(gui_status.Multidim, "animate").onChange(()=> {this.last_frame_time = new Date().getTime(); this.animate() });
        gui_md.add(gui_status.Multidim, "speed", 0.0, 10, 0.001).onChange(animate);
      }
      else
      {
        gui.add(gui_status.Multidim, "multidim", 0, md, 1).onChange( () => 
          {
            const n = gui_status.Multidim.multidim;
            if(n==0)
              this.setRenderData(this.render_data);
            else
              this.setRenderData(this.render_data.multidim_data[n-1]);
          });
      }
    }

    let gui_light = gui.addFolder("Light");
    gui_light.add(gui_status.Light, "ambient", 0.0, 1.0).onChange(animate);
    gui_light.add(gui_status.Light, "diffuse", 0.0, 1.0).onChange(animate);
    gui_light.add(gui_status.Light, "shininess", 0.0, 100.0).onChange(animate);
    gui_light.add(gui_status.Light, "specularity", 0.0, 1.0).onChange(animate);

    let gui_misc = gui.addFolder("Misc");
    //   gui_misc.add(gui_status.Misc, "stats", {"none":-1, "FPS":0, "ms":1, "memory":2}).onChange(function(show_fps) {
    //       stats.showPanel( parseInt(show_fps) );
    //   });
    let gui_functions = this.gui.gui_functions;
    gui_functions['reset settings'] = () =>{
      this.setGuiSettings(this.gui_status_default);
    };
    gui_functions['store settings'] = () => {
      document.cookie = "gui_status="+btoa(JSON.stringify(gui_status));
    };
    gui_functions['load settings'] = () =>{
      var name = "gui_status="
      var decodedCookie = decodeURIComponent(document.cookie);
      var ca = decodedCookie.split(';');
      for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          const s = JSON.parse(atob(c.substring(name.length, c.length)));
          this.setGuiSettings(s);
        }
      }
    };
    gui_misc.add(gui_functions, "reset settings");
    gui_misc.add(gui_functions, "store settings");
    gui_misc.add(gui_functions, "load settings");

    gui_misc.add(gui_status.Misc, "reduce_subdivision");

    if(this.colormap_object)
      gui_misc.add(gui_status.Misc, "colormap").onChange(animate);

    gui_misc.add(gui_status.Misc, "axes").onChange(animate);
    gui_misc.add(gui_status.Misc, "version").onChange(value => {
      this.version_object.style.visibility = value ? "visible" : "hidden";
    });

    gui_functions['fullscreen'] = () =>{
      let elem = this.element.parentNode;

      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if(elem.webkitRequestFullScreen) {
        // Webkit (works in Safari and Chrome Canary)
        elem.webkitRequestFullScreen();
      }else if(elem.mozRequestFullScreen) {
        // Firefox
        elem.mozRequestFullScreen();
      }
    };
    gui.add(gui_functions, "fullscreen");

    gui_functions['reset'] = ()=> {
      this.controls.reset();
    };
    gui.add(gui_functions, "reset").onChange(animate);

    gui_functions['update center'] = ()=> {
      this.controls.updateCenter();
    };
    gui.add(gui_functions, "update center").onChange(animate);

    this.scene.add( this.pivot );

    this.controls = new CameraControls(this.camera, this, this.renderer.domElement );
    this.controls.addEventListener('change', animate);

    this.updateRenderData(render_data);
    setTimeout(()=> this.onResize(), 0);
    console.log("Scene init done", this);
    if(render_data.on_init) {
      var on_init = Function("scene", "render_data", render_data.on_init);
      on_init(this, render_data);
    }
    this.controls.update();
    this.animate();
  }

  init(element, render_data, webgl_args = {})
  {
    this.initCanvas(element, webgl_args);
    this.initRenderData(render_data);
  }


  createClippingVectors(data)
  {
    var material = new THREE.RawShaderMaterial({
      vertexShader: getShader( 'vector_function.vert' ),
      fragmentShader: getShader( 'function.frag', {NO_CLIPPING: 1, SIDE_LIGHTS: 1}, this.render_data.user_eval_function),
      side: THREE.DoubleSide,
      uniforms: this.uniforms
    });


    const geo = new THREE.InstancedBufferGeometry();
    const cone = new THREE.ConeGeometry(0.5, 1, 10)
    geo.setIndex( cone.getIndex() );
    geo.setAttribute( 'position', cone.getAttribute('position') );
    geo.setAttribute( 'normal', cone.getAttribute('normal') );
    geo.setAttribute( 'uv', cone.getAttribute('uv') );

    var mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  // called on scene.Redraw() from Python
  updateRenderData(render_data)
  {
    this.render_data = render_data;
    this.setRenderData(render_data);
    // this.grid = Grid3D(this.container, this.wireframe_object.geometry.boundingSphere);
    // this.pivot.add(this.grid);
    // this.grid.visible = this.gui_status.show_grid;
  }

  setRenderData(render_data)
  {
    if(this.edges_object != null)
        this.edges_object.updateRenderData(render_data);

    if(this.wireframe_object != null)
        this.wireframe_object.updateRenderData(render_data);

    if(this.mesh_object != null)
        this.mesh_object.updateRenderData(render_data);

    if(this.clipping_function_object != null)
        this.clipping_function_object.updateRenderData(render_data);

    if(render_data.draw_surf || render_data.draw_vol)
    {
      const cmin = render_data.funcmin;
      const cmax = render_data.funcmax;
      this.gui_status_default.colormap_min = cmin;
      this.gui_status_default.colormap_max = cmax;

      if(this.gui_status.autoscale)
      {
        if(this.gui_status.eval == 3) // norm of vector-valued function
        {
          this.gui_status.colormap_min = 0;
          this.gui_status.colormap_max = Math.max(Math.abs(cmin), Math.abs(cmax));
        }
        else
        {
          this.gui_status.colormap_min = cmin;
          this.gui_status.colormap_max = cmax;
        }
        this.gui.c_cmin.updateDisplay();
        this.gui.c_cmax.updateDisplay();

        this.colormap_object.update(this.gui_status);
      }

      if(cmax>cmin)
        this.gui.setStepSize(cmin, cmax);
    }

    this.animate();
  }

  interpolateRenderData(rd, rd2, t)
  {
    const t1 = 1.0-t;
    const mix = (a,b)=> t1*a + t*b;
    const mixB64 = (a,b)=> {
      let d1 = readB64(a);
      let d2 = readB64(b);

      for (let i=0; i<d1.length; i++)
        d1[i] = mix(d1[i],d2[i]);

      return d1;
    };

    if(this.edges_object != null)
        this.edges_object.updateRenderData( rd, rd2, t );

    if(this.wireframe_object != null)
        this.wireframe_object.updateRenderData( rd, rd2, t );

    if(this.mesh_object != null)
        this.mesh_object.updateRenderData(rd, rd2, t);

    if(this.clipping_function_object != null)
        this.clipping_function_object.updateRenderData(rd, rd2, t);


    if(rd.draw_surf || rd.draw_vol)
    {
      const cmin = mix(rd.funcmin, rd2.funcmin);
      const cmax = mix(rd.funcmax, rd2.funcmax);
      this.gui_status_default.colormap_min = cmin;
      this.gui_status_default.colormap_max = cmax;

      if(this.gui_status.autoscale)
      {
        this.gui_status.colormap_min = cmin;
        this.gui_status.colormap_max = cmax;
        this.gui.c_cmin.updateDisplay();
        this.gui.c_cmax.updateDisplay();
      }

      if(cmax>cmin)
        this.gui.setStepSize(cmin, cmax);
    }

    this.animate();
  }

  setCenterTag(position = null) {
    if (this.center_tag != null) {
      this.pivot.remove(this.center_tag);
      this.center_tag = null;
    }
    if (position != null) {
      const n = 101;
      const size = n * n;
      const data = new Uint8Array(4*n*n);

      for(var i=0; i<n; i++)
        for(var j=0; j<n; j++)
        {
          const dist = n*n/4-((i-n/2)*(i-n/2)+(j-n/2)*(j-n/2));
          if(dist>0.0)
          {
            for(var k=0; k<3; k++)
              data[4*(i*n+j)+k] = 128;
            data[4*(i*n+j)+3] = 255;
          }
          else
          {
            for(var k=0; k<3; k++)
              data[4*(i*n+j)+k] = 0;
          }
        }

      let texture = new THREE.DataTexture( data, n, n, THREE.RGBAFormat);

      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      // disable depthTest and set renderOrder to make the tag always visible
      let material = new THREE.SpriteMaterial( { map: texture, sizeAttenuation: false, color: 0xffffff, depthTest: false } );

      this.center_tag = new THREE.Sprite( material );
      const s = 0.01/this.controls.scale;

      this.center_tag.scale.set(s,s,s);
      this.center_tag.position.copy(position);
      this.center_tag.renderOrder = 1;
      this.pivot.add(this.center_tag);
    }
  }

  getIndexAtCursor() {
    let index = -1;
    if(this.mesh_only) {
        const pixels = new Float32Array(4);
        const render_target = new THREE.WebGLRenderTarget( 1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType, format: THREE.RGBAFormat });
        const h = this.renderer.domElement.height;
        var rect = this.canvas.getBoundingClientRect();
        const x = this.mouse.x;
        const y = this.mouse.y;

        // render face index to texture (for mouse selection)
        const function_mode = this.uniforms.function_mode.value;
        this.uniforms.function_mode.value = 7;
        // render again to get function value (face index for mesh rendering)
        this.camera.setViewOffset( this.renderer.domElement.width, this.renderer.domElement.height,
          x * window.devicePixelRatio | 0, y * window.devicePixelRatio | 0, 1, 1 );
        this.renderer.setRenderTarget(render_target);
        this.renderer.setClearColor( new THREE.Color(-1.0,-1.0,-1.0));
        this.renderer.clear(true, true, true);
        this.uniforms.line_thickness.value = this.gui_status.line_thickness*4;
        this.renderer.render( this.pivot, this.camera );
        this.uniforms.line_thickness.value = this.gui_status.line_thickness/h;
        const gl = this.context;
        this.context.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixels);
        const index = Math.round(pixels[1]);
        const dim = Math.round(pixels[0]);
        if(index>=0 && dim>0) {
            this.uniforms.highlight_selected_face.value = dim;
            this.uniforms.selected_face.value = index;
            let name = "";
            let text = "";
            if(dim==1)
            {
                text = "Edge";
                if(this.render_data.edge_names && this.render_data.edge_names.length>index)
                    name = this.render_data.edge_names[index];
            }
            else if(dim==2) {
                text = "Face";
                if(this.render_data.names && this.render_data.names.length>index)
                    name = this.render_data.names[index];
            }
            if(text!="") {
                text += ` ${index}`;
                if(name=="")
                    name = "(no name)"
                text += `\n ${name}`;
                this.tooltip.textContent = text;
                this.tooltip.style.visibility = "visible";
                this.tooltip.style.left = `${x}px`;
                this.tooltip.style.top = `${y}px`;
            }
        }
        else
        {
            this.uniforms.highlight_selected_face.value = false;
            this.tooltip.style.visibility = "hidden";
        }

        this.camera.clearViewOffset();
        this.uniforms.function_mode.value = function_mode;
    }
    return index;
  }


  render() {
    let now = new Date().getTime();
    let frame_time = 0.001*(new Date().getTime() - this.last_frame_time );

    if (this.get_pixel) {
      this.uniforms.render_depth.value = true;
      this.camera.setViewOffset( this.renderer.domElement.width, this.renderer.domElement.height,
        this.mouse.x * window.devicePixelRatio | 0, this.mouse.y * window.devicePixelRatio | 0, 1, 1 );
      this.renderer.setRenderTarget(this.render_target);
      this.renderer.setClearColor( new THREE.Color(1.0,1.0,1.0));
      this.renderer.clear(true, true, true);
      this.renderer.render( this.scene, this.camera );
      this.uniforms.render_depth.value= false;

      let pixel_buffer = new Float32Array( 4 );
      this.context.readPixels(0, 0, 1, 1, this.context.RGBA, this.context.FLOAT, pixel_buffer);
      if (pixel_buffer[3]==1){
        this.controls.center.copy(this.mesh_center);
      }else{
        for (var i=0; i<3; i++){
          this.controls.center.setComponent(i, (pixel_buffer[i]-this.trafo.y)/this.trafo.x);
        }
      }
      this.camera.clearViewOffset();

      this.setCenterTag(this.controls.center);
      this.handleEvent('selectpoint', [this, this.controls.center] );
      this.mouse.set(0.0, 0.0);
      this.get_pixel = false;

    }

    this.requestId = 0;

    if(this.ortho_camera === undefined)
      return; // not fully initialized yet

    this.handleEvent('beforerender', [this, frame_time]);

    let gui_status = this.gui_status;
    let uniforms = this.uniforms;

    const h = this.renderer.domElement.height;
    uniforms.line_thickness.value = gui_status.line_thickness/h;

    this.axes_object.visible = gui_status.Misc.axes;
    var subdivision = gui_status.subdivision;
    if(gui_status.Misc.reduce_subdivision && this.controls.mode != null)
      subdivision = Math.ceil(subdivision/2);

    if( this.edges_object != null )
        this.edges_object.update(gui_status);

    if( this.wireframe_object != null )
      this.wireframe_object.update(gui_status);

    if( this.mesh_object != null )
      this.mesh_object.update(gui_status);

    if( this.colormap_object != null )
      this.colormap_object.update(gui_status);

    if( this.grid != null ) {
      this.grid.visible = this.gui_status.show_grid;
      this.grid.updateLabelPositions( this.container, this.camera, this.pivot.matrix );
    }

    if( this.clipping_function_object != null )
        this.clipping_function_object.update(gui_status);

    let three_clipping_plane = this.three_clipping_plane;
    three_clipping_plane.normal.set(gui_status.Clipping.x, gui_status.Clipping.y, gui_status.Clipping.z);
      three_clipping_plane.normal.normalize();
    three_clipping_plane.constant = gui_status.Clipping.dist-three_clipping_plane.normal.dot(this.mesh_center);

    // console.log("three_clipping_plane normal and const", three_clipping_plane.normal, three_clipping_plane.constant);

    this.clipping_plane.set(
      three_clipping_plane.normal.x,
      three_clipping_plane.normal.y,
      three_clipping_plane.normal.z,
      three_clipping_plane.constant);
    this.renderer.clippingPlanes = [];

    let world_clipping_plane = three_clipping_plane.clone();

    world_clipping_plane.constant = gui_status.Clipping.dist;
    world_clipping_plane.applyMatrix4( this.pivot.matrix)

    uniforms.do_clipping.value = gui_status.Clipping.enable;

    if(this.have_deformation || this.have_z_deformation)
      uniforms.deformation.value = gui_status.deformation;

    if(gui_status.Clipping.enable)
      this.renderer.clippingPlanes = [world_clipping_plane];

    if(gui_status.colormap_ncolors)
    {
      uniforms.colormap_min.value = gui_status.colormap_min;
      uniforms.colormap_max.value = gui_status.colormap_max;
    }

    if(this.clipping_vectors_object != null)
    {
      this.clipping_vectors_object.visible = gui_status.Vectors.show;
      uniforms.vectors_offset.value = gui_status.Vectors.offset;
    }

    if(this.is_complex)
    {
      uniforms.complex_scale.value.x = Math.cos(-gui_status.Complex.phase);
      uniforms.complex_scale.value.y = Math.sin(-gui_status.Complex.phase);
    }

    if(gui_status.Vectors.show)
    {
      this.updateClippingPlaneCamera();
      uniforms.function_mode.value = 4;
      this.renderer.setRenderTarget(this.buffer_texture);
      this.renderer.setClearColor( new THREE.Color(0.0,0.0,0.0) );
      this.renderer.clear(true, true, true);
      this.renderer.render(this.buffer_scene, this.buffer_camera);
    }


    uniforms.function_mode.value = parseInt(gui_status.eval);
    uniforms.light_mat.value.x = gui_status.Light.ambient;
    uniforms.light_mat.value.y = gui_status.Light.diffuse;
    uniforms.light_mat.value.z = gui_status.Light.shininess;
    uniforms.light_mat.value.w = gui_status.Light.specularity;

    if (this.get_face_index) {
        this.getIndexAtCursor();
        this.get_face_index = false;
    }

    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor( new THREE.Color(1.0,1.0,1.0));
    this.renderer.clear(true, true, true);
    this.renderer.render( this.scene, this.camera );

    this.renderer.clippingPlanes = [];

    // render after clipping 
    if(this.center_tag != null){
      this.renderer.render(this.center_tag, this.camera);
    }

    if(this.colormap_object && gui_status.Misc.colormap)
      this.renderer.render( this.colormap_object, this.ortho_camera );

    if(this.axes_object && gui_status.Misc.axes)
      this.renderer.render( this.axes_object, this.ortho_camera );


    if(gui_status.Complex.animate)
    {
      gui_status.Complex.phase += frame_time * gui_status.Complex.speed;
      if(gui_status.Complex.phase>2*Math.PI)
        gui_status.Complex.phase -= 2*Math.PI;

      this.phase_controller.updateDisplay();
      this.animate();
    }
    if(gui_status.Multidim.animate)
    {
      gui_status.Multidim.t += frame_time * gui_status.Multidim.speed;
      if(gui_status.Multidim.t > this.render_data.multidim_data.length)
        gui_status.Multidim.t = 0.0;

      this.multidim_controller.updateDisplay();
      this.multidim_controller.__onChange();
      this.animate();
    }
    this.last_frame_time = now;
    this.handleEvent('afterrender', [this, frame_time]);
  }

  renderToImage()
    {
        var img = new Image();
        var toimage =  () => {
            img.src = this.renderer.domElement.toDataURL("image/png");
        };
        this.on("afterrender", toimage);
        this.render();
        this.event_handlers["afterrender"].pop(toimage);
        return img;
  }
}
