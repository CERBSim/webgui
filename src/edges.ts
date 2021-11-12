import {
  getShader,
  readB64,
  mixB64,
  MAX_SUBDIVISION,
} from './utils';

import * as THREE from 'three';

export class ThickEdgesObject extends THREE.Mesh {
    uniforms : any;
    data : Object;
    have_deformation: boolean;
    have_z_deformation: boolean;
    buffer_geometry: THREE.BufferGeometry;

    constructor(data, global_uniforms) {
        const have_deformation = data.mesh_dim == data.funcdim && !data.is_complex;
        const have_z_deformation = data.mesh_dim == 2 && data.funcdim>0;

        var uniforms = {
            n_segments: new THREE.Uniform(5),
            ...global_uniforms,
        };

        var geo = new THREE.InstancedBufferGeometry();

        var inst = new Float32Array((MAX_SUBDIVISION+1)*2*3*2);
        for (var i=0; i <= 20; i++)
        {
            const i0 = 12*i;
            inst[i0+ 0] = i;
            inst[i0+ 2] = i;
            inst[i0+ 4] = i+1;
            inst[i0+ 6] = i+1;
            inst[i0+ 8] = i+1;
            inst[i0+10] = i;

            inst[i0+ 1] =  1;
            inst[i0+ 3] = -1;
            inst[i0+ 5] = -1;
            inst[i0+ 7] = -1;
            inst[i0+ 9] =  1;
            inst[i0+11] =  1;
        }

        geo.setAttribute( 'position', new THREE.Float32BufferAttribute( inst, 2 ));

        let defines = Object({ORDER: data.order2d});
        if(have_deformation)
            defines.DEFORMATION = 1;
        else if(have_z_deformation)
            defines.DEFORMATION_2D = 1;
        defines.THICK_LINES = 1;
        var wireframe_material = new THREE.RawShaderMaterial({
            vertexShader: getShader( 'splines.vert', defines ),
            fragmentShader: getShader( 'splines.frag', defines ),
            uniforms: uniforms,
        });

        super(geo, wireframe_material);
        super.name = data.name;
        this.buffer_geometry = geo;
        this.uniforms = uniforms;
    }

    update(gui_status) {
        super.visible = gui_status.edges;
        if(gui_status.subdivision !== undefined) {
            const sd = gui_status.subdivision;
            this.uniforms.n_segments.value = sd;
            this.buffer_geometry.setDrawRange(0, 3*sd);
        }
    }

    updateRenderData(data, data2, t) {
        this.data = data;
        let geo = this.buffer_geometry;
        const pdata = data.edges;
        const pdata2 = data2 && data2.edges;
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
            geo.setAttribute( pnames[i],  get_values(i, 4) );

        geo.instanceCount = readB64(pdata[0]).length/4;
        geo.boundingSphere = new THREE.Sphere(data.mesh_center, data.mesh_radius);
    }
}
