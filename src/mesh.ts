import { getShader, mixB64, readB64, MAX_SUBDIVISION } from './utils';

import { RenderObject } from './render_object';

import * as THREE from 'three';

export class MeshFunctionObject extends RenderObject {
  mesh_only: boolean;
  geometry: THREE.BufferGeometry;

  constructor(data, global_uniforms, path = []) {
    super(data, global_uniforms, path);
    const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
    const have_z_deformation = data.mesh_dim == 2 && data.funcdim > 0;
    const uniforms = {
      n_segments: new THREE.Uniform(5),
      ...global_uniforms,
    };

    const geo = new THREE.InstancedBufferGeometry();
    const position = new Float32Array(6 * MAX_SUBDIVISION * MAX_SUBDIVISION);

    // subdivision mesh
    let ii = 0;
    for (let i = 0; i < MAX_SUBDIVISION; i++) {
      for (let j = 0; j <= i; j++) {
        position[ii++] = j;
        position[ii++] = i - j;
        position[ii++] = j + 1;
        position[ii++] = i - j;
        position[ii++] = j;
        position[ii++] = i - j + 1;
      }
      for (let j = 0; j < i; j++) {
        position[ii++] = j + 1;
        position[ii++] = i - j - 1;
        position[ii++] = j + 1;
        position[ii++] = i - j;
        position[ii++] = j;
        position[ii++] = i - j;
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 2));
    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);

    const defines = Object({ MESH_2D: 1, ORDER: data.order2d });
    if (data.have_normals) defines.HAVE_NORMALS = 1;
    if (have_deformation) defines.DEFORMATION = 1;
    else if (have_z_deformation) defines.DEFORMATION_2D = 1;
    if (data.draw_surf == false) defines.NO_FUNCTION_VALUES = 1;

    const mesh_material = new THREE.RawShaderMaterial({
      vertexShader: getShader('trigsplines.vert', defines),
      fragmentShader: getShader(
        'function.frag',
        defines,
        data.user_eval_function
      ),
      side: THREE.DoubleSide,
      uniforms: uniforms,
    });

    mesh_material.polygonOffset = true;
    mesh_material.polygonOffsetFactor = 1;
    mesh_material.polygonOffsetUnits = 1;

    this.three_object = new THREE.Mesh(geo, mesh_material);
    this.three_object.matrixWorldAutoUpdate = false;
    this.three_object.name = data.name;
    this.name = 'Surface';
    this.data = data;
    this.uniforms = uniforms;
    this.geometry = geo;
  }

  render(data) {
    if (!this.update(data)) return;
    if (data.gui_status.Misc.subdivision !== undefined) {
      const sd = data.gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, 3 * sd * sd);
    }
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
    console.log('update mesh render data', data);
    const geo = this.geometry;
    const pdata = data.Bezier_trig_points;
    const pdata2 = data2 && data2.Bezier_trig_points;
    const do_interpolate = t !== undefined;
    const order = data.order2d;

    let names;
    if (order == 1) {
      names = ['p0', 'p1', 'p2'];
      if (data.draw_surf && data.funcdim > 1)
        names = names.concat(['v0', 'v1', 'v2']);
    }
    if (order == 2) {
      names = ['p00', 'p01', 'p02', 'p10', 'p11', 'p20'];
      if (data.draw_surf && data.funcdim > 1)
        names = names.concat(['vec00_01', 'vec02_10', 'vec11_20']);
    }
    if (order == 3) {
      names = [
        'p00',
        'p01',
        'p02',
        'p03',
        'p10',
        'p11',
        'p12',
        'p20',
        'p21',
        'p30',
      ];
      if (data.draw_surf && data.funcdim > 1)
        names = names.concat([
          'vec00_01',
          'vec02_03',
          'vec10_11',
          'vec12_20',
          'vec21_30',
        ]);
    }

    const get_values = (i, ncomps) => {
      const vals = do_interpolate
        ? mixB64(pdata[i], pdata2[i], t)
        : readB64(pdata[i]);
      return new THREE.InstancedBufferAttribute(vals, ncomps);
    };

    for (const i in names) geo.setAttribute(names[i], get_values(i, 4));

    if (data.have_normals)
      for (let i = 0; i < 3; i++)
        geo.setAttribute('n' + i, get_values(3 + i, 3));
    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
    geo.instanceCount = readB64(pdata[0]).length / 4;
  }
}

export class WireframeObject extends RenderObject {
  mesh_only: boolean;
  geometry: THREE.BufferGeometry;

  constructor(data, global_uniforms, path) {
    super(data, global_uniforms, path);
    const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
    const have_z_deformation = data.mesh_dim == 2 && data.funcdim > 0;
    const geo = new THREE.InstancedBufferGeometry();
    const uniforms = {
      n_segments: new THREE.Uniform(5),
      ...global_uniforms,
    };

    const inst = new Float32Array(MAX_SUBDIVISION + 1);
    for (let i = 0; i <= MAX_SUBDIVISION; i++) inst[i] = i;

    geo.setAttribute('position', new THREE.Float32BufferAttribute(inst, 1));

    const defines = Object({ ORDER: data.order2d });
    if (have_deformation) defines.DEFORMATION = 1;
    else if (have_z_deformation) defines.DEFORMATION_2D = 1;
    const wireframe_material = new THREE.RawShaderMaterial({
      vertexShader: getShader('splines.vert', defines),
      fragmentShader: getShader('splines.frag', defines),
      uniforms: uniforms,
    });

    this.three_object = new THREE.Line(geo, wireframe_material);
    this.three_object.matrixWorldAutoUpdate = false;
    this.geometry = geo;
    this.name = 'Wireframe';
  }

  render(data) {
    if (!this.update(data)) return;
    if (data.gui_status.Misc.subdivision !== undefined) {
      const sd = data.gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, sd + 1);
    }
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
    data2 = data2 && this.extractData(data2);
    const geo = this.geometry;
    const pdata = data.Bezier_points;
    const pdata2 = data2 && data2.Bezier_points;
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

    if (data.draw_surf && data.funcdim > 1)
      for (let i = 0; i < vnames.length; i++)
        geo.setAttribute(vnames[i], get_values(o + 1 + i, 2));

    geo.instanceCount = readB64(pdata[0]).length / 4;
    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
  }
}

export class ClippingFunctionObject extends RenderObject {
  geometry: THREE.BufferGeometry;

  constructor(data, uniforms, path) {
    super(data, uniforms, path);
    this.uniforms.n_segments = new THREE.Uniform(5);

    const defines = { ORDER: data.order3d, SKIP_FACE_CHECK: 1, NO_CLIPPING: 1 };
    const material = new THREE.RawShaderMaterial({
      vertexShader: getShader('clipping_vectors.vert', defines),
      fragmentShader: getShader(
        'function.frag',
        defines,
        data.user_eval_function
      ),
      side: THREE.DoubleSide,
      uniforms: this.uniforms,
    });

    const sd = MAX_SUBDIVISION;
    const nverts = 6 * sd * sd * sd;
    const vertid = new Float32Array(4 * nverts);

    let kk = 0;
    for (let i = 0; i < sd; i++) {
      for (let j = 0; j <= i; j++) {
        for (let k = 0; k <= i - j; k++) {
          for (let l = 0; l < 6; l++) {
            vertid[4 * kk + 0] = 0 * 6 + l;
            vertid[4 * kk + 1] = j;
            vertid[4 * kk + 2] = k;
            vertid[4 * kk + 3] = i - j - k;
            kk++;
          }
        }
      }

      for (let j = 0; j <= i - 1; j++) {
        for (let k = 0; k <= i - 1 - j; k++) {
          for (let m = 0; m < 4; m++)
            for (let l = 0; l < 6; l++) {
              vertid[4 * kk + 0] = (m + 1) * 6 + l;
              vertid[4 * kk + 1] = j;
              vertid[4 * kk + 2] = k;
              vertid[4 * kk + 3] = i - j - k - 1;
              kk++;
            }
        }
      }

      // with i>2 hexes fit into subdivided tets, add tet with point (1,1,1) in hex
      for (let j = 0; j <= i - 2; j++) {
        for (let k = 0; k <= i - 2 - j; k++) {
          for (let l = 0; l < 6; l++) {
            vertid[4 * kk + 0] = 5 * 6 + l;
            vertid[4 * kk + 1] = j + 1;
            vertid[4 * kk + 2] = k + 1;
            vertid[4 * kk + 3] = i - 1 - j - k;
            kk++;
          }
        }
      }
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertid, 4));
    geo.setAttribute('vertid', new THREE.Float32BufferAttribute(vertid, 4));

    this.three_object = new THREE.Mesh(geo, material);
    this.name = 'Clipping Plane';
    this.geometry = geo;
  }

  render(data) {
    if (!this.update(data)) return;
    if (data.gui_status.Misc.subdivision !== undefined) {
      const sd = data.gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, 6 * sd * sd * sd);
    }
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
    data2 = data2 && this.extractData(data2);
    const geo = this.geometry;
    const pdata = data.points3d;
    const pdata2 = data2 && data2.points3d;
    const do_interpolate = t !== undefined;

    let names = ['p0', 'p1', 'p2', 'p3'];
    if (data.order3d == 2)
      names = names.concat(['p03', 'p13', 'p23', 'p01', 'p02', 'p12']);

    if (data.funcdim > 1 && data.draw_vol) {
      names = names.concat(['v0_1', 'v2_3']);
      if (data.order3d == 2)
        names = names.concat(['v03_13', 'v23_01', 'v02_12']);
    }

    const get_values = (i, ncomps) => {
      const vals = do_interpolate
        ? mixB64(pdata[i], pdata2[i], t)
        : readB64(pdata[i]);
      return new THREE.InstancedBufferAttribute(vals, ncomps);
    };

    for (const i in names) geo.setAttribute(names[i], get_values(i, 4));

    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
  }
}
