import * as THREE from 'three';
import {
  WebGLScene,
  getShader,
  formatTimeSpan,
} from './utils';


function generateColorTexture(names) {
    const n = names.length;
    var data = new Float32Array(3*n+3);

    for(var i=0; i<n; i++)
    {
        const c = getColorFromString(names[i]);
        data[3*i+0] = c.r;
        data[3*i+1] = c.g;
        data[3*i+2] = c.b;
    }

    let tex = new THREE.DataTexture( data, n, 1, THREE.RGBFormat, THREE.FloatType );
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
}

function getColorFromString(s) {
  let hash = 0, i, chr;
  if (s.length === 0) return [0,0,0];
  for (i = 0; i < s.length; i++) {
    // chr   = s.charCodeAt(i);
    // hash  = ((hash << 5) - hash) + chr;
    // hash |= 0; // Convert to 32bit integer
    const c = s.charCodeAt(i);
    hash += (i+1)*(i+1)*53*c;
  }

  hash = Math.abs(hash);
  hash = hash*47;

  let hue = (hash%256)/256;
  hash = Math.floor(hash/256);
  let lightness = 0.3 + 0.4*(hash%256)/256;
  hash = Math.floor(hash/256);
  let saturation = 0.3 + 0.4*(hash%256)/256;

  let c = new THREE.Color();
  c.setHSL(hue, saturation, lightness);
  return c;
};

function CreateStreamVisualizer ( rectangles, uniforms )
{
    const n_rects = rectangles.name_id.length;

    let rect_ids = new Float32Array(n_rects);
    for(var i=0; i<n_rects; i++)
        rect_ids[i] = i+1;

    var geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute( 'position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,0,0, 1,1,0, 0,1,0]), 3 ));
    geo.setAttribute( 'times', new THREE.InstancedBufferAttribute(new Float32Array(rectangles.times), 2 ));
    geo.setAttribute( 'level', new THREE.InstancedBufferAttribute(new Uint16Array(rectangles.level), 1 ));
    geo.setAttribute( 'name_id', new THREE.InstancedBufferAttribute(new Uint16Array(rectangles.name_id), 1 ));
    geo.setAttribute( 'rect_id', new THREE.InstancedBufferAttribute(rect_ids, 1) );
    geo.setDrawRange(0, 6);
    geo.instanceCount = n_rects;
    geo._maxInstanceCount = n_rects;

    var material = new THREE.RawShaderMaterial({
      vertexShader: getShader( 'trace_explorer.vert' ),
      fragmentShader: getShader( 'trace_explorer.frag'),
      side: THREE.DoubleSide,
      uniforms: uniforms
    });

    let mesh = new THREE.Mesh( geo, material );
    mesh.frustumCulled = false;
    return mesh;
}

export class TraceViewer extends WebGLScene
{
  camera: any;
  names: any;
  streams: any;
  scene: any;
  uniforms: any;
  buffer_texture: any;
  pixels: any;
  w: any;
  h: any;
  last_id: any;
  data : any;
  tooltip : any;

  initCanvas (element, data)
  {
    WebGLScene.prototype.initCanvas.call(this, element, {});
    window.addEventListener( 'resize', ()=>this.onResize(), false );

    this.uniforms = {};
    this.camera = new THREE.OrthographicCamera( 0, data.max_time, 3.0, -5.0, -100, 100 );
    this.data = data;
    // this.streams.push(
    this.scene = new THREE.Scene();
    this.scene.add(CreateStreamVisualizer( data.streams[0] , this.uniforms ));

    this.uniforms.tex_colormap = { value: generateColorTexture(data.names) };
    this.uniforms.n_colors = { value: data.max_id+1 };
    this.uniforms.mode = { value: 0};
    this.uniforms.selected_rect = { value: -1};

    var geometry = new THREE.BoxGeometry(1,1,1);
    var material = new THREE.MeshBasicMaterial({color: 0xff0000});
    var cube = new THREE.Mesh(geometry,material);
    // this.scene.add(cube);
    this.onResize();
    this.names = data.names;
    this.tooltip = document.querySelectorAll('.tooltip span')[0];
    console.log("tooltip", this.tooltip);

  }

  constructor( parent, data )
  {
      super();
      this.streams = [];
      // this.names = data.names;
      // this.streams = data.streams;
      this.initCanvas(parent, data);

      this.canvas.addEventListener( 'mousemove', (e)=>this.onMouseMove(e), false );
      this.canvas.addEventListener( 'mousewheel', (e)=>this.onMouseWheel(e), false );
      this.last_id = 0;
  }

  onResize() {
    const w = this.element.parentNode.clientWidth-20;
    const h = this.element.parentNode.clientHeight-20;
    this.w = w;
    this.h = h;
    const aspect = w/h;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( w, h );

    {
        this.pixels = new Float32Array(w*h * 4);
        this.buffer_texture = new THREE.WebGLRenderTarget( w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType, format: THREE.RGBAFormat });
        this.uniforms.tex_values = new THREE.Uniform(this.buffer_texture.texture);
    }

    this.animate();
  }


  render() {
      const gl = this.context;
      // gl.depthFunc(gl.GREATER);
      // gl.depthFunc(gl.GREATER);
      // gl.depthFunc(gl.GEQUAL);
      // gl.clearDepth(0);
      this.uniforms.mode.value = 0;
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      {
          this.uniforms.mode.value = 1;
          this.renderer.setRenderTarget(this.buffer_texture);
          this.renderer.setClearColor( new THREE.Color(0.0,0.0,0.0) );
          this.renderer.clear(true, true, true);
          this.renderer.render(this.scene, this.camera);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.FLOAT, this.pixels);
          this.renderer.setRenderTarget(null);
          this.renderer.setClearColor( new THREE.Color(1.0,1.0,1.0));
      }


      this.requestId = 0;
  }

  getMousePos(x,y) {

  }

  onMouseWheel(event) {
      event.preventDefault();
      var rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left)/(rect.right-rect.left);
      const dt = this.camera.right-this.camera.left;
      const t = this.camera.left + x*dt;
      const scaling = 1.0 + 1e-3*event.deltaY;
      let t0 = t + scaling*(this.camera.left-t);
      let t1 = t + scaling*(this.camera.right-t);
      if(t0<0.)
          t0 = 0.;
      if(t1>this.data.max_time)
          t1 = this.data.max_time;
      this.camera.left = t0;
      this.camera.right = t1;
      this.camera.updateProjectionMatrix();
      this.animate();
  }
  onMouseMove(event) {
      var rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = rect.bottom - event.clientY;
      let id = this.pixels[4*(x + this.w*y)];
      if(id != this.last_id)
          {
              this.last_id = id;
              this.uniforms.selected_rect.value = id;
              if(id>0)
                  {
                      id -= 1;
                      const name_id = this.data.streams[0].name_id[id];
                      const t0 = this.data.streams[0].times[2*id];
                      const t1 = this.data.streams[0].times[2*id+1];

                      const name = this.data.names[name_id];
                      let text = name + "<br/>"
                      text += `start: ${formatTimeSpan(t0)} <br/>`;
                      text += `stop: ${formatTimeSpan(t1)} <br/>`;
                      text += `duration: ${formatTimeSpan(t1-t0)}<br/>`;
                      this.tooltip.innerHTML = text;
                      this.tooltip.style.visibility = 'visible';
                  }
                  else{
                      this.tooltip.style.visibility = 'hidden';
                  }
                  this.animate();
          }
          {
              if(rect.width - x < 300) {
                  let sx = (event.clientX-20) + 'px';
                  this.tooltip.style.right = sx;
              }
              else{
                  let sx = (event.clientX+20) + 'px';
                  this.tooltip.style.left = sx;
              }
              let sy = (event.clientY+20) + 'px';
              this.tooltip.style.top = sy;
          }
  }

}

