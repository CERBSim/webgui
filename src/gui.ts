import * as dat from 'dat.gui';
import { setKeys } from './utils';

export interface MultidimSettings {
  [key: string]: number | string | boolean;
  t: number;
  multidim: number;
  animate: boolean;
  speed: number;
}

export interface ComplexSettings {
  [key: string]: number | string | boolean;
  phase: number;
  deform: number;
  animate: boolean;
  speed: number;
}

export interface ColormapSettings {
  [key: string]: number | boolean;
  autoscale: boolean;
  ncolors: number;
  min: number;
  max: number;
}

export interface ClippingSettings {
  [key: string]: number | boolean;
  enable: boolean;
  function: boolean;
  x: number;
  y: number;
  z: number;
  dist: number;
}

export interface LightSettings {
  [key: string]: number;
  ambient: number;
  diffuse: number;
  shininess: number;
  specularity: number;
}

export interface VectorsSettings {
  [key: string]: number | boolean;
  show: boolean;
  grid_size: number;
  offset: number;
}

export interface MiscSettings {
  [key: string]: number | boolean | (() => void);
  line_thickness: number;
  subdivision: number;
  fast_draw: boolean;
}

export class GuiSettings {
  [key: string]: unknown;
  eval = 0;
  deformation = 0.0;
  Multidim: MultidimSettings = {
    t: 0.0,
    multidim: 0,
    animate: false,
    speed: 2,
  };
  Complex: ComplexSettings = {
    phase: 0.0,
    deform: 0.0,
    animate: false,
    speed: 2,
  };
  Colormap: ColormapSettings = {
    autoscale: true,
    ncolors: 8,
    min: -1.0,
    max: 1.0,
  };
  Clipping: ClippingSettings = {
    enable: false,
    function: true,
    x: 0.0,
    y: 0.0,
    z: 1.0,
    dist: 0.0,
  };
  Light: LightSettings = {
    ambient: 0.3,
    diffuse: 0.7,
    shininess: 10,
    specularity: 0.3,
  };
  Vectors: VectorsSettings = { show: false, grid_size: 10, offset: 0.0 };
  Misc: MiscSettings = {
    line_thickness: 5,
    subdivision: 5,
    fast_draw: false,
    // 'reset settings': () => {
    //   /* do nothing */
    // },
    // 'copy euler angles': () => {
    //   console.log('copy euler angles, default init');
    //   /* do nothing */
    // },
    // 'store settings': () => {
    //   /* do nothing */
    // },
    // 'load settings': () => {
    //   /* do nothing */
    // },
  };

  Objects: { [key: string]: boolean } = {};

  axes_labels: string[] = ['X', 'Y', 'Z'];

  clone(): GuiSettings {
    const cloned = new GuiSettings();

    cloned.eval = this.eval;
    cloned.edges = this.edges;
    cloned.mesh = this.mesh;
    cloned.elements = this.elements;
    cloned.deformation = this.deformation;
    cloned.Multidim = { ...this.Multidim };
    cloned.Complex = { ...this.Complex };
    cloned.Colormap = { ...this.Colormap };
    cloned.Clipping = { ...this.Clipping };
    cloned.Light = { ...this.Light };
    cloned.Vectors = { ...this.Vectors };
    cloned.Misc = { ...this.Misc };
    cloned.Objects = { ...this.Objects };
    cloned.axes_labels = [...this.axes_labels];

    return cloned;
  }

  update(settings: Partial<GuiSettings>): void {
    Object.assign(this, settings);
  }
}

function updateSettings(s, def) {
  s.Colormap = s.Colormap ? s.Colormap : { ...def.Colormap };
  s.Misc = s.Misc ? s.Misc : { ...def.Misc };
  s.Objects = { ...def.Objects, ...(s.Objects ? s.Objects : {}) };

  if (s.autoscale !== undefined) s.Colormap.autoscale = s.autoscale;
  if (s.colormap_min !== undefined) s.Colormap.min = s.colormap_min;
  if (s.colormap_max !== undefined) s.Colormap.max = s.colormap_max;
  if (s.colormap_ncolors !== undefined) s.Colormap.ncolors = s.colormap_ncolors;

  if (s.subdivision !== undefined) s.Misc.subdivision = s.subdivision;
  if (s.line_thickness !== undefined) s.Misc.line_thickness = s.line_thickness;

  if (s.Misc && s.Misc.reduce_subdivision !== undefined)
    s.Misc.fast_draw = s.Misc.reduce_subdivision;

  if (s.edges !== undefined) s.Objects.Edges = s.edges;
  if (s.mesh !== undefined) s.Objects.Wireframe = s.mesh;
  if (s.elements !== undefined) s.Objects.Surface = s.elements;

  delete s.edges;
  delete s.mesh;
  delete s.elements;

  delete s.subdivision;
  delete s.autoscale;
  delete s.colormap_min;
  delete s.colormap_max;
  delete s.colormap_ncolors;
  delete s.line_thickness;
  delete s.Misc.reduce_subdivision;

  return s;
}

export class GUI extends dat.GUI {
  gui: dat.GUI;
  container;
  scene;
  settings: GuiSettings = new GuiSettings();
  settings_default: GuiSettings = new GuiSettings();
  gui_container;
  gui_functions;
  gui_colormap;
  gui_misc;
  gui_objects;
  c_autoscale;
  c_eval;
  c_cmin;
  c_cmax;
  onchange;

  phase_controller;
  multidim_controller;

  destroy() {
    if (this.gui_container != undefined)
      this.container.removeChild(this.gui_container);
  }

  constructor(container, scene, onchange, options_ = {}, gui_functions = {}) {
    const options = {
      autoPlace: false,
      closeOnTop: true,
      closed: true,
      ...options_,
    };
    super(options);
    this.onchange = onchange;
    this.container = container;
    this.scene = scene;

    const gui_container = document.createElement('div');
    gui_container.setAttribute(
      'style',
      'position: absolute; z-index: 2; display:block; right: 0px; top: 0px'
    );

    gui_container.appendChild(this.domElement);
    this.container.appendChild(gui_container);
    this.gui_container = gui_container;
    this.closed = true;
    const data = scene.render_data;
    const settings_default = this.settings_default;
    if (Math.max(data.order2d, data.order3d) <= 1)
      settings_default.Misc.subdivision = 1;

    const settings = settings_default.clone();
    this.settings = settings;
    this.gui_functions = { ...gui_functions };

    this.initFunctions();
    this.initObjects();
    this.initColormap();
    this.initClipping();
    this.initComplex();
    this.initMultidim();
    this.initDeformation();
    this.initVectors();
    this.initMisc();
    this.initLight();

    if (data.gui_settings) {
      const s = data.gui_settings;
      updateSettings(s, settings_default);
      this.setGuiSettings(s);
      settings_default.update(s);
    }

    scene.on('afterrender', (_, frame_time: number) => {
      if (settings.Complex.animate) {
        settings.Complex.phase += frame_time * settings.Complex.speed;
        if (settings.Complex.phase > 2 * Math.PI)
          settings.Complex.phase -= 2 * Math.PI;

        this.phase_controller.updateDisplay();
      }
      if (settings.Multidim.animate) {
        settings.Multidim.t += frame_time * settings.Multidim.speed;
        // For discrete multidim data, we need to extend the length by .99 to not skip last value
        if (
          settings.Multidim.t >
          scene.render_data.multidim_data.length +
            (scene.render_data.multidim_interpolate ? 0.0 : 0.99)
        )
          settings.Multidim.t = 0.0;

        this.multidim_controller.updateDisplay();
        this.multidim_controller.__onChange();
      }
      if (settings.Complex.animate || settings.Multidim.animate)
        this.onchange();
    });
  }

  getGuiSettings() {
    const settings = JSON.parse(JSON.stringify(this.settings)); // deep-copy settings
    settings.camera = {};
    this.scene.controls.storeSettings(settings.camera);
    return JSON.parse(JSON.stringify(settings));
  }

  setGuiSettings(settings) {
    setKeys(this.settings, settings);

    if (settings.camera) this.scene.controls.loadSettings(settings.camera);

    for (const i in this.__controllers) this.__controllers[i].updateDisplay();
    for (const f in this.__folders) {
      const folder = this.__folders[f];
      for (const i in folder.__controllers)
        folder.__controllers[i].updateDisplay();
    }
    this.onchange();
  }

  initObjects() {
    this.gui_objects = this.addFolder('Objects');
    this.gui_objects.open();
  }

  initColormap() {
    const scene = this.scene;
    const data = scene.render_data;

    const cmap = (this.gui_colormap = this.addFolder('Colormap'));
    const settings = this.settings.Colormap;
    const settings_default = this.settings_default.Colormap;

    if (scene.mesh_only) {
      settings_default.min = -0.5;
      settings_default.max = data.mesh_regions_2d - 0.5;
      settings.min = -0.5;
      settings.max = data.mesh_regions_2d - 0.5;
    }

    if (!data.draw_vol && !data.draw_surf) return;
    const cmin = data.funcmin;
    const cmax = data.funcmax;
    settings.min = cmin;
    settings.max = cmax;
    settings_default.min = cmin;
    settings_default.max = cmax;

    settings.autoscale = settings_default.autoscale;
    this.c_autoscale = cmap.add(settings, 'autoscale');
    this.c_cmin = cmap.add(settings, 'min');
    this.c_cmin.onChange(() => {
      settings.autoscale = false;
      this.onchange();
    });
    this.c_cmax = cmap.add(settings, 'max');
    this.c_cmin.onChange(() => {
      settings.autoscale = false;
      this.onchange();
    });

    if (settings.min > settings.max)
      this.setStepSize(settings.min, settings.max);

    this.c_autoscale.onChange((checked: boolean) => {
      if (checked) this.updateColormapToAutoscale();
      this.onchange();
    });

    cmap.add(settings, 'ncolors', 2, 32, 1).onChange(this.onchange);
  }

  updateColormapToAutoscale() {
    const { draw_surf, draw_vol, funcmin, funcmax } = this.data;
    const { settings } = this;
    const colormap = settings.Colormap;

    if (colormap.autoscale && (draw_surf || draw_vol)) {
      const cmin = funcmin;
      const cmax = funcmax;
      colormap.min = cmin;
      colormap.max = cmax;

      if (settings.eval == 3) {
        // norm of vector-valued function
        colormap.min = 0;
        colormap.max = Math.max(Math.abs(cmin), Math.abs(cmax));
      } else {
        colormap.min = cmin;
        colormap.max = cmax;
      }
      this.c_cmin.updateDisplay();
      this.c_cmax.updateDisplay();

      if (cmax > cmin) this.setStepSize(cmin, cmax);
    }
  }

  get data() {
    return this.scene.render_data;
  }

  initClipping() {
    const { scene, settings, settings_default } = this;
    const data = scene.render_data;

    if (data.mesh_dim != 3) return;

    const gui_clipping = this.addFolder('Clipping');
    const clipping = settings.Clipping;
    const clipping_default = settings_default.Clipping;

    if (data.clipping) {
      clipping_default.enable = true;
      clipping.enable = true;
      if (data.clipping_x != undefined) {
        clipping_default.x = data.clipping_x;
        clipping.x = data.clipping_x;
      }
      if (data.clipping_y != undefined) {
        clipping_default.y = data.clipping_y;
        clipping.y = data.clipping_y;
      }
      if (data.clipping_z != undefined) {
        clipping_default.z = data.clipping_z;
        clipping.z = data.clipping_z;
      }
      if (data.clipping_dist != undefined) {
        clipping_default.dist = data.clipping_dist;
        clipping.dist = data.clipping_dist;
      }
      if (data.clipping_function != undefined)
        settings.Objects['Clipping Plane'] = Boolean(data.clipping_function);
    }

    gui_clipping.add(clipping, 'enable').onChange(this.onchange);
    gui_clipping.add(clipping, 'x', -1.0, 1.0).onChange(this.onchange);
    gui_clipping.add(clipping, 'y', -1.0, 1.0).onChange(this.onchange);
    gui_clipping.add(clipping, 'z', -1.0, 1.0).onChange(this.onchange);
    gui_clipping
      .add(clipping, 'dist', -1.2 * scene.mesh_radius, 1.2 * scene.mesh_radius)
      .onChange(this.onchange);
  }

  initLight() {
    const light = this.settings.Light;
    const gui_light = this.addFolder('Light');
    gui_light.add(light, 'ambient', 0.0, 1.0).onChange(this.onchange);
    gui_light.add(light, 'diffuse', 0.0, 1.0).onChange(this.onchange);
    gui_light.add(light, 'shininess', 0.0, 100.0).onChange(this.onchange);
    gui_light.add(light, 'specularity', 0.0, 1.0).onChange(this.onchange);
  }
  initMisc() {
    const misc = this.settings.Misc;
    console.log('misc', misc);
    const gui_misc = this.addFolder('Misc');
    gui_misc.add(misc, 'subdivision', 1, 20, 1).onChange(this.onchange);
    if (this.scene.render_data.edges.length) {
      gui_misc.add(misc, 'line_thickness', 1, 20, 1).onChange(this.onchange);
    }
    misc['reset settings'] = () => {
      this.setGuiSettings(this.settings_default);
    };
    misc['store settings'] = () => {
      document.cookie =
        'gui_status=' + btoa(JSON.stringify(this.getGuiSettings()));
    };
    misc['copy euler angles'] = () => {
      const angles = JSON.stringify(this.scene.controls.getEulerAngles());
      console.log("euler angles: ", angles);
      navigator.clipboard.writeText(angles);
    };
    misc['load settings'] = () => {
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

    gui_misc.add(misc, 'fast_draw');
    gui_misc.add(misc, 'copy euler angles');
    gui_misc.add(misc, 'store settings');
    gui_misc.add(misc, 'load settings');
    this.gui_misc = gui_misc;
  }

  initFunctions() {
    const { gui_functions } = this;
    gui_functions['Reset'] = () => {
      this.scene.controls.reset();
    };
    for (const name in gui_functions)
      this.add(gui_functions, name).onChange(this.onchange);
  }

  initVectors() {
    const { data, settings, settings_default } = this;

    const vectors = settings.Vectors;
    const vectors_default = settings_default.Vectors;
    let draw_vectors = data.funcdim > 1 && !data.is_complex;
    draw_vectors =
      draw_vectors &&
      ((data.draw_surf && data.mesh_dim == 2) ||
        (data.draw_vol && data.mesh_dim == 3));
    if (draw_vectors) {
      if (data.vectors) {
        if (data.vectors_grid_size) {
          vectors_default.grid_size = data.vectors_grid_size;
          vectors.grid_size = data.vectors_grid_size;
        }
        if (data.vectors_offset) {
          vectors_default.offset = data.vectors_offset;
          vectors.offset = data.vectors_offset;
        }
      }

      const gui_vec = this.addFolder('Vectors');
      gui_vec.add(vectors, 'grid_size', 1, 100, 1).onChange(this.onchange);
      gui_vec.add(vectors, 'offset', -1.0, 1.0, 0.001).onChange(this.onchange);
    }
  }

  initComplex() {
    const { scene, data, settings, settings_default } = this;

    if (data.is_complex) {
      settings_default.eval = 5;
      settings.eval = 5;
      this.c_eval = this.add(settings, 'eval', {
        real: 5,
        imag: 6,
        norm: 3,
      });

      const cgui = this.addFolder('Complex');
      this.phase_controller = cgui
        .add(settings.Complex, 'phase', 0, 2 * Math.PI, 0.001)
        .onChange(this.onchange);
      cgui.add(settings.Complex, 'animate').onChange(() => {
        scene.last_frame_time = new Date().getTime();
        this.onchange();
      });
      cgui
        .add(settings.Complex, 'speed', 0.0, 10, 0.0001)
        .onChange(this.onchange);
    } else if (data.funcdim == 2) {
      settings.eval = 3;
      this.c_eval = this.add(settings, 'eval', {
        '0': 0,
        '1': 1,
        norm: 3,
      });
    } else if (data.funcdim == 3) {
      settings.eval = 3;
      this.c_eval = this.add(settings, 'eval', {
        '0': 0,
        '1': 1,
        '2': 2,
        norm: 3,
      });
    }

    if (this.c_eval) {
      if (data.eval != undefined) {
        this.settings.eval = data.eval;
        this.c_eval.setValue(data.eval);
      }
      this.c_eval.onChange(() => {
        if (settings.autoscale) this.updateColormapToAutoscale();
        else this.onchange();
      });
    }
  }

  initDeformation() {
    const scene = this.scene;
    if (scene.have_z_deformation || scene.have_deformation) {
      const deformation_scale = this.data.deformation_scale || 1.0;
      this.settings_default.deformation = this.data.deformation ? deformation_scale : 0.0;
      this.settings.deformation = this.settings_default.deformation;
      this.add(this.settings, 'deformation', 0.0, deformation_scale, deformation_scale*0.0001).onChange(
        this.onchange
      );
    }
  }

  initMultidim() {
    const scene = this.scene;
    const data = scene.render_data;
    if (data.multidim_data === undefined) return;

    const settings = this.settings.Multidim;
    const settings_default = this.settings_default.Multidim;
    const md = data.multidim_data.length;

    if (data.multidim_animate) {
      settings_default.animate = true;
      settings.animate = true;
    }
    const gui_md = this.addFolder('Multidim');
    gui_md.add(settings, 'animate').onChange(() => {
      scene.last_frame_time = new Date().getTime();
      this.onchange();
    });
    gui_md.add(settings, 'speed', 0.0, 10, 0.001).onChange(this.onchange);

    if (data.multidim_interpolate) {
      this.multidim_controller = gui_md
        .add(settings, 't', 0, md + 0.99, 0.01) // extra .99 to show the last value longer
        .onChange(() => {
          const s = settings.t;
          const n = Math.floor(s);
          const t = s - n;
          if (n == 0)
            scene.interpolateRenderData(
              scene.render_data,
              scene.render_data.multidim_data[0],
              t
            );
          else if (s == md)
            scene.setRenderData(scene.render_data.multidim_data[md - 1]);
          else
            scene.interpolateRenderData(
              scene.render_data.multidim_data[n - 1],
              scene.render_data.multidim_data[n],
              t
            );
        });
    } else {
      this.multidim_controller = gui_md
        .add(settings, 't', 0, md, 1)
        .onChange(() => {
          const t = settings.t;
          const n = Math.floor(t);
          if (n == 0) scene.setRenderData(scene.render_data);
          else scene.setRenderData(scene.render_data.multidim_data[n - 1]);
        });
    }
  }

  get colormap() {
    return {
      min: this.settings.Colormap.min,
      max: this.settings.Colormap.max,
      ncolors: this.settings.Colormap.ncolors,
    };
  }

  setStepSize(cmin, cmax) {
    if (cmin >= cmax) return 1e-8;
    const step = Math.pow(10, -4 + Math.floor(Math.log10(cmax - cmin)));
    const prec = 10;
    this.c_cmin.step(step);
    this.c_cmax.step(step);
    this.c_cmin.__precision = prec;
    this.c_cmax.__precision = prec;
  }
}
