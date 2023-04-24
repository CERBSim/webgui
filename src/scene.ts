import {
  WebGLScene,
  getShader,
  setKeys,
  log,
  unpackIndexedData,
} from './utils';

import { RenderObject, extractData } from './render_object';
import { Axes } from './axes';
import * as dat from 'dat.gui';

import {
  MeshFunctionObject,
  WireframeObject,
  ClippingFunctionObject,
} from './mesh';

import {
  PointsObject,
  LinesObject,
  ThickEdgesObject,
  FieldLinesObject,
} from './edges';

import { Colorbar } from './colormap';
import { CameraControls } from './camera';

import { Label3D } from './label';
import { GUI } from './gui';

import * as THREE from 'three';

import './styles.css';

export { THREE };

function makeRenderObject(data, uniforms, path = [], scene) {
  const type = extractData(data, path).type;
  switch (type) {
    case 'lines':
      return new LinesObject(data, uniforms, path);
    case 'points':
      return new PointsObject(data, uniforms, path);
    case 'fieldlines':
      return new FieldLinesObject(data, uniforms, path);
    case 'text':
      return new Label3D(scene.container, data, path);
  }
}

export class Scene extends WebGLScene {
  labels;
  tooltip;

  render_data;
  scene: THREE.Scene;
  perspective_camera: THREE.PerspectiveCamera;
  orthographic_camera: THREE.OrthographicCamera;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  ortho_camera: THREE.OrthographicCamera;
  clipping_plane: THREE.Vector4;
  three_clipping_plane: THREE.Plane;
  world_clipping_plane: THREE.Plane;
  light_dir: THREE.Vector3;
  event_handlers;

  gui;
  gui_misc;
  gui_status_default;
  gui_status;
  gui_objects;
  gui_widgets;
  gui_functions;
  gui_container;
  uniforms;

  edges_object;
  wireframe_object: THREE.Line;
  mesh_object;
  clipping_function_object: THREE.Mesh;
  clipping_vectors_object: THREE.Mesh;
  center_tag;
  grid;
  render_objects = [];
  render_objects_per_mode = {};
  render_modes: Array<string> = [
    'default',
    'no_clipping',
    'overlay',
    'clipping_vectors',
    'select',
  ];
  overlay_objects = [];

  is_complex: boolean;
  trafo;
  mouse: THREE.Vector2;

  last_frame_time: number;

  multidim_controller;

  phase_controller;

  buffer_scene: THREE.Scene;
  buffer_object: THREE.Mesh;
  buffer_camera: THREE.OrthographicCamera;
  buffer_texture;

  mesh_center: THREE.Vector3;
  mesh_radius: number;

  pivot: THREE.Group;
  // overlay_pivot: THREE.Group;

  have_deformation: boolean;
  have_z_deformation: boolean;

  controls;

  funcdim: number;
  mesh_only: boolean;

  version_object;
  index_render_target;

  constructor() {
    super();

    for (const mode of this.render_modes)
      this.render_objects_per_mode[mode] = [];

    this.have_webgl2 = false;

    this.event_handlers = {};
  }

  on(event_name, handler) {
    if (this.event_handlers[event_name] == undefined)
      this.event_handlers[event_name] = [];

    this.event_handlers[event_name].push(handler);
  }

  handleEvent(event_name, args) {
    const handlers = this.event_handlers[event_name];
    if (handlers == undefined) return;

    for (let i = 0; i < handlers.length; i++) handlers[i].apply(null, args);
  }

  cleanup() {
    if (this.labels && this.labels.length)
      this.labels.map((label) => label.el.remove());

    for (let i = 0; i < this.overlay_objects.length; i++)
      this.overlay_objects[i].cleanupHTML();

    this.labels = [];
    if (this.tooltip) this.tooltip.remove();
  }

  getGuiSettings() {
    const settings = JSON.parse(JSON.stringify(this.gui_status)); // deep-copy settings
    settings.camera = {};
    this.controls.storeSettings(settings.camera);
    return JSON.parse(JSON.stringify(settings));
  }

  setGuiSettings(settings) {
    setKeys(this.gui_status, settings);

    if (settings.camera) this.controls.loadSettings(settings.camera);

    for (const i in this.gui.__controllers)
      this.gui.__controllers[i].updateDisplay();
    for (const f in this.gui.__folders) {
      const folder = this.gui.__folders[f];
      for (const i in folder.__controllers)
        folder.__controllers[i].updateDisplay();
    }
    this.animate();
  }

  exitFullscreen() {
    document.exitFullscreen();
  }

  requestFullscreen() {
    const elem = this.element.parentNode;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullScreen) {
      // Webkit (works in Safari and Chrome Canary)
      elem.webkitRequestFullScreen();
    } else if (elem.mozRequestFullScreen) {
      // Firefox
      elem.mozRequestFullScreen();
    }
  }

  isFullscreen() {
    return document.fullscreenElement !== null;
  }

  toggleFullscreen() {
    if (this.isFullscreen()) this.exitFullscreen();
    else this.requestFullscreen();
  }

  onResize() {
    const w = this.element.parentNode.clientWidth;
    const h = this.element.parentNode.clientHeight - 6;

    const aspect = w / h;
    this.ortho_camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1.0,
      -1.0,
      -100,
      100
    );

    this.render_objects.forEach((obj) => obj.onResize(w, h));

    this.camera.aspect = aspect;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.uniforms.aspect.value = aspect;
    this.renderer.setSize(w, h);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  updateClippingPlaneCamera() {
    const n = this.gui_status.Vectors.grid_size;
    const plane_center = new THREE.Vector3();
    this.three_clipping_plane.projectPoint(this.mesh_center, plane_center);
    const plane0 = this.three_clipping_plane.clone();
    plane0.constant = 0.0;
    const normal = this.three_clipping_plane.normal;

    const t2 = new THREE.Vector3();
    if (Math.abs(normal.z) < 0.5)
      plane0.projectPoint(new THREE.Vector3(0, 0, 1), t2);
    else if (Math.abs(normal.y) < 0.5)
      plane0.projectPoint(new THREE.Vector3(0, 1, 0), t2);
    else plane0.projectPoint(new THREE.Vector3(1, 0, 0), t2);

    const t1 = new THREE.Vector3().crossVectors(t2, plane0.normal);
    t1.setLength((2 * this.mesh_radius) / n);
    t2.setLength((2 * this.mesh_radius) / n);

    const position = plane_center.clone();
    position.addScaledVector(plane0.normal, 1);
    const target = plane_center.clone();
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

  updateGridsize() {
    const n = this.gui_status.Vectors.grid_size;
    this.buffer_texture = new THREE.WebGLRenderTarget(n, n, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
    });
    this.uniforms.tex_values = new THREE.Uniform(this.buffer_texture.texture);
    const r = this.mesh_radius;
    this.buffer_camera = new THREE.OrthographicCamera(-r, r, r, -r, -10, 10);

    const geo = <THREE.InstancedBufferGeometry>(
      this.clipping_vectors_object.geometry
    );
    const arrowid = new Float32Array(2 * n * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        arrowid[2 * (i * n + j) + 0] = (1.0 * (j + 0.5)) / n;
        arrowid[2 * (i * n + j) + 1] = (1.0 * (i + 0.5)) / n;
      }
    geo.instanceCount = n * n;
    geo._maxInstanceCount = n * n;
    geo.setAttribute('arrowid', new THREE.InstancedBufferAttribute(arrowid, 2));
    this.animate();
  }

  addRenderObject(object: RenderObject) {
    this.render_objects.push(object);
    // if (object.three_object) this.pivot.add(object.three_object);
    const name = object.name;
    if (name && !(name in this.gui_status.Objects)) {
      const animate = () => this.animate();
      this.gui_status.Objects[name] = true;
      this.gui_objects.add(this.gui_status.Objects, name).onChange(animate);
    }
    for (const mode of object.render_modes) {
      if (!(mode in this.render_objects_per_mode)) {
        console.error('Unknown render mode: ' + mode);
      } else this.render_objects_per_mode[mode].push(object);
    }
  }

  // Add RenderObject which is rendered using the widgets_camera (2d overlay)
  addOverlayObject(object: RenderObject) {
    // this.overlay_objects.push(object);
    // console.log('add', object, this.overlay_pivot);
    // if (object.three_object) this.overlay_pivot.add(object.three_object);
    const name = object.name;
    this.gui_status.Objects[name] = true;
    const animate = () => this.animate();
    this.gui_objects.add(this.gui_status.Objects, name).onChange(animate);
  }

  initCanvas(element, webgl_args) {
    WebGLScene.prototype.initCanvas.call(this, element, webgl_args);
    // label with NGSolve version at right lower corner
    this.version_object = document.createElement('div');
    // const style = 'bottom: 10px; right: 10px';
    // this.version_object.setAttribute("style",this.label_style+style); TODO
    this.container.appendChild(this.version_object);

    window.addEventListener('resize', () => this.onResize(), false);
  }

  initRenderData(render_data) {
    const llog = log.local('initRenderData');
    this.cleanup();
    unpackIndexedData(render_data);

    if (this.gui != null) this.gui.destroy();

    this.uniforms = {};
    const uniforms = this.uniforms;
    uniforms.colormap_min = new THREE.Uniform(0.0);
    uniforms.colormap_max = new THREE.Uniform(1.0);
    uniforms.function_mode = new THREE.Uniform(0);
    uniforms.colormap_size = new THREE.Uniform(new THREE.Vector2(1, 1));
    uniforms.dark_backside = new THREE.Uniform(true);

    this.edges_object = null;
    this.wireframe_object = null;
    this.mesh_object = null;
    this.render_objects = [];
    this.clipping_function_object = null;
    this.clipping_vectors_object = null;
    this.buffer_scene = null;
    this.buffer_object = null;
    this.buffer_camera = null;
    this.buffer_texture = null;

    this.last_frame_time = new Date().getTime();
    this.render_data = render_data;
    this.funcdim = render_data.funcdim;
    this.is_complex = render_data.is_complex;
    console.log('THREE', THREE);
    console.log('dat', dat);

    this.have_deformation =
      render_data.mesh_dim == render_data.funcdim && !render_data.is_complex;
    this.have_z_deformation =
      render_data.mesh_dim == 2 && render_data.funcdim > 0;
    this.mesh_only = render_data.funcdim == 0;

    this.mesh_center = new THREE.Vector3().fromArray(render_data.mesh_center);
    this.mesh_radius = render_data.mesh_radius;

    const version_text = document.createTextNode(
      'NGSolve ' + render_data.ngsolve_version
    );
    this.version_object.innerHTML = '';
    this.version_object.appendChild(version_text);

    this.scene = new THREE.Scene();
    // if(window.matchMedia('(prefers-color-scheme: dark)').matches)
    //   this.scene.background = new THREE.Color(0x292c2e);
    this.tooltip = document.createElement('div');
    const el_text = document.createTextNode('tooltip');
    this.tooltip.appendChild(el_text);

    this.container.appendChild(this.tooltip);

    this.tooltip.classList.add('tooltiptext');
    this.tooltip.style.top = '10px';
    this.tooltip.style.left = '10px';
    this.tooltip.style.visibility = 'hidden';

    this.pivot = new THREE.Group();
    this.pivot.matrixAutoUpdate = false;
    // this.overlay_pivot = new THREE.Group();
    // this.overlay_pivot.matrixAutoUpdate = false;

    this.buffer_scene = new THREE.Scene();

    const aspect = this.element.offsetWidth / this.element.offsetHeight;
    const near = 1;
    const far = 100;
    const fov = 40;
    this.perspective_camera = new THREE.PerspectiveCamera(
      fov,
      aspect,
      near,
      far
    );
    this.orthographic_camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1.0,
      -1.0,
      near,
      far
    );
    this.camera = this.perspective_camera;

    this.perspective_camera.position.set(0.0, 0.0, 3);
    this.orthographic_camera.position.set(0.0, 0.0, 3);

    this.clipping_plane = new THREE.Vector4(0, 0, 1, 0);
    uniforms.aspect = new THREE.Uniform(this.perspective_camera.aspect);
    uniforms.line_thickness = new THREE.Uniform(0.001);
    uniforms.clipping_plane = new THREE.Uniform(this.clipping_plane);
    uniforms.highlight_selected_face = new THREE.Uniform(false);
    uniforms.selected_face = new THREE.Uniform(-1);
    // should cliping plane in pivot world be calculated in shader insted of passing it?
    //currently not done because it is needed here anyways

    this.three_clipping_plane = new THREE.Plane();

    const light_dir = new THREE.Vector3(0.5, 0.5, 1.5);
    light_dir.normalize();
    uniforms.light_dir = new THREE.Uniform(light_dir);
    const light_mat = new THREE.Vector4(0.3, 0.7, 10, 0.3); // ambient, diffuse, shininess, specularity
    uniforms.light_mat = new THREE.Uniform(light_mat);

    uniforms.do_clipping = new THREE.Uniform(false);
    uniforms.render_depth = new THREE.Uniform(false);
    this.trafo = new THREE.Vector2(
      1.0 / 2.0 / (this.mesh_center.length() + this.mesh_radius),
      1.0 / 2.0
    );
    uniforms.trafo = new THREE.Uniform(this.trafo);

    this.mouse = new THREE.Vector2(0.0, 0.0);
    this.center_tag = null;

    const animate = () => this.animate();
    const gui = new GUI(
      this.container,
      render_data,
      animate,
      {},
      { Fullscreen: () => this.toggleFullscreen() }
    );
    const gui_functions = gui.gui_functions;

    this.gui = gui;
    this.gui_status = gui.gui_status;
    const gui_status = this.gui_status;
    this.gui_status_default = gui.gui_status_default;
    gui_status.Objects = {};
    this.gui_objects = gui.addFolder('Objects');
    this.gui_objects.open();
    const gui_light = gui.addFolder('Light');
    const gui_misc = gui.addFolder('Misc');

    llog.info('GUI', gui);
    llog.info('gui_status', gui_status);

    this.addRenderObject(
      new Colorbar(this.render_data, this.uniforms, [], this.container)
    );
    this.addRenderObject(new Axes(this.container));

    uniforms.n_segments = new THREE.Uniform(5);
    if (render_data.edges.length) {
      this.addRenderObject(new ThickEdgesObject(render_data, uniforms));
      gui_misc
        .add(gui_status.Misc, 'line_thickness', 1, 20, 1)
        .onChange(animate);
    }

    if (this.have_z_deformation || this.have_deformation) {
      this.gui_status_default.deformation = render_data.deformation ? 1.0 : 0.0;
      gui_status.deformation = this.gui_status_default.deformation;
      gui.add(gui_status, 'deformation', 0.0, 1.0, 0.0001).onChange(animate);
      uniforms.deformation = new THREE.Uniform(gui_status.deformation);
    }

    if (render_data.is_complex) {
      this.gui_status_default.eval = 5;
      gui_status.eval = 5;
      this.gui.c_eval = gui
        .add(gui_status, 'eval', { real: 5, imag: 6, norm: 3 })
        .onChange(animate);

      const cgui = gui.addFolder('Complex');
      this.phase_controller = cgui
        .add(gui_status.Complex, 'phase', 0, 2 * Math.PI, 0.001)
        .onChange(animate);
      cgui.add(gui_status.Complex, 'animate').onChange(() => {
        this.last_frame_time = new Date().getTime();
        this.animate();
      });
      cgui.add(gui_status.Complex, 'speed', 0.0, 10, 0.0001).onChange(animate);
      uniforms.complex_scale = new THREE.Uniform(new THREE.Vector2(1, 0));
    } else if (render_data.funcdim == 2) {
      gui_status.eval = 3;
      this.gui.c_eval = gui
        .add(gui_status, 'eval', { '0': 0, '1': 1, norm: 3 })
        .onChange(animate);
    } else if (render_data.funcdim == 3) {
      gui_status.eval = 3;
      this.gui.c_eval = gui
        .add(gui_status, 'eval', { '0': 0, '1': 1, '2': 2, norm: 3 })
        .onChange(animate);
    }

    if (this.gui.c_eval) {
      if (render_data.eval != undefined) {
        this.gui_status_default.eval = render_data.eval;
        this.gui.c_eval.setValue(render_data.eval);
      }
      this.gui.c_eval.onChange(() => {
        if (gui_status.autoscale) this.gui.updateColormapToAutoscale();
      });
    }

    if (render_data.mesh_dim == 3) {
      const gui_clipping = gui.addFolder('Clipping');
      if (render_data.draw_vol) {
        this.addRenderObject(
          new ClippingFunctionObject(render_data, uniforms, [])
        );
      }

      if (render_data.clipping) {
        this.gui_status_default.Clipping.enable = true;
        gui_status.Clipping.enable = true;
        if (render_data.clipping_x != undefined) {
          this.gui_status_default.Clipping.x = render_data.clipping_x;
          gui_status.Clipping.x = render_data.clipping_x;
        }
        if (render_data.clipping_y != undefined) {
          this.gui_status_default.Clipping.y = render_data.clipping_y;
          gui_status.Clipping.y = render_data.clipping_y;
        }
        if (render_data.clipping_z != undefined) {
          this.gui_status_default.Clipping.z = render_data.clipping_z;
          gui_status.Clipping.z = render_data.clipping_z;
        }
        if (render_data.clipping_dist != undefined) {
          this.gui_status_default.Clipping.dist = render_data.clipping_dist;
          gui_status.Clipping.dist = render_data.clipping_dist;
        }
      } else console.log('render data not clipping found!!!');

      gui_clipping.add(gui_status.Clipping, 'enable').onChange(animate);
      gui_clipping.add(gui_status.Clipping, 'x', -1.0, 1.0).onChange(animate);
      gui_clipping.add(gui_status.Clipping, 'y', -1.0, 1.0).onChange(animate);
      gui_clipping.add(gui_status.Clipping, 'z', -1.0, 1.0).onChange(animate);
      gui_clipping
        .add(
          gui_status.Clipping,
          'dist',
          -1.2 * this.mesh_radius,
          1.2 * this.mesh_radius
        )
        .onChange(animate);
    }

    let draw_vectors = render_data.funcdim > 1 && !render_data.is_complex;
    draw_vectors =
      draw_vectors &&
      ((render_data.draw_surf && render_data.mesh_dim == 2) ||
        (render_data.draw_vol && render_data.mesh_dim == 3));
    if (draw_vectors) {
      if (render_data.vectors) {
        this.gui_status_default.Vectors.show = true;
        gui_status.Vectors.show = true;
        if (render_data.vectors_grid_size) {
          this.gui_status_default.Vectors.grid_size =
            render_data.vectors_grid_size;
          gui_status.Vectors.grid_size = render_data.vectors_grid_size;
        }
        if (render_data.vectors_offset) {
          this.gui_status_default.Vectors.offset = render_data.vectors_offset;
          gui_status.Vectors.offset = render_data.vectors_offset;
        }
      }

      const gui_vec = gui.addFolder('Vectors');
      gui_vec.add(gui_status.Vectors, 'show').onChange(animate);
      gui_vec
        .add(gui_status.Vectors, 'grid_size', 1, 100, 1)
        .onChange(() => this.updateGridsize());
      gui_vec
        .add(gui_status.Vectors, 'offset', -1.0, 1.0, 0.001)
        .onChange(animate);

      if (render_data.mesh_dim == 2)
        this.buffer_object = this.mesh_object.clone();
      else this.buffer_object = this.clipping_function_object.clone();

      this.buffer_scene.add(this.buffer_object);

      uniforms.clipping_plane_c = new THREE.Uniform(new THREE.Vector3());
      uniforms.clipping_plane_t1 = new THREE.Uniform(new THREE.Vector3());
      uniforms.clipping_plane_t2 = new THREE.Uniform(new THREE.Vector3());
      uniforms.vectors_offset = new THREE.Uniform(gui_status.Vectors.offset);
      uniforms.grid_size = new THREE.Uniform(gui_status.Vectors.grid_size);

      this.clipping_vectors_object = this.createClippingVectors();
      this.pivot.add(this.clipping_vectors_object);
      this.updateGridsize();
    }

    if (this.mesh_only) {
      this.gui_status_default.Colormap.min = -0.5;
      this.gui_status_default.Colormap.max = render_data.mesh_regions_2d - 0.5;
      gui_status.Colormap.min = -0.5;
      gui_status.Colormap.max = render_data.mesh_regions_2d - 0.5;
      // this.setSelectedFaces();
    }
    uniforms.colormap_min.value = gui_status.Colormap.min;
    uniforms.colormap_max.value = gui_status.Colormap.max;

    gui_misc.add(gui_status.Misc, 'subdivision', 1, 20, 1).onChange(animate);
    if (render_data.show_wireframe && render_data.Bezier_points.length > 0) {
      this.addRenderObject(new WireframeObject(render_data, uniforms, []));
      // this.pivot.add(this.wireframe_object);
      // gui.add(gui_status, 'mesh').onChange(animate);
    }

    if (render_data.show_mesh) {
      this.addRenderObject(new MeshFunctionObject(render_data, uniforms));
    }

    if (render_data.objects) {
      render_data.objects.forEach((object, i: number) => {
        const obj = makeRenderObject(
          render_data,
          uniforms,
          ['objects', i],
          this
        );
        this.addRenderObject(obj);
      });
    }

    if (render_data.multidim_data) {
      const md = render_data.multidim_data.length;

      if (render_data.multidim_interpolate) {
        if (render_data.multidim_animate) {
          this.gui_status_default.Multidim.animate = true;
          gui_status.Multidim.animate = true;
        }

        const gui_md = gui.addFolder('Multidim');
        this.multidim_controller = gui_md
          .add(gui_status.Multidim, 't', 0, md, 0.01)
          .onChange(() => {
            const s = gui_status.Multidim.t;
            const n = Math.floor(s);
            const t = s - n;
            if (n == 0)
              this.interpolateRenderData(
                this.render_data,
                this.render_data.multidim_data[0],
                t
              );
            else if (s == md)
              this.setRenderData(this.render_data.multidim_data[md - 1]);
            else
              this.interpolateRenderData(
                this.render_data.multidim_data[n - 1],
                this.render_data.multidim_data[n],
                t
              );
          });
        gui_md.add(gui_status.Multidim, 'animate').onChange(() => {
          this.last_frame_time = new Date().getTime();
          this.animate();
        });
        gui_md
          .add(gui_status.Multidim, 'speed', 0.0, 10, 0.001)
          .onChange(animate);
      } else {
        gui.add(gui_status.Multidim, 'multidim', 0, md, 1).onChange(() => {
          const n = gui_status.Multidim.multidim;
          if (n == 0) this.setRenderData(this.render_data);
          else this.setRenderData(this.render_data.multidim_data[n - 1]);
        });
      }
    }

    gui_light.add(gui_status.Light, 'ambient', 0.0, 1.0).onChange(animate);
    gui_light.add(gui_status.Light, 'diffuse', 0.0, 1.0).onChange(animate);
    gui_light.add(gui_status.Light, 'shininess', 0.0, 100.0).onChange(animate);
    gui_light.add(gui_status.Light, 'specularity', 0.0, 1.0).onChange(animate);

    gui_functions['reset settings'] = () => {
      this.setGuiSettings(this.gui_status_default);
    };
    gui_functions['store settings'] = () => {
      document.cookie = 'gui_status=' + btoa(JSON.stringify(gui_status));
    };
    gui_functions['load settings'] = () => {
      const name = 'gui_status=';
      const decodedCookie = decodeURIComponent(document.cookie);
      const ca = decodedCookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          const s = JSON.parse(atob(c.substring(name.length, c.length)));
          this.setGuiSettings(s);
        }
      }
    };
    gui_misc.add(gui_status.Misc, 'fast_draw');
    gui_misc.add(gui_functions, 'reset settings');
    gui_misc.add(gui_functions, 'store settings');
    gui_misc.add(gui_functions, 'load settings');
    this.gui_misc = gui_misc;

    gui_functions['reset'] = () => {
      this.controls.reset();
    };
    gui.add(gui_functions, 'reset').onChange(animate);

    this.scene.add(this.pivot);

    this.controls = new CameraControls(this, this.renderer.domElement);
    this.controls.addEventListener('change', animate);

    this.updateRenderData(render_data);
    if (render_data.gui_settings) this.setGuiSettings(render_data.gui_settings);
    if (render_data.settings) this.setGuiSettings(render_data.settings);

    console.log('Scene init done', this);
    if (render_data.on_init) {
      const on_init = Function('scene', 'render_data', render_data.on_init);
      on_init(this, render_data);
    }
    llog.release();
    // for some reason, stuff is only rendered correctly after 2 render calls...
    setTimeout(() => {
      this.onResize(), 1;
      setTimeout(() => this.animate(), 1);
    });
  }

  init(element, render_data, webgl_args = {}) {
    this.initCanvas(element, webgl_args);
    this.initRenderData(render_data);
  }

  createClippingVectors() {
    const material = new THREE.RawShaderMaterial({
      vertexShader: getShader('vector_function.vert'),
      fragmentShader: getShader(
        'function.frag',
        { NO_CLIPPING: 1, SIDE_LIGHTS: 1 },
        this.render_data.user_eval_function
      ),
      side: THREE.DoubleSide,
      uniforms: this.uniforms,
    });

    const geo = new THREE.InstancedBufferGeometry();
    const cone = new THREE.ConeGeometry(0.5, 1, 10);
    geo.setIndex(cone.getIndex());
    geo.setAttribute('position', cone.getAttribute('position'));
    geo.setAttribute('normal', cone.getAttribute('normal'));
    geo.setAttribute('uv', cone.getAttribute('uv'));

    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  // called on scene.Redraw() from Python
  updateRenderData(render_data) {
    this.render_data = render_data;
    this.setRenderData(render_data);
  }

  updateColormapToAutoscale({ draw_surf, draw_vol, funcmin, funcmax }) {
    if (draw_surf || draw_vol) {
      const cmin = funcmin;
      const cmax = funcmax;
      this.gui_status_default.Colormap.min = cmin;
      this.gui_status_default.Colormap.max = cmax;

      if (this.gui_status.autoscale) {
        if (this.gui_status.eval == 3) {
          // norm of vector-valued function
          this.gui_status.Colormap.min = 0;
          this.gui_status.Colormap.max = Math.max(
            Math.abs(cmin),
            Math.abs(cmax)
          );
        } else {
          this.gui_status.Colormap.min = cmin;
          this.gui_status.Colormap.max = cmax;
        }
        this.gui.c_cmin.updateDisplay();
        this.gui.c_cmax.updateDisplay();
      }

      if (cmax > cmin) this.gui.setStepSize(cmin, cmax);
    }
  }

  setRenderData(render_data) {
    for (let i = 0; i < this.render_objects.length; i++)
      if (this.render_objects[i] != null)
        this.render_objects[i].updateRenderData(render_data);

    this.updateColormapToAutoscale(render_data);

    this.animate();
  }

  interpolateRenderData(rd, rd2, t) {
    const t1 = 1.0 - t;
    const mix = (a, b) => t1 * a + t * b;

    if (this.edges_object != null)
      this.edges_object.updateRenderData(rd, rd2, t);

    if (this.wireframe_object != null)
      this.wireframe_object.updateRenderData(rd, rd2, t);

    if (this.mesh_object != null) this.mesh_object.updateRenderData(rd, rd2, t);

    if (rd2.objects)
      for (let i = 0; i < this.render_objects.length; i++)
        if (this.render_objects[i] != null)
          this.render_objects[i].updateRenderData(
            rd.objects[i],
            rd2.objects[i],
            t
          );

    if (this.clipping_function_object != null)
      this.clipping_function_object.updateRenderData(rd, rd2, t);

    if (rd.draw_surf || rd.draw_vol) {
      const cmin = mix(rd.funcmin, rd2.funcmin);
      const cmax = mix(rd.funcmax, rd2.funcmax);
      this.gui_status_default.Colormap.min = cmin;
      this.gui_status_default.Colormap.max = cmax;

      if (this.gui_status.autoscale) {
        this.gui_status.Colormap.min = cmin;
        this.gui_status.Colormap.max = cmax;
        this.gui.c_cmin.updateDisplay();
        this.gui.c_cmax.updateDisplay();
      }

      if (cmax > cmin) this.gui.setStepSize(cmin, cmax);
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
      const data = new Uint8Array(4 * n * n);

      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const dist =
            (n * n) / 4 -
            ((i - n / 2) * (i - n / 2) + (j - n / 2) * (j - n / 2));
          if (dist > 0.0) {
            for (let k = 0; k < 3; k++) data[4 * (i * n + j) + k] = 128;
            data[4 * (i * n + j) + 3] = 255;
          } else {
            for (let k = 0; k < 3; k++) data[4 * (i * n + j) + k] = 0;
          }
        }

      const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);

      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      // disable depthTest and set renderOrder to make the tag always visible
      const material = new THREE.SpriteMaterial({
        map: texture,
        sizeAttenuation: false,
        color: 0xffffff,
        depthTest: false,
      });

      this.center_tag = new THREE.Sprite(material);
      const s = 0.01 / this.controls.scale;

      this.center_tag.scale.set(s, s, s);
      this.center_tag.position.copy(position);
      this.center_tag.renderOrder = 1;
      this.pivot.add(this.center_tag);
    }
  }

  async getMeshIndex(x, y) {
    await this.animate(true);
    let index = -1;
    let dim = -1;
    if (this.mesh_only) {
      const pixels = new Float32Array(4);
      const render_target = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
      });
      const h = this.renderer.domElement.height;

      // render face index to texture (for mouse selection)
      const function_mode = this.uniforms.function_mode.value;
      this.uniforms.function_mode.value = 7;
      // render again to get function value (face index for mesh rendering)
      this.camera.setViewOffset(
        this.renderer.domElement.width,
        this.renderer.domElement.height,
        (x * window.devicePixelRatio) | 0,
        (y * window.devicePixelRatio) | 0,
        1,
        1
      );
      this.renderer.setRenderTarget(render_target);
      this.renderer.setClearColor(new THREE.Color(-1.0, -1.0, -1.0));
      this.renderer.clear(true, true, true);
      this.uniforms.line_thickness.value =
        this.gui_status.Misc.line_thickness * 4;
      this.renderer.render(this.pivot, this.camera);
      this.uniforms.line_thickness.value =
        this.gui_status.Misc.line_thickness / h;
      const gl = this.context;
      this.context.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixels);
      // console.log("pixels", pixels);
      index = Math.round(pixels[1]);
      dim = Math.round(pixels[0]);
      if (index >= 0 && dim > 0) {
        // this.uniforms.highlight_selected_face.value = dim;
        this.uniforms.selected_face.value = index;
        let name = '';
        let text = '';
        if (dim == 1) {
          text = 'Edge';
          if (
            this.render_data.edge_names &&
            this.render_data.edge_names.length > index
          )
            name = this.render_data.edge_names[index];
        } else if (dim == 2) {
          text = 'Face';
          if (this.render_data.names && this.render_data.names.length > index)
            name = this.render_data.names[index];
        }
        if (text != '') {
          text += ` ${index}`;
          if (name == '') name = '(no name)';
          text += `\n ${name}`;
          this.tooltip.textContent = text;
          this.tooltip.style.visibility = 'visible';
          this.tooltip.style.left = `${x}px`;
          this.tooltip.style.top = `${y + 20}px`;
        }
      } else {
        this.uniforms.highlight_selected_face.value = false;
        this.tooltip.style.visibility = 'hidden';
      }

      this.camera.clearViewOffset();
      this.uniforms.function_mode.value = function_mode;
    }
    return { dim, index };
  }

  async getPixelCoordinates(x, y) {
    await this.animate(true);

    this.uniforms.render_depth.value = true;
    this.camera.setViewOffset(
      this.renderer.domElement.width,
      this.renderer.domElement.height,
      (x * window.devicePixelRatio) | 0,
      (y * window.devicePixelRatio) | 0,
      1,
      1
    );
    this.renderer.setRenderTarget(this.render_target);
    this.renderer.setClearColor(new THREE.Color(1.0, 1.0, 1.0));
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this.uniforms.render_depth.value = false;

    // console.log("viewport", x * window.devicePixelRatio | 0,y * window.devicePixelRatio | 0 )
    const pixel_buffer = new Float32Array(4);
    this.context.readPixels(
      0,
      0,
      1,
      1,
      this.context.RGBA,
      this.context.FLOAT,
      pixel_buffer
    );
    this.camera.clearViewOffset();
    // console.log("pixel buffer", pixel_buffer);

    if (pixel_buffer[3] !== 1) {
      const p = new THREE.Vector3();
      for (let i = 0; i < 3; i++) {
        p.setComponent(i, (pixel_buffer[i] - this.trafo.y) / this.trafo.x);
      }
      return p;
    }
    return null;
  }

  renderObjects(mode: string) {
    const camera =
      mode === 'overlay' ? this.ortho_camera : this.perspective_camera;

    const data = {
      gui_status: this.gui_status,
      camera,
      mode,
      canvas: this.canvas,
      renderer: this.renderer,
      controls: this.controls,
    };

    for (const obj of this.render_objects_per_mode[mode]) obj.render(data);
  }

  setClippingPlane() {
    const { gui_status, uniforms } = this;

    if (this.clipping_function_object != null)
      this.clipping_function_object.render(this);

    const three_clipping_plane = this.three_clipping_plane;
    three_clipping_plane.normal.set(
      gui_status.Clipping.x,
      gui_status.Clipping.y,
      gui_status.Clipping.z
    );
    three_clipping_plane.normal.normalize();
    three_clipping_plane.constant =
      gui_status.Clipping.dist -
      three_clipping_plane.normal.dot(this.mesh_center);

    this.clipping_plane.set(
      three_clipping_plane.normal.x,
      three_clipping_plane.normal.y,
      three_clipping_plane.normal.z,
      three_clipping_plane.constant
    );
    this.renderer.clippingPlanes = [];

    const world_clipping_plane = three_clipping_plane.clone();

    world_clipping_plane.constant = gui_status.Clipping.dist;
    world_clipping_plane.applyMatrix4(this.pivot.matrix);

    uniforms.do_clipping.value = gui_status.Clipping.enable;

    if (this.have_deformation || this.have_z_deformation)
      uniforms.deformation.value = gui_status.deformation;

    if (gui_status.Clipping.enable)
      this.renderer.clippingPlanes = [world_clipping_plane];

    if (gui_status.Colormap.ncolors) {
      uniforms.colormap_min.value = gui_status.Colormap.min;
      uniforms.colormap_max.value = gui_status.Colormap.max;
    }
  }

  render() {
    const now = new Date().getTime();
    const frame_time = 0.001 * (new Date().getTime() - this.last_frame_time);

    this.requestId = 0;

    if (this.ortho_camera === undefined) return; // not fully initialized yet

    this.handleEvent('beforerender', [this, frame_time]);

    const { gui_status, uniforms } = this;

    const h = this.renderer.domElement.height;
    uniforms.line_thickness.value = gui_status.Misc.line_thickness / h;

    if (this.clipping_vectors_object != null) {
      this.clipping_vectors_object.visible = gui_status.Vectors.show;
      uniforms.vectors_offset.value = gui_status.Vectors.offset;
    }

    this.setClippingPlane();

    if (this.is_complex) {
      uniforms.complex_scale.value.x = Math.cos(-gui_status.Complex.phase);
      uniforms.complex_scale.value.y = Math.sin(-gui_status.Complex.phase);
    }

    if (gui_status.Vectors.show) {
      this.updateClippingPlaneCamera();
      uniforms.function_mode.value = 4;
      this.renderer.setRenderTarget(this.buffer_texture);
      this.renderer.setClearColor(new THREE.Color(0.0, 0.0, 0.0));
      this.renderer.clear(true, true, true);
      this.renderer.render(this.buffer_scene, this.buffer_camera);
    }

    uniforms.function_mode.value = parseInt(gui_status.eval);
    uniforms.light_mat.value.x = gui_status.Light.ambient;
    uniforms.light_mat.value.y = gui_status.Light.diffuse;
    uniforms.light_mat.value.z = gui_status.Light.shininess;
    uniforms.light_mat.value.w = gui_status.Light.specularity;

    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(new THREE.Color(1.0, 1.0, 1.0));
    this.renderer.clear(true, true, true);

    this.renderObjects('default');

    this.renderer.clippingPlanes = [];

    this.renderObjects('no_clipping');
    // // render after clipping
    // if (this.center_tag != null) {
    //   this.renderer.render(this.center_tag, this.camera);
    // }

    this.renderObjects('overlay');

    if (gui_status.Complex.animate) {
      gui_status.Complex.phase += frame_time * gui_status.Complex.speed;
      if (gui_status.Complex.phase > 2 * Math.PI)
        gui_status.Complex.phase -= 2 * Math.PI;

      this.phase_controller.updateDisplay();
      this.animate();
    }
    if (gui_status.Multidim.animate) {
      gui_status.Multidim.t += frame_time * gui_status.Multidim.speed;
      if (gui_status.Multidim.t > this.render_data.multidim_data.length)
        gui_status.Multidim.t = 0.0;

      this.multidim_controller.updateDisplay();
      this.multidim_controller.__onChange();
      this.animate();
    }
    this.last_frame_time = now;
    this.handleEvent('afterrender', [this, frame_time]);
  }

  renderToImage() {
    const img = new Image();
    const toimage = () => {
      img.src = this.renderer.domElement.toDataURL('image/png');
    };
    this.on('afterrender', toimage);
    this.render();
    this.event_handlers['afterrender'].pop(toimage);
    return img;
  }
}
