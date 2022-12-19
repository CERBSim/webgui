import * as THREE from 'three';

const css = require('./styles.css');

function makeSelectedFaceTexture(data, bnds = [], col_selected = [0,0.5,1.0,1.0], col_default = [0,1,0,1] ) {
    var n_colors = data.mesh_regions_2d;
    var colormap_data = new Float32Array(4*n_colors);

    for (var i=0; i<n_colors; i++)
    {
      colormap_data[4*i+0] = col_default[0];
      colormap_data[4*i+1] = col_default[1];
      colormap_data[4*i+2] = col_default[2];
      colormap_data[4*i+3] = col_default[3];
    }
    for (var i=0; i<bnds.length; i++)
    {
      colormap_data[4*bnds[i]+0] = col_selected[0];
      colormap_data[4*bnds[i]+1] = col_selected[1];
      colormap_data[4*bnds[i]+2] = col_selected[2];
      colormap_data[4*bnds[i]+3] = col_selected[3];
    }

    var colormap_texture = new THREE.DataTexture( colormap_data, n_colors, 1, THREE.RGBFormat, THREE.FloatType );
    colormap_texture.magFilter = THREE.NearestFilter;
    colormap_texture.needsUpdate = true;
    return colormap_texture;
}

function makeMeshColormapTexture(data, n_colors_) {
    // Drawing only a mesh -> colors are given explicitly in render data (or just use green)
    var n_colors = data.mesh_regions_2d;
    const width = Math.min(n_colors, 1024)
    const height = Math.floor((n_colors+(width-1))/width)
    n_colors = width*height;
    console.log("texture size", n_colors, width, height)
    var colormap_data = new Float32Array(4*n_colors);

    for (var i=0; i<4*n_colors; i++) {
        if(i%4==1 || i%4==3)
            colormap_data[i] = 1.0;
        else
            colormap_data[i] = 0.0;
    }

    const colors = data.colors;
    if(colors) {
      for (var i=0; i<colors.length; i++)
      {
          for (var k=0; k<3; k++)
              colormap_data[4*i+k] = colors[i][k];
          colormap_data[4*i+3] = colors[i].length >3 ? colors[i][3] : 1.0;
      }
    }
    var colormap_texture = new THREE.DataTexture( colormap_data, width, height, THREE.RGBAFormat, THREE.FloatType );
    colormap_texture.magFilter = THREE.NearestFilter;
    colormap_texture.needsUpdate = true;
    return colormap_texture;
}

function makeColormapTexture(n_colors) {
    var colormap_data = new Float32Array(3*n_colors);

    var col_blue = new THREE.Vector3(0,0,1);
    var col_cyan = new THREE.Vector3(0,1,1);
    var col_green = new THREE.Vector3(0,1,0);
    var col_yellow = new THREE.Vector3(1,1,0);
    var col_red = new THREE.Vector3(1,0,0);

    for (var i=0; i<n_colors; i++)
    {
      let x = 1.0/(n_colors-1) * i;
      let hx, color;
      if (x < 0.25)
      {
        hx = 4.0*x;
        color = col_blue.clone().multiplyScalar(1.0-hx).addScaledVector(col_cyan, hx);
      }
      else if (x < 0.5)
      {
        hx = 4.0*x-1.0;
        color = col_cyan.clone().multiplyScalar(1.0-hx).addScaledVector(col_green, hx);
      }
      else if (x < 0.75)
      {
        hx = 4.0*x-2.0;
        color = col_green.clone().multiplyScalar(1.0-hx).addScaledVector(col_yellow, hx);
      }
      else
      {
        hx = 4.0*x-3.0;
        color = col_yellow.clone().multiplyScalar(1.0-hx).addScaledVector(col_red, hx);
      }
      colormap_data[3*i+0] = color.x;
      colormap_data[3*i+1] = color.y;
      colormap_data[3*i+2] = color.z;
    }

    var colormap_texture = new THREE.DataTexture( colormap_data, n_colors, 1, THREE.RGBFormat, THREE.FloatType );
    colormap_texture.magFilter = THREE.NearestFilter;
    colormap_texture.needsUpdate = true;
    return colormap_texture;
}

export class ColormapObject extends THREE.Mesh {
    mesh_material: any;
    mesh_only: boolean;
    labels: any;
    labels_object: any;
    divs: any;
    container: any;
    min_ : number;
    max_ : number;
    n_colors : bigint;
    uniforms: any;
    data: any;
    label_style: string;

    constructor(data, uniforms, container, gui_status) {
        const mesh_only = data.funcdim==0;

        if(!mesh_only) {
            var geo = new THREE.PlaneGeometry(1., 0.07).translate(0.5,0,0);
            var material = new THREE.MeshBasicMaterial({depthTest: false, side: THREE.DoubleSide, wireframe: false});
            super( geo, material );
        }
        else {
            super( );
        }

        this.uniforms = uniforms;
        this.data = data;

        // Create 5 html div/text elements for numbers
        this.labels = [];
        this.divs = [];
        var labels_object = document.createElement("div");
        for(var i=0; i<5; i++) {
          var label = document.createElement("div");
          var t = document.createTextNode("");
          label.appendChild(t)
          this.divs.push(label);
          this.labels.push(t);
          labels_object.appendChild(label);
        }
        container.appendChild(labels_object);
        this.labels_object = labels_object;
        this.updateLabels(gui_status);
        this.mesh_material = material;
        this.mesh_only = mesh_only;
        this.container = container;
        this.label_style  = '-moz-user-select: none; -webkit-user-select: none; -ms-user-select:none; onselectstart="return false;';
        this.label_style += 'onmousedown="return false; user-select:none;-o-user-select:none;unselectable="on";';
        this.label_style += 'position: absolute; z-index: 1; display:block;';
        this.update(gui_status);
    }

    cleanup() {
        this.labels_object.innerHTML = '';
    }

    update(gui_status) {
        if(this.min_ != gui_status.colormap_min ||
           this.max_ != gui_status.colormap_max ||
           this.n_colors != gui_status.colormap_ncolors) {

            this.min_ = gui_status.colormap_min;
            this.max_ = gui_status.colormap_max;
            this.n_colors = gui_status.colormap_ncolors;
            this.updateTexture(gui_status);
            if(!this.mesh_only)
                this.updateLabels(gui_status);
        }
        this.labels_object.style.visibility = gui_status.Misc.colormap ? "visible" : "hidden";
    }

    onResize(w,h) {
        if(this.mesh_only)
            return;
        const aspect = w/h;
        let p = new THREE.Vector3();
        super.getWorldPosition(p);
        super.translateOnAxis(p, -1.0);
        super.translateY(0.95);
        super.translateX(-0.93*aspect);
        super.updateWorldMatrix( false, false );

        const n = this.labels.length;
        const y = Math.round(0.5*(0.05+0.07)*h);
        const dx = 0.5*w/((n-1)*aspect);
        const x0 = 0.07*0.5*w;
        for(var i=0; i<n; i++) {
            if(i>0 && i<n-1) {
                if(dx<50 && i%2 == 1) continue;
                if(dx<30 && i%4 == 2) continue;
            }
            const x = Math.round(x0 + i*dx);
            this.divs[i].setAttribute("style",this.label_style+`transform: translate(-50%, 0%); left: ${x}px; top: ${y}px` );
        }
    }

    updateTexture(gui_status) {
        let tex;
        if(this.mesh_only)
            tex = makeMeshColormapTexture(this.data, this.n_colors);
        else
            tex = makeColormapTexture(this.n_colors);

        this.setTexture(tex);
    }

    setTexture(tex) {
        if(this.uniforms.tex_colormap === undefined)
            this.uniforms.tex_colormap = {value: null};

        console.log("set texture", tex.image);
        this.uniforms.colormap_size.value.x = tex.image.width;
        this.uniforms.colormap_size.value.y = tex.image.height;

        this.uniforms.tex_colormap.value = tex;
        if(!this.mesh_only)
            this.mesh_material.map = tex;
    }

    updateLabels(gui_status) {
        const n = this.labels.length;
        const min = gui_status.colormap_min;
        const inc = (gui_status.colormap_max-min)/(n-1);
        if(gui_status.Misc.colormap)
            for(var i=0; i<n; i++)
                this.labels[i].nodeValue = (min+inc*i).toPrecision(2);
        else
            for(var i=0; i<n; i++)
        this.labels[i].nodeValue = "";
    }

    setSelectedFace(bnds = [], col_selected = [0,0.5,1.0], col_default = [0,1,0] ) {
        this.setTexture(makeSelectedFaceTexture(this.data, bnds, col_selected, col_default));
    }
}
