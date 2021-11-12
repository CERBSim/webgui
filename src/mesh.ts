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
  MAX_SUBDIVISION,
} from './utils';

import * as THREE from 'three';

const css = require('./styles.css');

export class MeshFunctionObject extends THREE.Mesh {
    uniforms : any;
    data : Object;
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
        this.mesh_only = mesh_only;
        this.uniforms = uniforms;
        this.buffer_geometry = geo;
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
        this.data = data;
        let geo = this.buffer_geometry;
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

        const get_values = (i, ncomps) => {
            const vals = do_interpolate ? mixB64(pdata[i], pdata2[i], t) : readB64(pdata[i]);
            return new THREE.InstancedBufferAttribute( vals, ncomps );
        }

        for (var i in names)
            geo.setAttribute( names[i],  get_values(i, 4) );

        if(data.have_normals)
            for (let i=0; i<3; i++)
                geo.setAttribute( 'n'+i, get_values(3+i, 3) );
        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
        geo.instanceCount = readB64(pdata[0]).length/4;
    }
}

export class WireframeObject extends THREE.Line {
    uniforms : any;
    data : Object;
    mesh_only: boolean;
    buffer_geometry: THREE.BufferGeometry;

    constructor(data, global_uniforms) {
        const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
        const have_z_deformation = data.mesh_dim == 2 && data.funcdim>0;
        var geo = new THREE.InstancedBufferGeometry();
        var uniforms = {
            n_segments: new THREE.Uniform(5),
            ...global_uniforms,
        };

        var inst = new Float32Array(MAX_SUBDIVISION+1);
        for (var i=0; i <= MAX_SUBDIVISION; i++)
            inst[i] = i;

        geo.setAttribute( 'position', new THREE.Float32BufferAttribute( inst, 1 ));

        let defines = Object({ORDER: data.order2d});
        if(have_deformation)
            defines.DEFORMATION = 1;
        else if(have_z_deformation)
            defines.DEFORMATION_2D = 1;
        var wireframe_material = new THREE.RawShaderMaterial({
            vertexShader: getShader( 'splines.vert', defines ),
            fragmentShader: getShader( 'splines.frag', defines ),
            uniforms: uniforms
        });

        super( geo, wireframe_material );
        this.uniforms = uniforms;
        this.buffer_geometry = geo;
    }

    update(gui_status) {
        super.visible = gui_status.elements;
        if(gui_status.subdivision !== undefined) {
            const sd = gui_status.subdivision;
            this.uniforms.n_segments.value = sd;
            this.buffer_geometry.setDrawRange(0, sd+1);
        }
    }

    updateRenderData(data, data2, t) {
        this.data = data;
        let geo = this.buffer_geometry;
        const pdata = data.Bezier_points;
        const pdata2 = data2 && data2.Bezier_points;
        const do_interpolate = t !== undefined;
        const order = data.order2d;

        let pnames = [];
        let vnames = [];
        const o = data.order2d;
        for(let i=0; i<o+1; i++)
        {
            pnames.push('p'+i);
            vnames.push('v'+i);
        }

        const get_values = (i, ncomps) => {
            const vals = do_interpolate ? mixB64(pdata[i], pdata2[i], t) : readB64(pdata[i]);
            return new THREE.InstancedBufferAttribute( vals, ncomps );
        }

        for (let i=0; i<o+1; i++)
            geo.setAttribute( pnames[i], get_values(i, 4) );

        if(data.draw_surf && data.funcdim>1)
            for (let i=0;i<vnames.length; i++)
                geo.setAttribute( vnames[i], get_values(o+1+i, 2) );

        geo.instanceCount = readB64(pdata[0]).length/4;
        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
    }
}

export class ClippingFunctionObject extends THREE.Mesh {
    uniforms : any;
    data : Object;
    buffer_geometry: THREE.BufferGeometry;

    constructor(data, global_uniforms) {
        if(data===undefined) {
            // make clone() work
            super();
            return;
        }

        var uniforms = {
            n_segments: new THREE.Uniform(5),
            ...global_uniforms,
        };

        const defines = {ORDER: data.order3d, SKIP_FACE_CHECK: 1, NO_CLIPPING: 1};
        var material = new THREE.RawShaderMaterial({
            vertexShader: getShader( 'clipping_vectors.vert', defines ),
            fragmentShader: getShader( 'function.frag', defines , data.user_eval_function),
            side: THREE.DoubleSide,
            uniforms: uniforms
        });

        const sd = MAX_SUBDIVISION;
        const nverts = 6*sd*sd*sd;
        var vertid = new Float32Array(4*nverts);

        var ii = 0;
        var kk = 0;
        for (var i=0; i<sd; i++) {

            for (var j=0; j<=i; j++) {
                for (var k=0; k<=i-j; k++) {
                    for (var l = 0; l < 6; l++) {
                        vertid[4*kk+0] = 0*6 + l;
                        vertid[4*kk+1] = j;
                        vertid[4*kk+2] = k;
                        vertid[4*kk+3] = i-j-k;
                        kk++;
                    }
                }
            }

            for (var j=0; j<=i-1; j++) {
                for (var k=0; k<=i-1-j; k++) {
                    for (var m = 0; m < 4; m++)
                    for (var l = 0; l < 6; l++) {
                        vertid[4*kk+0] = (m+1)*6 + l;
                        vertid[4*kk+1] = j;
                        vertid[4*kk+2] = k;
                        vertid[4*kk+3] = i-j-k-1;
                        kk++;
                    }
                }
            }

            // with i>2 hexes fit into subdivided tets, add tet with point (1,1,1) in hex
            for (var j=0; j<=i-2; j++) {
                for (var k=0; k<=i-2-j; k++) {
                    for (var l = 0; l < 6; l++) {
                        vertid[4*kk+0] = 5*6 + l;
                        vertid[4*kk+1] = j+1;
                        vertid[4*kk+2] = k+1;
                        vertid[4*kk+3] = i-1-j-k;
                        kk++;
                    }

                }
            }

        }

        var geo = new THREE.InstancedBufferGeometry();
        geo.setAttribute( 'position', new THREE.Float32BufferAttribute( vertid, 4 ));
        geo.setAttribute( 'vertid',   new THREE.Float32BufferAttribute( vertid, 4 ));

        super(geo, material);
        super.name = data.name;
        this.data = data;
        this.uniforms = uniforms;
        this.buffer_geometry = geo;
    }

    update(gui_status) {
        super.visible = gui_status.Clipping.function && gui_status.Clipping.enable;
        if(gui_status.subdivision !== undefined) {
            const sd = gui_status.subdivision;
            this.uniforms.n_segments.value = sd;
            this.buffer_geometry.setDrawRange(0, 6*sd*sd*sd);
        }
    }

    updateRenderData(data, data2, t) {
        this.data = data;
        let geo = this.buffer_geometry;
        const pdata = data.points3d;
        const pdata2 = data2 && data2.points3d;
        const do_interpolate = t !== undefined;

        let names = [ 'p0', 'p1', 'p2', 'p3' ];
        if(data.order3d==2)
            names = names.concat(['p03', 'p13', 'p23', 'p01', 'p02', 'p12' ]);

        if(data.funcdim>1 && data.draw_vol) {
            names = names.concat(['v0_1', 'v2_3']);
            if(data.order3d==2)
                names = names.concat(['v03_13', 'v23_01', 'v02_12']);
        }

        const get_values = (i, ncomps) => {
            const vals = do_interpolate ? mixB64(pdata[i], pdata2[i], t) : readB64(pdata[i]);
            return new THREE.InstancedBufferAttribute( vals, ncomps );
        }

        for (var i in names)
            geo.setAttribute( names[i],  get_values(i, 4) );

        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
    }
}
