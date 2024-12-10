import * as THREE from 'three';

import { RenderObject } from './render_object';
import { Label3D } from './label';

import './styles.css';

export class Axes extends RenderObject {
  labels = null;
  // labels_object;
  // divs;
  container;
  label_style: string;

  constructor(container) {
    super(null, null, null);
    this.three_object = new THREE.AxesHelper(0.15);
    this.three_object.matrixAutoUpdate = false;
    this.name = 'Axes';
    this.container = container;
    this.labels = null;
    this.render_modes = ['overlay'];
  }

  cleanupHTML() {
    if (this.labels && this.labels.length)
      this.labels.map((label) => label.element.remove());
    this.labels = [];
  }

  render(data) {
    if (this.update(data)) {
      this.three_object.matrixWorld
        .makeTranslation(-0.80 * data.controls.aspect, -0.80, 0)
        .multiply(data.controls.rotmat);
      // console.log('rotmat', data.controls.rotmat.elements);
      data.renderer.render(this.three_object, data.camera);
    }

    if (this.labels === null) this.updateLabels(data.gui_status.axes_labels);
    const ldata = { pivot: this.three_object, ...data };
    this.labels.forEach((label) => label.render(ldata));
  }

  updateLabels(axes_labels) {
    if (this.labels && this.labels.length)
      this.labels.map((label) => label.element.remove());

    this.labels = [];
    const s = 0.2;
    const vals = [0, 0, s, 0, 0];
    for (let i = 0; i < 3; i++) {
      this.labels.push(
        new Label3D(this.container, {
          name: this.name,
          position: new THREE.Vector3().fromArray(vals, 2 - i),
          text: axes_labels[i],
        })
      );
    }
  }
}
