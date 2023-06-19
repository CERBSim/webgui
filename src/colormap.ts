import * as THREE from 'three';

import { RenderObject } from './render_object';

import './styles.css';

function makeSelectedFaceTexture(
  data,
  bnds = [],
  col_selected = [0, 0.5, 1.0, 1.0],
  col_default = [0, 1, 0, 1]
) {
  const n_colors = data.mesh_regions_2d;
  const colormap_data = new Float32Array(5 * n_colors);

  for (let i = 0; i < n_colors; i++) {
    colormap_data[4 * i + 0] = col_default[0];
    colormap_data[4 * i + 1] = col_default[1];
    colormap_data[4 * i + 2] = col_default[2];
    colormap_data[4 * i + 3] = col_default[3];
  }
  for (let i = 0; i < bnds.length; i++) {
    colormap_data[4 * bnds[i] + 0] = col_selected[0];
    colormap_data[4 * bnds[i] + 1] = col_selected[1];
    colormap_data[4 * bnds[i] + 2] = col_selected[2];
    colormap_data[4 * bnds[i] + 3] = col_selected[3];
  }

  const colormap_texture = new THREE.DataTexture(
    colormap_data,
    n_colors,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  colormap_texture.magFilter = THREE.NearestFilter;
  colormap_texture.needsUpdate = true;
  return colormap_texture;
}

function makeMeshColormapTexture(data) {
  // Drawing only a mesh -> colors are given explicitly in render data (or just use green)
  let n_colors = data.mesh_regions_2d;
  const width = Math.min(n_colors, 1024);
  const height = Math.floor((n_colors + (width - 1)) / width);
  n_colors = width * height;
  console.log('texture size', n_colors, width, height);
  const colormap_data = new Float32Array(4 * n_colors);

  for (let i = 0; i < 4 * n_colors; i++) {
    if (i % 4 == 1 || i % 4 == 3) colormap_data[i] = 1.0;
    else colormap_data[i] = 0.0;
  }

  const colors = data.colors;
  if (colors) {
    for (let i = 0; i < colors.length; i++) {
      for (let k = 0; k < 3; k++) colormap_data[4 * i + k] = colors[i][k];
      colormap_data[4 * i + 3] = colors[i].length > 3 ? colors[i][3] : 1.0;
    }
  }
  const colormap_texture = new THREE.DataTexture(
    colormap_data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  colormap_texture.minFilter = THREE.NearestFilter;
  colormap_texture.magFilter = THREE.NearestFilter;
  colormap_texture.generateMipmaps = false;
  colormap_texture.needsUpdate = true;
  return colormap_texture;
}

function makeColormapTexture(n_colors) {
  const colormap_data = new Float32Array(4 * n_colors);

  const col_blue = new THREE.Vector3(0, 0, 1);
  const col_cyan = new THREE.Vector3(0, 1, 1);
  const col_green = new THREE.Vector3(0, 1, 0);
  const col_yellow = new THREE.Vector3(1, 1, 0);
  const col_red = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i < n_colors; i++) {
    const x = (1.0 / (n_colors - 1)) * i;
    let hx, color;
    if (x < 0.25) {
      hx = 4.0 * x;
      color = col_blue
        .clone()
        .multiplyScalar(1.0 - hx)
        .addScaledVector(col_cyan, hx);
    } else if (x < 0.5) {
      hx = 4.0 * x - 1.0;
      color = col_cyan
        .clone()
        .multiplyScalar(1.0 - hx)
        .addScaledVector(col_green, hx);
    } else if (x < 0.75) {
      hx = 4.0 * x - 2.0;
      color = col_green
        .clone()
        .multiplyScalar(1.0 - hx)
        .addScaledVector(col_yellow, hx);
    } else {
      hx = 4.0 * x - 3.0;
      color = col_yellow
        .clone()
        .multiplyScalar(1.0 - hx)
        .addScaledVector(col_red, hx);
    }
    colormap_data[4 * i + 0] = color.x;
    colormap_data[4 * i + 1] = color.y;
    colormap_data[4 * i + 2] = color.z;
    colormap_data[4 * i + 3] = 1.0;
  }

  const colormap_texture = new THREE.DataTexture(
    colormap_data,
    n_colors,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  colormap_texture.magFilter = THREE.NearestFilter;
  colormap_texture.needsUpdate = true;
  return colormap_texture;
}

export class Colorbar extends RenderObject {
  three_object: THREE.Object3D;
  mesh_material;
  mesh_only: boolean;
  labels;
  labels_object;
  divs;
  container;
  enabled = true;
  min_: number;
  max_: number;
  n_colors: bigint;
  label_style: string;

  constructor(data, global_uniforms, path = [], container) {
    super(data, global_uniforms, path);
    this.name = 'Colorbar';
    this.render_modes = ['overlay'];
    this.data = this.extractData(data);
    const mesh_only = this.data.funcdim == 0;
    if (mesh_only) this.enabled = false;

    let material = null;
    if (!mesh_only) {
      const geo = new THREE.PlaneGeometry(1, 0.07).translate(0.5, 0, 0);
      material = new THREE.MeshBasicMaterial({
        depthTest: false,
        side: THREE.DoubleSide,
        wireframe: false,
      });
      this.three_object = new THREE.Mesh(geo, material);
      this.three_object.autoUpdateMatrix = false;
    } else {
      this.three_object = null;
    }

    // Create 5 html div/text elements for numbers
    this.labels = [];
    this.divs = [];
    const labels_object = document.createElement('div');
    for (let i = 0; i < 5; i++) {
      const label = document.createElement('div');
      const t = document.createTextNode('');
      label.appendChild(t);
      this.divs.push(label);
      this.labels.push(t);
      labels_object.appendChild(label);
    }
    container.appendChild(labels_object);
    this.labels_object = labels_object;
    this.mesh_material = material;
    this.mesh_only = mesh_only;
    this.container = container;
    this.label_style =
      '-moz-user-select: none; -webkit-user-select: none; -ms-user-select:none; onselectstart="return false;';
    this.label_style +=
      'onmousedown="return false; user-select:none;-o-user-select:none;unselectable="on";';
    this.label_style += 'position: absolute; z-index: 1; display:block;';
  }

  cleanupHTML() {
    this.labels_object.innerHTML = '';
  }

  render(data) {
    const visible = this.update(data);
    const { gui_status } = data;
    if (
      this.min_ != gui_status.Colormap.min ||
      this.max_ != gui_status.Colormap.max ||
      this.n_colors != gui_status.Colormap.ncolors
    ) {
      this.min_ = gui_status.Colormap.min;
      this.max_ = gui_status.Colormap.max;
      this.n_colors = gui_status.Colormap.ncolors;
      this.updateTexture();
      if (!this.mesh_only) this.updateLabels();
    }
    this.labels_object.style.display = visible ? 'block' : 'none';
    if (this.three_object && visible)
      data.renderer.render(this.three_object, data.camera);
  }

  onResize(w: number, h: number) {
    if (this.mesh_only) return;
    const aspect = w / h;
    const p = new THREE.Vector3();
    this.three_object.getWorldPosition(p);
    this.three_object.translateOnAxis(p, -1.0);
    this.three_object.translateY(0.95);
    this.three_object.translateX(-0.93 * aspect);
    this.three_object.updateWorldMatrix(false, false);

    const n = this.labels.length;
    const y = Math.round(0.5 * (0.05 + 0.07) * h);
    const dx = (0.5 * w) / ((n - 1) * aspect);
    const x0 = 0.07 * 0.5 * w;
    for (let i = 0; i < n; i++) {
      const hide_label =
        i > 0 &&
        i < n - 1 &&
        ((dx < 50 && i % 2 == 1) || (dx < 30 && i % 4 == 2));
      const x = Math.round(x0 + i * dx);
      if (hide_label) this.divs[i].setAttribute('style', 'display: none');
      else
        this.divs[i].setAttribute(
          'style',
          this.label_style +
            `transform: translate(-50%, 0%); left: ${x}px; top: ${y}px`
        );
    }
  }

  updateTexture() {
    if (this.mesh_only)
      this.setTexture(makeMeshColormapTexture(this.data), true);
    else this.setTexture(makeColormapTexture(this.n_colors));
  }

  setTexture(tex, isMeshTexture = false) {
    if (isMeshTexture) {
      this.uniforms.colormap_size.value.x = tex.image.width;
      this.uniforms.colormap_size.value.y = tex.image.height;
    }

    this.uniforms.tex_colormap.value = tex;
    if (!this.mesh_only) this.mesh_material.map = tex;
  }

  updateLabels() {
    const n = this.labels.length;
    const min = this.min_;
    const inc = (this.max_ - min) / (n - 1);
    if (this.enabled)
      for (let i = 0; i < n; i++) {
        const value = min + inc * i;
        const digits = Math.ceil(
          value != 0 && inc != 0 ? Math.log10(value / inc) + 2 : 3
        );
        this.labels[i].nodeValue = (min + inc * i).toPrecision(digits);
      }
    else for (let i = 0; i < n; i++) this.labels[i].nodeValue = '';
  }

  setSelectedFace(
    bnds = [],
    col_selected = [0, 0.5, 1.0],
    col_default = [0, 1, 0]
  ) {
    this.setTexture(
      makeSelectedFaceTexture(this.data, bnds, col_selected, col_default)
    );
  }
}
