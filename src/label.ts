import * as THREE from 'three';

import { RenderObject } from './render_object';

import './styles.css';

export class Label3D extends RenderObject {
  parent;
  element;
  position: THREE.Vector3;

  constructor(parent, data, path = []) {
    super(data, {}, path);
    this.render_modes = ['overlay'];

    const element = document.createElement('div');
    const el_text = document.createTextNode(this.data.text);
    element.appendChild(el_text);

    parent.appendChild(element);

    element.classList.add('label3d');
    element.style.top = '0px';
    element.style.left = '0px';
    this.parent = parent;
    this.element = element;
    if (this.data.position instanceof THREE.Vector3)
      this.position = new THREE.Vector3().copy(this.data.position);
    else this.position = new THREE.Vector3().fromArray(this.data.position);
  }

  render(data) {
    if (!this.update(data)) {
      this.element.style.visibility = 'hidden';
      return;
    }
    const { controls, camera, pivot, canvas } = data;
    const rect = canvas.getBoundingClientRect();
    this.element.style.visibility = 'visible';
    const vector = new THREE.Vector3();
    const mat = pivot !== undefined ? pivot.matrixWorld : controls.mat;
    vector.copy(this.position).applyMatrix4(mat);
    vector.project(camera);
    // map to 2D screen space
    const x = Math.round(((vector.x + 1) * rect.width) / 2);
    const y = Math.round(((-vector.y + 1) * rect.height) / 2);
    this.element.style.top = `${y}px`;
    this.element.style.left = `${x}px`;
    if (x < 0 || y < 0 || y > rect.height || x > rect.width)
      this.element.style.display = 'none';
    else this.element.style.display = 'block';
  }
}
