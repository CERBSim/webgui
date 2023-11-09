import * as THREE from 'three';
import * as dat from 'dat.gui';

import * as axes from './axes';
import * as camera from './camera';
import * as colormap from './colormap';
import * as edges from './edges';
import * as gui from './gui';
import * as label from './label';
import * as mesh from './mesh';
import * as render_object from './render_object';
import * as utils from './utils';

const imported_modules = {
  axes,
  camera,
  colormap,
  edges,
  gui,
  label,
  mesh,
  render_object,
  utils,
  dat,
  THREE,
};

import { WebGLScene, log, unpackIndexedData } from './utils';

import { RenderObject, extractData } from './render_object';
import { Axes } from './axes';

import {
  MeshFunctionObject,
  WireframeObject,
  ClippingFunctionObject,
  ClippingVectorsObject,
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
  widget;
  width: number;
  height: number;
  heightMargin = 6;
  hidden = false;

  gui: GUI;
  gui_objects: { [key: string]: RenderObject };
  uniforms: { [key: string]: THREE.IUniform };

  center_tag;
  render_objects = [];
  render_objects_per_mode = {};
  render_modes: Array<string> = [
    'update',
    'default',
    'no_clipping',
    'overlay',
    'clipping_vectors',
    'select',
    'locate',
  ];
  overlay_objects = [];

  is_complex: boolean;
  trafo: THREE.Vector2;
  mouse: THREE.Vector2;

  last_frame_time: number;

  mesh_center: THREE.Vector3;
  mesh_radius: number;

  have_deformation: boolean;
  have_z_deformation: boolean;

  controls: CameraControls;

  funcdim: number;
  mesh_only: boolean;

  version_object;
  index_render_target;

  constructor(widget = undefined) {
    super();

    for (const mode of this.render_modes)
      this.render_objects_per_mode[mode] = [];

    this.have_webgl2 = false;

    this.event_handlers = {};
    this.widget = widget;
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
    for (const obj of this.render_objects) obj.cleanupHTML();

    if (this.tooltip) this.tooltip.remove();
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
    if (!this.isVisible()) return;

    if (!this.checkResize()) return this.animate(); // no need to resize, but trigger new frame

    const { w, h } = this.calcSize();
    this.width = w;
    this.height = h;

    const aspect = w / h;
    this.ortho_camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1.0,
      -1.0,
      -100,
      100
    );

    this.perspective_camera.aspect = aspect;
    this.perspective_camera.updateProjectionMatrix();

    this.orthographic_camera.aspect = aspect;
    this.orthographic_camera.left = -aspect;
    this.orthographic_camera.right = aspect;
    this.orthographic_camera.updateProjectionMatrix();
    this.uniforms.aspect.value = aspect;
    this.renderer.setSize(w, h);
    this.render_objects.forEach((obj) => obj.onResize(w, h));
    this.controls.update();
  }

  addRenderObject(object: RenderObject, default_visible = undefined) {
    const visible = this.gui.settings.Objects[object.name] ?? default_visible;
    this.render_objects.push(object);
    const name = object.name;
    const is_new_name =
      name && this.render_objects.find((o) => o.name === name) !== undefined;
    if (is_new_name) {
      const objects = this.gui.settings.Objects;
      objects[name] = visible;
      this.gui.gui_objects.add(objects, name).onChange(() => this.animate());
    }
    for (const mode of object.render_modes) {
      if (!(mode in this.render_objects_per_mode)) {
        console.error('Unknown render mode: ' + mode);
      } else this.render_objects_per_mode[mode].push(object);
    }
  }

  initCanvas(element, webgl_args) {
    // console.log('init canvas', webgl_args);
    WebGLScene.prototype.initCanvas.call(this, element, webgl_args);
    // label with NGSolve version at right lower corner
    this.version_object = document.createElement('div');
    // const style = 'bottom: 10px; right: 10px';
    // this.version_object.setAttribute("style",this.label_style+style); TODO
    this.container.appendChild(this.version_object);

    window.addEventListener('resize', () => this.onResize(), false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting === true) this.handleEvent('visible', []);
        else this.handleEvent('hidden', []);
      },
      { threshold: [0] }
    );

    observer.observe(element);
    this.on('visible', () => {
      this.hidden = false;
      this.animate();
    });
    this.on('hidden', () => {
      this.hidden = true;
    });
  }

  initRenderData(render_data) {
    const llog = log.local('initRenderData');
    this.cleanup();
    unpackIndexedData(render_data);

    if (this.gui != null) this.gui.destroy();

    this.uniforms = {};
    const uniforms = this.uniforms;
    uniforms.tex_colormap = new THREE.Uniform();
    uniforms.colormap_min = new THREE.Uniform(0.0);
    uniforms.colormap_max = new THREE.Uniform(1.0);
    uniforms.function_mode = new THREE.Uniform(0);
    uniforms.colormap_size = new THREE.Uniform(new THREE.Vector2(1, 1));
    uniforms.dark_backside = new THREE.Uniform(true);

    this.render_objects = [];

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
    this.trafo = new THREE.Vector2(
      1.0 / 2.0 / (this.mesh_center.length() + this.mesh_radius),
      1.0 / 2.0
    );
    uniforms.trafo = new THREE.Uniform(this.trafo);

    this.mouse = new THREE.Vector2(0.0, 0.0);
    this.center_tag = null;

    const animate = () => this.animate();

    this.controls = new CameraControls(this, this.renderer.domElement);
    (this.controls as THREE.EventDispatcher).addEventListener(
      'change',
      animate
    );

    const gui = new GUI(
      this.container,
      this,
      animate,
      {},
      { Fullscreen: () => this.toggleFullscreen() }
    );

    this.gui = gui;

    this.addRenderObject(
      new Colorbar(this.render_data, this.uniforms, [], this.container)
    );
    this.addRenderObject(new Axes(this.container));

    uniforms.n_segments = new THREE.Uniform(5);
    if (render_data.edges.length)
      this.addRenderObject(new ThickEdgesObject(render_data, uniforms));

    if (this.have_z_deformation || this.have_deformation)
      uniforms.deformation = new THREE.Uniform(0);

    if (render_data.is_complex)
      uniforms.complex_scale = new THREE.Uniform(new THREE.Vector2(1, 0));

    if (render_data.mesh_dim == 3) {
      if (render_data.draw_vol) {
        const clipping_function = new ClippingFunctionObject(
          render_data,
          uniforms,
          []
        );
        this.addRenderObject(clipping_function, false);
        if (render_data.funcdim == 3)
          this.addRenderObject(
            new ClippingVectorsObject(
              render_data,
              uniforms,
              [],
              clipping_function
            ),
            false
          );
      }
    }

    if (render_data.show_wireframe && render_data.Bezier_points.length > 0)
      this.addRenderObject(new WireframeObject(render_data, uniforms, []));

    if (render_data.show_mesh) {
      const mesh_function = new MeshFunctionObject(render_data, uniforms);
      this.addRenderObject(mesh_function);
      if (render_data.draw_surf && render_data.funcdim == 2) {
        this.addRenderObject(
          new ClippingVectorsObject(render_data, uniforms, [], mesh_function),
          false
        );
      }
    }

    if (render_data.objects) {
      render_data.objects.forEach((_, i: number) => {
        const obj = makeRenderObject(
          render_data,
          uniforms,
          ['objects', i],
          this
        );
        this.addRenderObject(obj);
      });
    }

    llog.info('GUI', gui);

    this.last_frame_time = new Date().getTime();
    this.updateRenderData(render_data);
    if (render_data.settings) this.gui.setGuiSettings(render_data.settings);

    console.log('Scene init done', this);
    llog.release();
    if (render_data.on_init) {
      const on_init = Function(
        'scene',
        'render_data',
        'modules',
        render_data.on_init
      );
      on_init(this, render_data, imported_modules);
    }

    this.onResize();
    setTimeout(() => {
      if (render_data.vectors) this.gui.settings.Objects['Vectors'] = true;
      this.animate();
      if (render_data.fullscreen) this.toggleFullscreen();
    }, 100);
  }

  init(element, render_data, webgl_args = {}) {
    this.initCanvas(element, webgl_args);
    this.initRenderData(render_data);
  }

  // called on scene.Redraw() from Python
  updateRenderData(render_data) {
    this.render_data = render_data;
    this.setRenderData(render_data);
  }

  setRenderData(render_data) {
    for (let i = 0; i < this.render_objects.length; i++)
      if (this.render_objects[i] != null)
        this.render_objects[i].updateRenderData(render_data);

    if (render_data.autoscale) this.gui.updateColormapToAutoscale();
    this.animate();
  }

  interpolateRenderData(rd, rd2, t) {
    const t1 = 1.0 - t;
    const mix = (a, b) => t1 * a + t * b;

    for (let i = 0; i < this.render_objects.length; i++)
      this.render_objects[i].updateRenderData(rd, rd2, t);

    if (rd.autoscale && (rd.draw_surf || rd.draw_vol)) {
      const cmin = mix(rd.funcmin, rd2.funcmin);
      const cmax = mix(rd.funcmax, rd2.funcmax);
      this.gui.settings_default.Colormap.min = cmin;
      this.gui.settings_default.Colormap.max = cmax;

      this.gui.settings.Colormap.min = cmin;
      this.gui.settings.Colormap.max = cmax;
      this.gui.c_cmin.updateDisplay();
      this.gui.c_cmax.updateDisplay();

      if (cmax > cmin) this.gui.setStepSize(cmin, cmax);
    }

    this.animate();
  }

  setCenterTag(position = null) {
    if (this.center_tag != null) {
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
      const s = 0.01 / this.controls.mesh_radius;

      this.center_tag.scale.set(s, s, s);
      this.center_tag.position.copy(position);
      this.center_tag.renderOrder = 1;
    }
  }

  async getMeshIndex(x, y) {
    this.cancelAnimation();
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

      // render to get function value (face index for mesh rendering)
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
      const Misc = this.gui.settings.Misc;
      this.uniforms.line_thickness.value = Misc.line_thickness * 4;
      this.renderObjects('select');
      this.uniforms.line_thickness.value = Misc.line_thickness / h;
      const gl = this.context;
      this.context.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixels);
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
    }
    return { dim, index };
  }

  getPixelCoordinates(x: number, y: number) {
    this.cancelAnimation();
    const rect = this.renderer.domElement.getBoundingClientRect();

    this.camera.setViewOffset(
      this.renderer.domElement.width,
      this.renderer.domElement.height,
      ((x - rect.left) * window.devicePixelRatio) | 0,
      ((y - rect.top) * window.devicePixelRatio) | 0,
      1,
      1
    );
    this.renderer.setRenderTarget(this.render_target);
    this.renderer.setClearColor(new THREE.Color(1.0, 1.0, 1.0));
    this.renderer.clear(true, true, true);
    this.renderObjects('locate');

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

    this.renderer.setRenderTarget(null);
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
    const camera = mode === 'overlay' ? this.ortho_camera : this.camera;

    const data = {
      camera,
      canvas: this.canvas,
      context: this.context,
      clipping_plane: this.three_clipping_plane,
      controls: this.controls,
      gui_status: this.gui.settings,
      mode,
      renderer: this.renderer,
    };

    if (mode == 'locate') this.uniforms.function_mode.value = 8;
    else if (mode === 'select') this.uniforms.function_mode.value = 7;
    else this.uniforms.function_mode.value = this.gui.settings.eval;

    for (const obj of this.render_objects_per_mode[mode]) {
      obj.render(data);
    }
  }

  setClippingPlane() {
    const {
      gui: {
        settings: { deformation, Clipping },
      },
      uniforms,
    } = this;

    const three_clipping_plane = this.three_clipping_plane;
    three_clipping_plane.normal.set(Clipping.x, Clipping.y, Clipping.z);
    three_clipping_plane.normal.normalize();
    three_clipping_plane.constant =
      Clipping.dist - three_clipping_plane.normal.dot(this.mesh_center);

    this.clipping_plane.set(
      three_clipping_plane.normal.x,
      three_clipping_plane.normal.y,
      three_clipping_plane.normal.z,
      three_clipping_plane.constant
    );
    this.renderer.clippingPlanes = [];

    const world_clipping_plane = three_clipping_plane.clone();

    world_clipping_plane.constant = Clipping.dist;

    uniforms.do_clipping.value = Clipping.enable;

    if (this.have_deformation || this.have_z_deformation)
      uniforms.deformation.value = deformation;

    if (Clipping.enable) this.renderer.clippingPlanes = [world_clipping_plane];
  }

  calcSize() {
    const w = this.element.parentNode.clientWidth;
    const h = this.element.parentNode.clientHeight - this.heightMargin;
    return { w, h };
  }

  isVisible() {
    const { w, h } = this.calcSize();
    return w > 0 && h > 0 && !this.hidden;
  }

  checkResize() {
    const { w, h } = this.calcSize();
    return w > 0 && h > 0 && (this.width != w || this.height != h);
  }

  render() {
    this.requestId = 0;
    if (!this.isVisible()) return;
    if (this.checkResize()) {
      this.onResize();
      return; // resize triggers new frame
    }

    const now = new Date().getTime();
    const frame_time = 0.001 * (now - this.last_frame_time);

    const settings = this.gui.settings;
    const { Colormap, Light, Misc, Complex } = settings;

    if (this.ortho_camera === undefined) return; // not fully initialized yet

    this.handleEvent('beforerender', [this, frame_time]);

    const { uniforms } = this;

    const h = this.renderer.domElement.height;
    uniforms.line_thickness.value = Misc.line_thickness / h;

    this.setClippingPlane();

    if (Colormap.ncolors) {
      uniforms.colormap_min.value = Colormap.min;
      uniforms.colormap_max.value = Colormap.max;
    }

    if (this.is_complex) {
      uniforms.complex_scale.value.x = Math.cos(-Complex.phase);
      uniforms.complex_scale.value.y = Math.sin(-Complex.phase);
    }

    uniforms.function_mode.value = settings.eval;
    uniforms.light_mat.value.x = Light.ambient;
    uniforms.light_mat.value.y = Light.diffuse;
    uniforms.light_mat.value.z = Light.shininess;
    uniforms.light_mat.value.w = Light.specularity;

    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(new THREE.Color(1.0, 1.0, 1.0));
    this.renderer.clear(true, true, true);

    this.renderObjects('update');
    this.renderObjects('default');

    this.renderer.clippingPlanes = [];

    this.renderObjects('no_clipping');
    // // render after clipping
    // if (this.center_tag != null) {
    //   this.renderer.render(this.center_tag, this.camera);
    // }

    this.renderObjects('overlay');

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
