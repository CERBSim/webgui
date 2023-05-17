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
    this.uniforms = uniforms;
    this.geometry = geo;
  }

  render(data) {
    if (!this.update(data)) return;

    const { gui_status } = data;
    if (gui_status.Misc.subdivision !== undefined) {
      const sd = gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, 3 * sd * sd);
    }
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
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

    for (const i in names)
      geo.setAttribute(
        names[i],
        get_values(
          i,
          names[i].startsWith('p') || names[i].startsWith('vec') ? 4 : 2
        )
      );

    if (data.have_normals)
      for (let i = 0; i < 3; i++)
        geo.setAttribute('n' + i, get_values(3 + i, 3));

    geo._maxInstanceCount = readB64(pdata[0]).length / 4;
    geo.instanceCount = geo._maxInstanceCount;
    geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
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
    const { gui_status, renderer, controls, camera } = data;
    if (gui_status.Misc.subdivision !== undefined) {
      const sd = gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, sd + 1);
    }
    this.three_object.matrixWorld.copy(controls.mat);
    renderer.render(this.three_object, camera);
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

    geo._maxInstanceCount = readB64(pdata[0]).length / 4;
    geo.instanceCount = geo._maxInstanceCount;
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
    this.three_object.matrixWorldAutoUpdate = false;
    this.name = 'Clipping Plane';
    this.geometry = geo;
  }

  render(data) {
    const { gui_status, renderer, controls, camera } = data;

    if (!this.update(data)) return;
    if (!gui_status.Clipping.enable) return;

    if (gui_status.Misc.subdivision !== undefined) {
      const sd = gui_status.Misc.subdivision;
      this.uniforms.n_segments.value = sd;
      this.geometry.setDrawRange(0, 6 * sd * sd * sd);
    }
    this.three_object.matrixWorld.copy(controls.mat);
    renderer.render(this.three_object, camera);
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

export class ClippingVectorsObject extends RenderObject {
  clipping_function: ClippingFunctionObject;
  clipping_plane_camera: THREE.OrthographicCamera;
  buffer_texture: THREE.WebGLRenderTarget;
  mesh_radius: number;
  mesh_center: number;
  geometry: THREE.InstancedBufferGeometry;
  plane: THREE.Plane;
  offset: number;
  grid_size: number;

  constructor(data, uniforms, path, clipping_function: ClippingFunctionObject) {
    super(data, uniforms, path);

    this.clipping_function = clipping_function;
    const r = data.mesh_radius;
    this.clipping_plane_camera = new THREE.OrthographicCamera(
      -r,
      r,
      r,
      -r,
      -10,
      10
    );
    this.mesh_radius = r;
    this.mesh_center = new THREE.Vector3().fromArray(data.mesh_center);
    this.plane = new THREE.Plane();
    this.offset = null;
    this.grid_size = null;

    this.uniforms.clipping_plane_c = new THREE.Uniform(new THREE.Vector3());
    this.uniforms.clipping_plane_t1 = new THREE.Uniform(new THREE.Vector3());
    this.uniforms.clipping_plane_t2 = new THREE.Uniform(new THREE.Vector3());
    this.uniforms.vectors_offset = new THREE.Uniform(this.offset);
    this.uniforms.grid_size = new THREE.Uniform(this.grid_size);
    this.uniforms.tex_values = new THREE.Uniform();
    this.render_modes = ['no_clipping'];

    const material = new THREE.RawShaderMaterial({
      vertexShader: getShader('vector_function.vert'),
      fragmentShader: getShader(
        'function.frag',
        { NO_CLIPPING: 1, SIDE_LIGHTS: 1 },
        data.user_eval_function
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

    this.three_object = new THREE.Mesh(geo, material);
    this.three_object.matrixWorldAutoUpdate = false;
    this.three_object.frustumCulled = false;
    this.name = 'Clipping Vectors';
    this.geometry = geo;

    this.buffer_texture = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
    });
  }

  render(data) {
    const { gui_status, renderer, camera, controls } = data;

    if (!this.update(data)) return;
    if (!gui_status.Clipping.enable) return;

    this.updateGridsize(data);
    this.updateClippingPlaneCamera(data);

    this.uniforms.vectors_offset.value = gui_status.Vectors.offset;
    this.uniforms.grid_size.value = gui_status.Vectors.grid_size;
    this.three_object.matrixWorld.copy(controls.mat);
    renderer.render(this.three_object, camera);
  }

  updateClippingPlaneCamera({ gui_status, clipping_plane, renderer, context }) {
    if (this.plane.equals(clipping_plane)) return;
    context.finish();
    const n = gui_status.Vectors.grid_size;
    const plane_center = new THREE.Vector3();
    clipping_plane.projectPoint(this.mesh_center, plane_center);
    const plane0 = clipping_plane.clone();
    plane0.constant = 0.0;
    const normal = clipping_plane.normal;

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

    this.clipping_plane_camera.position.copy(position);
    this.clipping_plane_camera.up = t2;
    this.clipping_plane_camera.lookAt(target);
    this.clipping_plane_camera.updateProjectionMatrix();
    this.clipping_plane_camera.updateMatrix();

    const cf = this.clipping_function;
    this.uniforms.clipping_plane_c.value = plane_center;
    this.uniforms.clipping_plane_t1.value = t1;
    this.uniforms.clipping_plane_t2.value = t2;
    this.uniforms.grid_size.value = n;

    const function_mode = cf.uniforms.function_mode.value;
    cf.uniforms.function_mode.value = 4;

    if (gui_status.Misc.subdivision !== undefined) {
      const sd = gui_status.Misc.subdivision;
      cf.uniforms.n_segments.value = sd;
      cf.geometry.setDrawRange(0, 6 * sd * sd * sd);
    }
    renderer.setRenderTarget(this.buffer_texture);
    renderer.setClearColor(new THREE.Color(0.0, 0.0, 0.0));
    renderer.clear(true, true, true);
    const cf_visible = cf.three_object.visible;
    cf.three_object.visible = true;
    cf.three_object.matrixWorld.identity();

    renderer.render(cf.three_object, this.clipping_plane_camera);

    const pixel_buffer = new Float32Array(4 * n * n);
    context.readPixels(0, 0, n, n, context.RGBA, context.FLOAT, pixel_buffer);

    renderer.setRenderTarget(null);
    cf.uniforms.function_mode.value = function_mode;
    cf.three_object.visible = cf_visible;
    this.plane.copy(clipping_plane);
  }

  updateGridsize({ gui_status }) {
    if (this.grid_size === gui_status.Vectors.grid_size) return;
    const n = gui_status.Vectors.grid_size;
    this.grid_size = n;
    this.buffer_texture.setSize(n, n);
    this.uniforms.tex_values.value = this.buffer_texture.texture;

    const arrowid = new Float32Array(2 * n * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        arrowid[2 * (i * n + j) + 0] = (1.0 * (j + 0.5)) / n;
        arrowid[2 * (i * n + j) + 1] = (1.0 * (i + 0.5)) / n;
      }
    this.geometry.instanceCount = n * n;
    this.geometry._maxInstanceCount = n * n;
    this.geometry.setAttribute(
      'arrowid',
      new THREE.InstancedBufferAttribute(arrowid, 2)
    );
    this.plane.negate(); // force rerending
  }
}
