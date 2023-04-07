import * as THREE from 'three';

import { shaders } from './shaders';

export const LOG_NONE = 0;
export const LOG_FATAL = 1;
export const LOG_ERROR = 2;
export const LOG_WARN = 3;
export const LOG_INFO = 4;
export const LOG_DEBUG = 5;
export const LOG_TRACE = 6;

const _level_style = [
  null,
  ['%cFATAL', 'color:red'],
  ['%cerror', 'color:red'],
  ['%cwarning', 'color:yellow'],
  ['%cinfo', 'color:black'],
  ['%cdebug', 'color:grey'],
  ['%ctrace', 'color:grey'],
];

export class Log {
  name: string;
  level: number;
  style: string;

  constructor(name = '', level = LOG_INFO, style = 'color: blue') {
    this.name = name;
    this.level = level;
    this.style = style;
  }

  log(level, ...args) {
    if (level > this.level) return;

    console.log(..._level_style[level], this.name, ...args);
  }

  trace(...args) {
    this.log(LOG_TRACE, ...args);
  }
  debug(...args) {
    this.log(LOG_DEBUG, ...args);
  }
  info(...args) {
    this.log(LOG_INFO, ...args);
  }
  warn(...args) {
    this.log(LOG_WARN, ...args);
  }
  error(...args) {
    this.log(LOG_ERROR, ...args);
  }
  fatal(...args) {
    this.log(LOG_FATAL, ...args);
  }

  local(name, collapsed = true) {
    const log = new Log(name);
    const msg = '%c ' + this.name + ' - ' + name;
    if (collapsed) console.groupCollapsed(msg, this.style);
    else console.group(msg, this.style);
    log.release = () => {
      console.groupEnd();
    };
    return log;
  }

  release() {
    console.groupEnd();
  }
}

export const log = new Log('Webgui');

export const MAX_SUBDIVISION = 20;

export class WebGLScene {
  element;
  context;
  container;
  renderer;
  render_target;
  have_webgl2;
  canvas;

  requestId: number;

  initCanvas(element, webgl_args) {
    const llog = log.local('initCanvas');
    this.requestId = 0;
    this.element = element;
    const canvas = document.createElement('canvas');
    this.canvas = canvas;

    const gl2 = canvas.getContext('webgl2');

    if (gl2) {
      llog.info('webgl2 is supported!');
      this.context = canvas.getContext('webgl2', {
        alpha: false,
        ...webgl_args,
      });
      this.have_webgl2 = true;
    } else {
      console.log('your browser/OS/drivers do not support WebGL2');
      this.context = canvas.getContext('webgl', {
        alpha: false,
        ...webgl_args,
      });
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: this.context,
      alpha: true,
      premultipliedAlpha: false,
    });
    this.renderer.setClearAlpha(1.0);
    this.renderer.autoClear = false;
    llog.info('Renderer', this.renderer);

    this.render_target = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
    this.render_target.texture.format = THREE.RGBAFormat;
    this.render_target.texture.type = THREE.FloatType;

    //this is to get the correct pixel detail on portable devices
    this.renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.domElement.addEventListener("click", console.log, true)

    //and this sets the canvas' size.
    this.renderer.setSize(this.element.offsetWidth, this.element.offsetHeight);
    this.renderer.setClearColor(0xffffff, 1);

    this.container = document.createElement('div');
    element.appendChild(this.container);

    this.container.appendChild(this.renderer.domElement);
    llog.release();
  }

  async animate(cancel_existing_request = false) {
    if (this.requestId != 0 && cancel_existing_request) {
      cancelAnimationFrame(this.requestId);
      this.requestId = 0;
    }
    // Don't request a frame if another one is currently in the pipeline
    if (this.requestId === 0) {
      await new Promise((resolve) => {
        this.requestId = requestAnimationFrame(resolve);
      });
      this.render();
    }
  }

  render() {
    // do nothing
  }
}

export function readB64Raw(base64) {
  if (typeof base64 == 'object') {
    switch (base64.constructor.name) {
      case 'DataView': // binary buffer (used for jupyter widgets)
        return base64.buffer;
      default:
        return base64;
    }
  }
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function readB64(base64) {
  return new Float32Array(readB64Raw(base64));
}

export function setKeys(dst, src) {
  for (const key in dst) {
    if (typeof dst[key] == 'object' && src[key] !== undefined)
      setKeys(dst[key], src[key]);
    else if (src[key] !== undefined) {
      dst[key] = src[key];
    }
  }
}

export function getShader(name, defines = {}, user_eval_function = null) {
  defines = { ...defines }; // copy dictionary
  if (name.endsWith('.vert')) defines['VERTEX_SHADER'] = true;
  if (name.endsWith('.frag')) defines['FRAGMENT_SHADER'] = true;

  if (user_eval_function) defines['USER_FUNCTION'] = user_eval_function;

  let s = '';
  const nl = String.fromCharCode(10); // avoid escape characters
  for (const key in defines) s += '#define ' + key + ' ' + defines[key] + nl;

  const utils = window.atob(shaders['utils.h']);
  const shader = window.atob(shaders[name]).trim();
  return (
    s +
    '// START FILE: utils.h' +
    nl +
    utils +
    nl +
    '// START FILE: ' +
    name +
    nl +
    shader
  );
}

export function getCookie(cname) {
  const name = cname + '=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
}

// format a given time in ms as string
// 0.0012 -> 1.2 us
// 1352.3 -> 1.352 s
export function formatTimeSpan(t) {
  let unit = '';

  if (t >= 1e3) {
    t *= 1e-3;
    unit = 's';
  } else if (t >= 1) {
    unit = 'ms';
  } else if (t >= 1e-3) {
    t *= 1e3;
    unit = 'us';
  } else if (t >= 1e-6) {
    t *= 1e6;
    unit = 'ns';
  }

  return t.toFixed(4) + ' ' + unit;
}

export function mixB64(a, b, t) {
  const t1 = 1.0 - t;
  const mix = (a, b) => t1 * a + t * b;
  const d1 = readB64(a);
  const d2 = readB64(b);

  for (let i = 0; i < d1.length; i++) d1[i] = mix(d1[i], d2[i]);

  return d1;
}
