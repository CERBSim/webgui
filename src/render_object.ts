import * as THREE from 'three';

export function extractData(data, path) {
  let d = data;
  for (let i = 0; i < path.length; i++) {
    d = d[path[i]];
  }
  return d;
}

export class RenderObject {
  uniforms;
  data;
  three_object: THREE.Object3D;
  name: string;
  path: Array<number | string>;

  constructor(data, global_uniforms, path: Array<number | string>) {
    if (data === undefined) {
      // make clone() work
      return;
    }
    this.uniforms = { ...global_uniforms };
    this.name = '';
    this.three_object = new THREE.Object3D();
    this.path = path;
    this.data = this.extractData(data);
  }

  extractData(data) {
    return extractData(data, this.path);
  }

  update(gui_status) {
    this.three_object.visible = gui_status.Objects[this.name];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
  }
}
