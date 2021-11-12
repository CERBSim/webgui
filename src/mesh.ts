import {
  MODULE_NAME, MODULE_VERSION
} from './version';

import {
  WebGLScene,
  getCookie,
  getShader,
  readB64,
  mixB64,
  setKeys,
} from './utils';

import * as THREE from 'three';

const css = require('./styles.css');
const MAX_SUBDIVISION = 20;

export class MeshFunctionObject extends THREE.Mesh {
    uniforms : any;
    data : Object;
    have_deformation: boolean;
    have_z_deformation: boolean;
    mesh_only: boolean;
    buffer_geometry: THREE.BufferGeometry;

    constructor(data, global_uniforms) {
        const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
        const have_z_deformation = data.mesh_dim == 2 && data.funcdim>0;
        const mesh_only = data.funcdim==0;
        var uniforms = {
            n_segments: new THREE.Uniform(5),
            ...global_uniforms,
        };

        var geo = new THREE.InstancedBufferGeometry();
        var position = new Float32Array(6*MAX_SUBDIVISION*MAX_SUBDIVISION);

        // subdivision mesh
        var ii = 0;
        for (var i=0; i<MAX_SUBDIVISION; i++) {
          for (var j=0; j<=i; j++) {
            position[ii++] = j;
            position[ii++] = i-j;
            position[ii++] = j+1;
            position[ii++] = i-j;
            position[ii++] = j;
            position[ii++] = i-j+1;
          }
          for (var j=0; j<i; j++) {
            position[ii++] = j+1;
            position[ii++] = i-j-1;
            position[ii++] = j+1;
            position[ii++] = i-j;
            position[ii++] = j;
            position[ii++] = i-j;
          }
        }

        geo.setAttribute( 'position', new THREE.Float32BufferAttribute(position, 2 ));
        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);

        var defines = Object({MESH_2D: 1, ORDER:data.order2d});
        if(data.have_normals)
            defines.HAVE_NORMALS=1;
        if(have_deformation)
          defines.DEFORMATION = 1;
        else if(have_z_deformation)
          defines.DEFORMATION_2D = 1;
        if(data.draw_surf==false)
          defines.NO_FUNCTION_VALUES = 1;

        var mesh_material = new THREE.RawShaderMaterial({
          vertexShader: getShader( 'trigsplines.vert', defines ),
          fragmentShader: getShader( 'function.frag', defines, data.user_eval_function ),
          side: THREE.DoubleSide,
          uniforms: uniforms
        });

        mesh_material.polygonOffset = true;
        mesh_material.polygonOffsetFactor = 1;
        mesh_material.polygonOffsetUnits = 1;

        super(geo, mesh_material);
        super.name = data.name;
        this.data = data;
        this.have_deformation = have_deformation;
        this.have_z_deformation = have_z_deformation;
        this.mesh_only = mesh_only;
        this.uniforms = uniforms;
        this.buffer_geometry = geo;
        console.log("CONSTRUCTOR FINISHED", this);
    }

    update(gui_status) {
        super.visible = gui_status.elements;
        if(gui_status.subdivision !== undefined) {
            const sd = gui_status.subdivision;
            this.uniforms.n_segments.value = sd;
            this.buffer_geometry.setDrawRange(0, 3*sd*sd)
        }
    }

    updateRenderData(data, data2, t) {
        console.log("UPDATE RENDERDATA", data, data2, t);
        this.data = data;
        let geo = this.buffer_geometry;
        console.log("geometry", geo);
        const pdata = data.Bezier_trig_points;
        const pdata2 = data2 && data2.Bezier_trig_points;
        const do_interpolate = t !== undefined;
        const order = data.order2d;

        var names;
        if(order == 1) {
            names = ['p0', 'p1', 'p2']
            if(data.draw_surf && data.funcdim>1)
                names = names.concat(['v0', 'v1', 'v2' ]);
        }
        if(order == 2) {
            names = ['p00', 'p01', 'p02', 'p10', 'p11', 'p20'];
            if(data.draw_surf && data.funcdim>1)
                names = names.concat([ 'vec00_01', 'vec02_10', 'vec11_20' ]);
        }
        if(order == 3) {
            names = [ 'p00', 'p01', 'p02', 'p03', 'p10', 'p11', 'p12', 'p20', 'p21', 'p30'];
            if(data.draw_surf && data.funcdim>1)
                names = names.concat([ 'vec00_01', 'vec02_03', 'vec10_11', 'vec12_20', 'vec21_30']);
        }

        const get_values = (i) => {
            return do_interpolate ? mixB64(pdata[i], pdata2[i], t) : readB64(pdata[i]);
        }

        console.log(names, get_values(1));
        for (var i in names)
            geo.setAttribute( names[i], new THREE.InstancedBufferAttribute( get_values(i), 4 ) );

        if(data.have_normals)
            for (let i=0; i<3; i++)
        geo.setAttribute( 'n'+i, new THREE.InstancedBufferAttribute( get_values(3+i), 3 ) );
        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
        geo.instanceCount = readB64(pdata[0]).length/4;
    }
}
