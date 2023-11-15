import { getShader, readB64, mixB64, MAX_SUBDIVISION } from './utils';
import { RenderObject } from './render_object';

import * as THREE from 'three';

function makeEdgeColorsTexture(colors) {
  // Drawing only a mesh -> colors are given explicitly in render data (or just use green)
  let n_colors = colors.length;
  const width = Math.min(n_colors, 1024);
  const height = Math.floor((n_colors + (width - 1)) / width);
  n_colors = width * height;
  console.log('texture size', n_colors, width, height);
  const colormap_data = new Float32Array(4 * n_colors);

  for (let i = 0; i < 4 * n_colors; i++) {
    if (i % 4 == 3) colormap_data[i] = 1.0;
    else colormap_data[i] = 0.0;
  }

  for (let i = 0; i < colors.length; i++) {
    for (let k = 0; k < 3; k++) colormap_data[4 * i + k] = colors[i][k];
    colormap_data[4 * i + 3] = colors[i].length > 3 ? colors[i][3] : 1.0;
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

export class ThickEdgesObject extends RenderObject {
  have_deformation: boolean;
  have_z_deformation: boolean;
  geometry: THREE.BufferGeometry;
  colormap: THREE.DataTexture;

  constructor(data, global_uniforms, path = []) {
    super(data, global_uniforms, path);
    const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
    const have_z_deformation = data.mesh_dim == 2 && data.funcdim > 0;

    const geo = new THREE.InstancedBufferGeometry();

    const inst = new Float32Array((MAX_SUBDIVISION + 1) * 2 * 3 * 2);
    for (let i = 0; i <= 20; i++) {
      const i0 = 12 * i;
      inst[i0 + 0] = i;
      inst[i0 + 2] = i;
      inst[i0 + 4] = i + 1;
      inst[i0 + 6] = i + 1;
      inst[i0 + 8] = i + 1;
      inst[i0 + 10] = i;

      inst[i0 + 1] = 1;
      inst[i0 + 3] = -1;
      inst[i0 + 5] = -1;
      inst[i0 + 7] = -1;
      inst[i0 + 9] = 1;
      inst[i0 + 11] = 1;
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(inst, 2));
    this.uniforms.n_segments = new THREE.Uniform(5);

    const defines = Object({ ORDER: data.order2d });
    if (data.edge_colors) {
      defines.HAVE_COLORS = 1;
    }
    this.updateTexture();
    if (have_deformation) defines.DEFORMATION = 1;
    else if (have_z_deformation) defines.DEFORMATION_2D = 1;
    defines.THICK_LINES = 1;
    const wireframe_material = new THREE.RawShaderMaterial({
      vertexShader: getShader('splines.vert', defines),
      fragmentShader: getShader('splines.frag', defines),
      uniforms: this.uniforms,
    });
    this.three_object = new THREE.Mesh(geo, wireframe_material);
    this.three_object.matrixWorldAutoUpdate = false;
    this.geometry = geo;
    this.name = 'Edges';
  }

  updateTexture() {
    const data = this.data;
    if (data.edge_colors) {
      this.colormap = makeEdgeColorsTexture(data.edge_colors);
      this.uniforms.edges_colormap = new THREE.Uniform(this.colormap);
      this.uniforms.edges_colormap_min = new THREE.Uniform(0.0);
      this.uniforms.edges_colormap_max = new THREE.Uniform(1.0);
      this.uniforms.edges_colormap_size = new THREE.Uniform(
        new THREE.Vector2(this.colormap.image.width, this.colormap.image.height)
      );
    }
  }

  render(data) {
    if (!this.update(data)) return;
    if (data.gui_status.Misc.subdivision !== undefined) {
      const sd = data.gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, 6 * sd);
    }
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
    data2 = data2 && this.extractData(data2);
    const geo = this.geometry;
    const pdata = data.edges;
    const pdata2 = data2 && data2.edges;
    const do_interpolate = t !== undefined;

    const pnames = [];
    const vnames = [];
    const o = data.order2d;
    for (let i = 0; i < o + 1; i++) {
      pnames.push('p' + i);
      vnames.push('v' + i);
    }

    const get_values = (i, ncomps) => {
      const vals = do_interpolate
        ? mixB64(pdata[i], pdata2[i], t)
        : readB64(pdata[i]);
      return new THREE.InstancedBufferAttribute(vals, ncomps);
    };

    for (let i = 0; i < o + 1; i++)
      geo.setAttribute(pnames[i], get_values(i, 4));

    geo._maxInstanceCount = readB64(pdata[0]).length / 4;
    geo.instanceCount = geo._maxInstanceCount;
    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
    this.updateTexture();
  }
}

export class FieldLinesObject extends RenderObject {
  geometry: THREE.BufferGeometry;

  constructor(data, uniforms, path) {
    super(data, uniforms, path);
    const geo = new THREE.InstancedBufferGeometry();
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    cyl.translate(0, 0.5, 0);
    geo.setIndex(cyl.getIndex());
    geo.setAttribute('position', cyl.getAttribute('position'));
    geo.setAttribute('normal', cyl.getAttribute('normal'));
    geo.setAttribute('uv', cyl.getAttribute('uv'));

    this.uniforms.thickness = new THREE.Uniform(this.data.thickness);
    const defines = {};
    const material = new THREE.RawShaderMaterial({
      vertexShader: getShader('fieldlines.vert', defines),
      fragmentShader: getShader(
        'function.frag',
        defines,
        data.user_eval_function
      ),
      side: THREE.DoubleSide,
      uniforms: uniforms,
    });

    this.three_object = new THREE.Mesh(geo, material);
    this.three_object.frustumCulled = false;
    this.three_object.matrixWorldAutoUpdate = false;
    this.geometry = geo;
  }

  updateRenderData(data) {
    this.data = this.extractData(data);
    const setAttribute = (name: string, num_components: number) => {
      const vals = new Float32Array(this.data[name]);
      const attr = new THREE.InstancedBufferAttribute(vals, num_components);
      this.geometry.setAttribute(name, attr);
    };
    setAttribute('pstart', 3);
    setAttribute('pend', 3);
    setAttribute('value', 1);
    this.geometry.instanceCount = this.data.value.length;
  }
}

export class LinesObject extends RenderObject {
  geometry: THREE.BufferGeometry;

  constructor(data, uniforms, path) {
    super(data, uniforms, path);
    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.data.position, 3)
    );
    const color = this.data.color || 0x000000;

    const material = new THREE.LineBasicMaterial({ color });

    this.geometry = geo;
    this.three_object = new THREE.LineSegments(geo, material);
    this.three_object.matrixWorldAutoUpdate = false;
  }

  updateRenderData(data) {
    this.data = this.extractData(data);
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.data.position, 3)
    );
  }
}

export class PointsObject extends RenderObject {
  geometry: THREE.BufferGeometry;

  constructor(data, uniforms, path) {
    super(data, uniforms, path);
    const color = new THREE.Color(this.data.color || 0x808080);
    const n = 101;
    const tdata = new Uint8Array(4 * n * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const dist =
          (n * n) / 4 - ((i - n / 2) * (i - n / 2) + (j - n / 2) * (j - n / 2));
        if (dist > 0.0) {
          tdata[4 * (i * n + j) + 0] = color.r * 255;
          tdata[4 * (i * n + j) + 1] = color.g * 255;
          tdata[4 * (i * n + j) + 2] = color.b * 255;
          tdata[4 * (i * n + j) + 3] = 255;
        } else {
          for (let k = 0; k < 4; k++) tdata[4 * (i * n + j) + k] = 0;
        }
      }

    const texture = new THREE.DataTexture(
      tdata,
      n,
      n,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.needsUpdate = true;
    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.data.position, 3)
    );
    const size = this.data.size || 15;

    const material = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      map: texture,
      alphaTest: 0.5,
    });

    this.three_object = new THREE.Points(geo, material);
    this.three_object.matrixWorldAutoUpdate = false;
    this.geometry = geo;
  }

  updateRenderData(data) {
    this.data = this.extractData(data);
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.data.position, 3)
    );
  }
}
