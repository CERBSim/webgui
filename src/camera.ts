import * as THREE from 'three';

// not to change from outside
const changeEvent = { type: 'change' };

function wrapTransformation(mat, vec) {
  const v1 = new THREE.Matrix4();
  const v2 = new THREE.Matrix4();
  v1.makeTranslation(vec.x, vec.y, vec.z);
  v2.makeTranslation(-vec.x, -vec.y, -vec.z);
  mat.premultiply(v1);
  mat.multiply(v2);
  return mat;
}

export class CameraControls extends THREE.EventDispatcher {
  domElement;
  oldtouch = new THREE.Vector2(0, 0);
  olddelta = 0;
  touchfirst = true;
  touchnum = 0;
  scene;
  center;
  mesh_radius;
  subdivision;

  mat = new THREE.Matrix4();
  mode = null;
  rotation_step_degree = 0.05;
  pan_step = 0.05;
  camera_step = 0.2;

  did_move = false;
  is_moving = false;

  keys = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    CLOCKWISE: 65,
    COUNTERCLOCKWISE: 83,
  };

  constructor(scene, domElement) {
    super();
    if (domElement === undefined) console.log('domElement is undefined');
    if (domElement === document)
      console.error(
        '"document" should not be used as the target "domElement". Please use "renderer.domElement" instead.'
      );

    this.scene = scene;
    this.mesh_radius = scene.mesh_radius;
    this.center = scene.mesh_center.clone();
    const s = 1.0 / this.mesh_radius;
    this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
    this.mat.premultiply(new THREE.Matrix4().makeScale(s, s, s));

    this.domElement = domElement;

    this.domElement.addEventListener(
      'dblclick',
      (e) => this.onDblClick(e),
      false
    );

    this.domElement.addEventListener('click', (e) => this.onClick(e), false);
    // this.domElement.addEventListener( 'mouseup', onMouseUp, false );
    window.addEventListener('mouseup', (e) => this.onMouseUp(e), false);
    this.domElement.addEventListener(
      'mousedown',
      (e) => this.onMouseDown(e),
      false
    );
    this.domElement.addEventListener(
      'contextmenu',
      (e) => this.contextmenu(e),
      false
    );
    window.addEventListener('mousemove', (e) => this.onMouseMove(e), false);

    this.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e), {
      passive: false,
    });
    this.domElement.addEventListener(
      'touchstart',
      (e) => this.onTouchStart(e),
      { passive: false }
    );

    //   window.addEventListener( 'keydown', keydown, false );
    this.domElement.addEventListener('wheel', (e) => this.wheel(e), {
      passive: false,
    });

    // make sure element can receive keys.
    if (this.domElement.tabIndex === -1) {
      this.domElement.tabIndex = 0;
    }
  }

  get matrix() {
    return this.mat;
  }

  reset() {
    const s = 1.0 / this.mesh_radius;
    this.center.copy(this.scene.mesh_center);
    this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
    this.mat.premultiply(new THREE.Matrix4().makeScale(s, s, s));

    this.scene.setCenterTag();
    this.update();
  }

  get aspect() {
    return this.domElement.offsetWidth / this.domElement.offsetHeight;
  }
  get rotmat() {
    const rotmat = new THREE.Matrix4();
    rotmat.extractRotation(this.mat);
    return rotmat;
  }

  update() {
    const rotmat = new THREE.Matrix4();
    rotmat.extractRotation(this.mat);
    super.dispatchEvent(changeEvent);
  }

  rotateObject(axis, rad) {
    const mat = new THREE.Matrix4();
    mat.makeRotationAxis(axis, rad);
    const transformed_center = this.center.clone();
    transformed_center.applyMatrix4(this.mat);
    wrapTransformation(mat, transformed_center);
    this.mat.premultiply(mat);
  }

  panObject(dir, dist) {
    const mat = new THREE.Matrix4();
    mat.makeTranslation(dist * dir.x, dist * dir.y, dist * dir.z);
    this.mat.premultiply(mat);
  }

  updateCenter() {
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    this.mat.decompose(pos, rot, scale);

    const rotmat = new THREE.Matrix4().makeRotationFromQuaternion(rot);
    wrapTransformation(rotmat, this.center);

    const s = scale.x;
    const scalemat = wrapTransformation(
      new THREE.Matrix4().makeScale(s, s, s),
      this.center
    );
    this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
    this.mat.multiply(rotmat);
    this.mat.multiply(scalemat);

    this.update();
    this.scene.setCenterTag();
  }

  loadSettings(settings) {
    if (settings.mat) {
      this.mat.copy(settings.mat);
      this.center.copy(settings.center);
      this.update();
      this.scene.setCenterTag();
    }
    if (settings.transformations) {
      for (const trans of settings.transformations) {
        switch (trans.type) {
          case 'move':
            const v = trans.dir;
            const dist = trans.dist || 1.0;
            this.panObject(new THREE.Vector3(v[0], v[1], v[2]), dist);
            break;
          case 'rotateX':
            this.rotateObject(
              new THREE.Vector3(1, 0, 0),
              (Math.PI * trans.angle) / 180
            );
            break;
          case 'rotateY':
            this.rotateObject(
              new THREE.Vector3(0, 1, 0),
              (Math.PI * trans.angle) / 180
            );
            break;
          case 'rotateZ':
            this.rotateObject(
              new THREE.Vector3(0, 0, 1),
              (Math.PI * trans.angle) / 180
            );
            break;
        }
      }
    }
  }

  storeSettings(settings) {
    settings.mat = this.mat;
    settings.center = this.center;
    settings.isPerspectiveCamera = this.scene.camera.isPerspectiveCamera;
  }

  keydown(event) {
    let needs_update = false;

    if (event.shiftKey) {
      // pan
      if (event.keyCode == this.keys.DOWN) {
        needs_update = true;
        this.panObject(new THREE.Vector3(0, -1, 0), this.pan_step);
      } else if (event.keyCode == this.keys.UP) {
        needs_update = true;
        this.panObject(new THREE.Vector3(0, 1, 0), this.pan_step);
      } else if (event.keyCode == this.keys.LEFT) {
        needs_update = true;
        this.panObject(new THREE.Vector3(-1, 0, 0), this.pan_step);
      } else if (event.keyCode == this.keys.RIGHT) {
        needs_update = true;
        this.panObject(new THREE.Vector3(1, 0, 0), this.pan_step);
      }
    } else {
      // rotate
      if (event.keyCode == this.keys.DOWN) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(1, 0, 0),
          this.rotation_step_degree
        );
      } else if (event.keyCode == this.keys.UP) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(-1, 0, 0),
          this.rotation_step_degree
        );
      } else if (event.keyCode == this.keys.LEFT) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(0, -1, 0),
          this.rotation_step_degree
        );
      } else if (event.keyCode == this.keys.RIGHT) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(0, 1, 0),
          this.rotation_step_degree
        );
      } else if (event.keyCode == this.keys.CLOCKWISE) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(0, 0, 1),
          this.rotation_step_degree
        );
      } else if (event.keyCode == this.keys.COUNTERCLOCKWISE) {
        needs_update = true;
        this.rotateObject(
          new THREE.Vector3(0, 0, -1),
          this.rotation_step_degree
        );
      }
    }

    if (needs_update) {
      event.preventDefault();
      this.update();
    }
  }

  onMouseDown(event) {
    this.did_move = false;
    this.is_moving = true;
    if (event.button == 0) {
      event.preventDefault();
      this.mode = 'rotate';
    }
    if (event.button == 2) {
      event.preventDefault();
      this.mode = event.ctrlKey ? 'move_clipping_plane' : 'move';
    }
    event.stopPropagation();
  }

  async onClick(event) {
    event.preventDefault();
    if (this.did_move) return;
    const rect = this.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { dim, index } = await this.scene.getMeshIndex(x, y);
    if (index >= 0 && dim > 0)
      this.scene.handleEvent('select', [{ x, y, dim, index }]);
    super.dispatchEvent(changeEvent);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onMouseUp(event) {
    this.mode = null;
    this.is_moving = false;

    const settings = this.scene.gui.settings.Misc;
    if (settings.fast_draw && this.subdivision) {
      settings.subdivision = this.subdivision;
      this.subdivision = null;
    }
    if (this.did_move) super.dispatchEvent(changeEvent);
  }

  onMouseMove(event) {
    if (this.mode === null) return;

    if (!this.did_move) {
      const settings = this.scene.gui.settings.Misc;
      if (settings.fast_draw) {
        this.subdivision = settings.subdivision;
        settings.subdivision = 1;
      }
    }

    this.did_move = true;

    if (this.mode == 'rotate') {
      this.rotateObject(new THREE.Vector3(1, 0, 0), 0.01 * event.movementY);
      this.rotateObject(new THREE.Vector3(0, 1, 0), 0.01 * event.movementX);
    }
    if (this.mode == 'move') {
      this.panObject(new THREE.Vector3(1, 0, 0), 0.004 * event.movementX);
      this.panObject(new THREE.Vector3(0, -1, 0), 0.004 * event.movementY);
    }
    if (this.mode == 'move_clipping_plane') {
      this.scene.gui.settings.Clipping.dist +=
        0.0001 * event.movementY * this.scene.mesh_radius;
      super.dispatchEvent(changeEvent);
    }
    event.preventDefault();
    this.update();
  }

  onTouchStart(event) {
    this.touchfirst = true;
    this.touchnum = event.targetTouches.length;
    if (event.targetTouches.length == 2) {
      this.oldtouch.x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      this.oldtouch.y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    if (event.targetTouches.length != this.touchnum) return;

    switch (event.targetTouches.length) {
      case 1:
        const pos = new THREE.Vector2(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        if (!this.touchfirst) {
          this.rotateObject(
            new THREE.Vector3(1, 0, 0),
            0.01 * (pos.y - this.oldtouch.y)
          );
          this.rotateObject(
            new THREE.Vector3(0, 1, 0),
            0.01 * (pos.x - this.oldtouch.x)
          );
        }
        this.oldtouch = pos;
        this.touchfirst = false;
        this.update();
        break;

      case 2: // 2 or more
        const dx = event.touches[0].pageX - event.touches[1].pageX;
        const dy = event.touches[0].pageY - event.touches[1].pageY;
        const delta = Math.sqrt(dx * dx + dy * dy);

        const pos_x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        const move_x = pos_x - this.oldtouch.x;
        const pos_y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
        const move_y = pos_y - this.oldtouch.y;

        if (!this.touchfirst) {
          const s = Math.exp(0.01 * (delta - this.olddelta));
          this.scale(s, pos_x, pos_y); // event.clientX, event.clientY);
          // if( this.scene.center_tag )
          //this.scene.center_tag.scale.multiplyScalar(1.0/s);
          this.panObject(new THREE.Vector3(1, 0, 0), 0.004 * move_x);
          this.panObject(new THREE.Vector3(0, -1, 0), 0.004 * move_y);
        }
        this.touchfirst = false;
        this.update();
        this.olddelta = delta;
        this.oldtouch.x = pos_x;
        this.oldtouch.y = pos_y;
        break;
    }
  }

  async scale(s: number, x: number, y: number) {
    let p = await this.scene.getPixelCoordinates(x, y);
    p = p || this.center;

    const m = new THREE.Matrix4().makeScale(s, s, s);
    wrapTransformation(m, p);
    this.mat.multiply(m);
    this.update();
  }

  async wheel(event) {
    event.preventDefault();
    event.stopPropagation();

    let dy = event.deltaY;
    if (event.deltaMode == 1)
      // 1==DOM_DELTA_LINE -> scroll in lines, not pixels
      dy *= 30;

    const s = Math.exp(-0.001 * dy);
    this.scale(s, event.clientX, event.clientY);
  }

  contextmenu(event) {
    event.preventDefault();
  }

  async onDblClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const p = await this.scene.getPixelCoordinates(
      event.clientX,
      event.clientY
    );
    if (p) {
      this.scene.uniforms.highlight_selected_face.value = false;
      this.scene.tooltip.style.visibility = 'hidden';
      this.center.copy(p);
      this.updateCenter();
    }
    this.scene.handleEvent('dblclick', [event, p]);
  }
}
