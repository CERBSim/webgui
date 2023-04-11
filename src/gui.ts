import * as dat from 'dat.gui';
console.log('dat', dat);

export class GUI extends dat.GUI {
  gui;
  container;
  gui_status;
  gui_status_default;
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

    const gui_status_default = {
      eval: 0,
      subdivision: 5,
      edges: true,
      mesh: true,
      elements: true,
      deformation: 0.0,
      show_grid: false,
      line_thickness: 5,
      Multidim: { t: 0.0, multidim: 0, animate: false, speed: 2 },
      Complex: { phase: 0.0, deform: 0.0, animate: false, speed: 2 },
      Colormap: {
        autoscale: true,
        ncolors: 8,
        min: -1.0,
        max: 1.0,
      },
      Clipping: {
        enable: false,
        function: true,
        x: 0.0,
        y: 0.0,
        z: 1.0,
        dist: 0.0,
      },
      Light: { ambient: 0.3, diffuse: 0.7, shininess: 10, specularity: 0.3 },
      Vectors: { show: false, grid_size: 10, offset: 0.0 },
      Misc: {
        stats: '-1',
        reduce_subdivision: false,
        version: true,
        axes: true,
        colormap: true,
      },
      axes_labels: ['X', 'Y', 'Z'],
      ...data.gui_settings,
    };
    this.gui_status_default = gui_status_default;
    if (Math.max(data.order2d, data.order3d) <= 1)
      gui_status_default.subdivision = 1;

    const gui_status = JSON.parse(JSON.stringify(gui_status_default)); // deep-copy settings
    this.gui_status = gui_status;
    this.gui_functions = { ...gui_functions };
    this.gui_colormap = this.addFolder('Colormap');

    for (const name in this.gui_functions) this.add(this.gui_functions, name);

    if (data.draw_vol || data.draw_surf) {
      const cmin = data.funcmin;
      const cmax = data.funcmax;
      gui_status.Colormap.min = cmin;
      gui_status.Colormap.max = cmax;
      gui_status_default.Colormap.min = cmin;
      gui_status_default.Colormap.max = cmax;
      gui_status_default.Colormap.autoscale = data.autoscale || false;

      gui_status.autoscale = this.gui_status_default.autoscale;
      this.c_autoscale = this.gui_colormap.add(
        gui_status.Colormap,
        'autoscale'
      );
      this.c_cmin = this.gui_colormap.add(gui_status.Colormap, 'min');
      this.c_cmin.onChange(this.onchange);
      this.c_cmax = this.gui_colormap.add(gui_status.Colormap, 'max');
      this.c_cmax.onChange(this.onchange);

      this.c_autoscale.onChange((checked) => {
        if (checked) this.updateColormapToAutoscale();
      });

      if (cmax > cmin) this.setStepSize(cmin, cmax);

      this.add(gui_status, 'colormap_ncolors', 2, 32, 1).onChange(
        this.onchange
      );
    }
  }

  get colormap() {
    return {
      min: this.gui_status.Colormap.min,
      max: this.gui_status.Colormap.max,
      ncolors: this.gui_status.Colormap.ncolors,
    };
  }

  updateColormapToAutoscale() {
    const s = this.gui_status;
    const def = this.gui_status_default;
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
