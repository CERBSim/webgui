import * as dat from 'dat.gui';

export interface MultidimSettings {
  t: number;
  multidim: number;
  animate: boolean;
  speed: number;
}

export interface ComplexSettings {
  phase: number;
  deform: number;
  animate: boolean;
  speed: number;
}

export interface ColormapSettings {
  autoscale: boolean;
  ncolors: number;
  min: number;
  max: number;
}

export interface ClippingSettings {
  enable: boolean;
  function: boolean;
  x: number;
  y: number;
  z: number;
  dist: number;
}

export interface LightSettings {
  ambient: number;
  diffuse: number;
  shininess: number;
  specularity: number;
}

export interface VectorsSettings {
  show: boolean;
  grid_size: number;
  offset: number;
}

export interface MiscSettings {
  line_thickness: number;
  subdivision: number;
  fast_draw: boolean;
}

export class GuiSettings {
  eval = 0;
  edges = true;
  mesh = true;
  elements = true;
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
  };
  Objects: { [key: string]: boolean };

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
    cloned.axes_labels = [...this.axes_labels];

    return cloned;
  }

  update(settings: Partial<GuiSettings>): void {
    Object.assign(this, settings);
  }
}

export class GUI extends dat.GUI {
  gui: dat.GUI;
  container;
  settings: GuiSettings = new GuiSettings();
  settings_default: GuiSettings = new GuiSettings();
  gui_container;
  gui_functions;
  gui_colormap;
  c_autoscale;
  c_eval;
  c_cmin;
  c_cmax;
  onchange;

  destroy() {
    if (this.gui_container != undefined)
      this.container.removeChild(this.gui_container);
  }

  constructor(container, data, onchange, options_ = {}, gui_functions = {}) {
    const options = {
      autoPlace: false,
      closeOnTop: true,
      closed: true,
      ...options_,
    };
    super(options);
    this.onchange = onchange;
    this.container = container;

    const gui_container = document.createElement('div');
    gui_container.setAttribute(
      'style',
      'position: absolute; z-index: 2; display:block; right: 0px; top: 0px'
    );

    gui_container.appendChild(this.domElement);
    this.container.appendChild(gui_container);
    this.gui_container = gui_container;
    this.closed = true;

    const settings_default = this.settings_default;
    settings_default.update(data.gui_settings);
    if (Math.max(data.order2d, data.order3d) <= 1)
      settings_default.Misc.subdivision = 1;

    const settings = settings_default.clone();
    this.settings = settings;
    this.gui_functions = { ...gui_functions };

    for (const name in this.gui_functions) this.add(this.gui_functions, name);
    this.gui_colormap = this.addFolder('Colormap');

    if (data.draw_vol || data.draw_surf) {
      const cmin = data.funcmin;
      const cmax = data.funcmax;
      settings.Colormap.min = cmin;
      settings.Colormap.max = cmax;
      settings_default.Colormap.min = cmin;
      settings_default.Colormap.max = cmax;
      settings_default.Colormap.autoscale = data.autoscale || false;

      settings.Colormap.autoscale = this.settings_default.Colormap.autoscale;
      this.c_autoscale = this.gui_colormap.add(settings.Colormap, 'autoscale');
      this.c_cmin = this.gui_colormap.add(settings.Colormap, 'min');
      this.c_cmin.onChange(this.onchange);
      this.c_cmax = this.gui_colormap.add(settings.Colormap, 'max');
      this.c_cmax.onChange(this.onchange);

      this.c_autoscale.onChange((checked) => {
        if (checked) this.updateColormapToAutoscale();
      });

      if (cmax > cmin) this.setStepSize(cmin, cmax);

      this.gui_colormap
        .add(settings.Colormap, 'ncolors', 2, 32, 1)
        .onChange(this.onchange);
    }
  }

  get colormap() {
    return {
      min: this.settings.Colormap.min,
      max: this.settings.Colormap.max,
      ncolors: this.settings.Colormap.ncolors,
    };
  }

  updateColormapToAutoscale() {
    const s = this.settings;
    const def = this.settings_default;
    if (s.eval == 3) {
      // drawing norm -> min is 0
      s.Colormap.min = 0.0;
      s.Colormap.max = Math.max(def.Colormap.max, def.Colormap.min);
    } else {
      s.Colormap.min = def.Colormap.min;
      s.Colormap.max = def.Colormap.max;
    }
    this.c_cmin.updateDisplay();
    this.c_cmax.updateDisplay();
    this.onchange();
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
