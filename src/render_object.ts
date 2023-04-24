import * as THREE from 'three';

export function extractData(data, path) {
  if (path === null) return data;
  let d = data;
  for (let i = 0; i < path.length; i++) {
    d = d[path[i]];
  }
  return d;
}

export class RenderObject {
  uniforms = null;
  data = null;
  three_object: THREE.Object3D;
  name: string;
  render_modes: Array<string> = ['default'];
  path: Array<number | string>;

  constructor(data, global_uniforms, path: Array<number | string>) {
    if (data === undefined) {
      // make clone() work
      return;
    }
    this.uniforms = { ...global_uniforms };
    this.name = '';
    this.three_object = null;
    this.path = path;
    if (data !== null) {
      this.data = this.extractData(data);
      if (this.data.name) this.name = this.data.name;
      if (this.data.render_modes) this.render_modes = this.data.render_modes;
    }
  }

  extractData(data) {
    return extractData(data, this.path);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update({ gui_status }) {
    const visible = this.name === '' || gui_status.Objects[this.name];

    if (this.three_object) {
      this.three_object.visible = visible;
    }

    return visible;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(data) {
    if (!this.update(data)) return;
    this.three_object.matrixWorld.copy(data.controls.mat);
    data.renderer.render(this.three_object, data.camera);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRenderData(data, data2, t) {
    this.data = this.extractData(data);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onResize(w: number, h: number) {
    // do nothing
  }

  cleanupHTML() {
    //do nothing
  }
}

// export class ThreeRenderObject {
//   constructor(three_objectdata, global_uniforms, path: Array<number | string>) {