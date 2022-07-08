import * as THREE from 'three';

import {
  shaders
} from './shaders';

export const MAX_SUBDIVISION = 20;

export class WebGLScene {
  element : any;
  context : any;
  container : any;
  renderer : any;
  render_target : any;
  have_webgl2 : any;
  canvas;

  requestId: number;

  initCanvas (element, webgl_args)
  {
    this.requestId = 0;
    this.element = element;
    var canvas = document.createElement( 'canvas' );
    this.canvas = canvas;

    var gl2 = canvas.getContext('webgl2');

    if (gl2) {
      console.log('webgl2 is supported!');
      this.context = canvas.getContext( 'webgl2', { alpha: false, ...webgl_args } );
      this.have_webgl2 = true;
    }
    else
    {
      console.log('your browser/OS/drivers do not support WebGL2');
      this.context = canvas.getContext( 'webgl', { alpha: false, ...webgl_args } );
    }

    this.renderer = new THREE.WebGLRenderer( { canvas: canvas, context: this.context, alpha: true, premultipliedAlpha: false } );
    this.renderer.setClearAlpha(1.0);
    this.renderer.autoClear = false;
    console.log("Renderer", this.renderer);

    this.render_target = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
    this.render_target.texture.format = THREE.RGBAFormat;
    this.render_target.texture.type = THREE.FloatType;

    //this is to get the correct pixel detail on portable devices
    this.renderer.setPixelRatio( window.devicePixelRatio );
    // renderer.domElement.addEventListener("click", console.log, true)

    //and this sets the canvas' size.
    this.renderer.setSize( this.element.offsetWidth, this.element.offsetHeight );
    this.renderer.setClearColor( 0xffffff, 1 );

    this.container = document.createElement( 'div' );
    element.appendChild( this.container );

    this.container.appendChild( this.renderer.domElement );

  }

  async animate (cancel_existing_request=false) {
    if(this.requestId != 0 && cancel_existing_request) {
        cancelAnimationFrame(this.requestId);
        this.requestId = 0;
    }
    // Don't request a frame if another one is currently in the pipeline
    if(this.requestId === 0) {
        await new Promise(resolve => {
            this.requestId = requestAnimationFrame(resolve);
        });
        this.render();
    }
  }


  render(){}
}

export function readB64Raw(base64) {
    if(typeof(base64) == 'object')
    {
        switch(base64.constructor.name) {
            case 'DataView': // binary buffer (used for jupyter widgets)
                return base64.buffer;
            default:
                return base64;
        }
    }
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return  bytes.buffer;
}

export function readB64(base64) {
    return new Float32Array( readB64Raw(base64) );
}

export function setKeys (dst, src) {
  for(var key in dst) {
    if(typeof(dst[key])=="object" && src[key] !== undefined)
      setKeys(dst[key], src[key]);
    else
      {
        dst[key] = src[key];
      }
  }
}

export function getShader(name, defines = {}, user_eval_function = null)
{
  defines = {...defines}; // copy dictionary
  if(name.endsWith(".vert"))
    defines["VERTEX_SHADER"] = true;
  if(name.endsWith(".frag"))
    defines["FRAGMENT_SHADER"] = true;

  if(user_eval_function)
    defines["USER_FUNCTION"] = user_eval_function;

  var s ="";
  var nl = String.fromCharCode(10); // avoid escape characters
  for(var key in defines)
    s += "#define " + key + " " + defines[key] + nl;


  var utils = window.atob(shaders['utils.h']);
  var shader = window.atob(shaders[name]).trim();
  return s + "// START FILE: utils.h"+nl + utils +nl+"// START FILE: " + name + nl + shader;
}


export function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

// format a given time in ms as string
// 0.0012 -> 1.2 us
// 1352.3 -> 1.352 s
export function formatTimeSpan(t) {
    let unit = "";

    if(t>=1e3) {
        t*=1e-3;
        unit = "s";
    }
    else if(t>=1){
        unit = "ms";
    }
    else if(t>=1e-3){
        t*=1e3;
        unit = "us";
    }
    else if(t>=1e-6){
        t*=1e6;
        unit = "ns";
    }

    return t.toFixed(4) + " " + unit;
}

export function mixB64(a,b,t) {
    const t1 = 1.0-t;
    const mix = (a,b)=> t1*a + t*b;
    let d1 = readB64(a);
    let d2 = readB64(b);

    for (let i=0; i<d1.length; i++)
        d1[i] = mix(d1[i],d2[i]);

    return d1;
};


