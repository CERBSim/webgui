import * as THREE from 'three';

// not to change from outside
const changeEvent = { type: 'change' };

function wrapTransformation( mat, vec ) {
    let v1 = new THREE.Matrix4();
    let v2 = new THREE.Matrix4();
    v1.makeTranslation( vec.x, vec.y, vec.z );
    v2.makeTranslation( -vec.x, -vec.y, -vec.z );
    mat.premultiply(v1);
    mat.multiply(v2);
    return mat;
}

export class CameraControls extends THREE.EventDispatcher {
    domElement: any;
    oldtouch:any = new THREE.Vector2(0,0);
    olddelta:any = 0;
    touchfirst:any = true;
    touchnum:any = 0;
    scene: any;
    center: any;
    mesh_radius: any;
    cameraObject: any;
    pivotObject: any;

    onSelect: any = null;

    mat = new THREE.Matrix4();
    mode = null;
    rotation_step_degree = 0.05;
    pan_step = 0.05;
    camera_step = 0.2;

    did_move: boolean = false;

    keys = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, CLOCKWISE: 65, COUNTERCLOCKWISE: 83};

    constructor(cameraObject, scene, domElement) {
        super();
        if ( domElement === undefined ) console.log( 'domElement is undefined' );
        if ( domElement === document ) console.error( '"document" should not be used as the target "domElement". Please use "renderer.domElement" instead.' );
        if ( !cameraObject.isPerspectiveCamera ) console.error('camera must be perspective camera');

        this.scene = scene;
        this.mesh_radius = scene.mesh_radius;
        this.center = scene.mesh_center.clone();
        const s = 1.0/this.mesh_radius;
        this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        this.mat.premultiply(new THREE.Matrix4().makeScale(s,s,s));

        this.cameraObject = cameraObject;
        this.pivotObject = scene.pivot;
        this.domElement = domElement;

        this.domElement.addEventListener('dblclick', (e)=>this.onDblClick(e), false);

        // this.domElement.addEventListener( 'mouseup', onMouseUp, false );
        window.addEventListener( 'mouseup', (e)=>this.onMouseUp(e), false );
        this.domElement.addEventListener( 'mousedown', (e)=>this.onMouseDown(e), false );
        this.domElement.addEventListener( 'contextmenu', (e)=>this.contextmenu(e), false );
        window.addEventListener( 'mousemove', (e)=>this.onMouseMove(e), false );

        this.domElement.addEventListener( 'touchmove', (e)=>this.onTouchMove(e), false );
        this.domElement.addEventListener( 'touchstart', (e)=>this.onTouchStart(e), false );

        //   window.addEventListener( 'keydown', keydown, false );
        this.domElement.addEventListener( 'wheel', (e)=>this.wheel(e), false );

        // make sure element can receive keys.
        if ( this.domElement.tabIndex === - 1 ) {
            this.domElement.tabIndex = 0;
        }
    }

    reset() {
        const s = 1.0/this.mesh_radius;
        this.center.copy(this.scene.mesh_center);
        this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        this.mat.premultiply(new THREE.Matrix4().makeScale(s,s,s));

        this.update();
        this.scene.setCenterTag();
    }

    update() {
        this.pivotObject.matrix.copy(this.mat);
        const aspect = this.domElement.offsetWidth/this.domElement.offsetHeight;
        let rotmat = new THREE.Matrix4();
        rotmat.extractRotation(this.mat);
        this.scene.axes_object.matrixWorld.makeTranslation(-0.85*aspect, -0.85, 0).multiply(rotmat);

        let vector = new THREE.Vector3();
        const rect = this.scene.canvas.getBoundingClientRect();
        for(let i=0; i< this.scene.labels.length; i++) {
            let {el, p} = this.scene.labels[i];
            if(this.scene.ortho_camera && i<3) {
                vector.copy(p).applyMatrix4(this.scene.axes_object.matrixWorld);
                vector.project( this.scene.ortho_camera );
                // map to 2D screen space
                const x = Math.round( (   vector.x + 1 ) * rect.width  / 2 );
                const y = Math.round( ( - vector.y + 1 ) * rect.height / 2 );
                el.style.display = "block";
                el.style.top  = `${y}px`;
                el.style.left = `${x}px`;
            }
            if(i>=3) {
                vector.copy(p).applyMatrix4(this.mat);
                vector.project( this.cameraObject );
                // map to 2D screen space
                const x = Math.round( (   vector.x + 1 ) * rect.width  / 2 );
                const y = Math.round( ( - vector.y + 1 ) * rect.height / 2 );
                el.style.display = "block";
                el.style.top  = `${y}px`;
                el.style.left = `${x}px`;
            }
        }
        super.dispatchEvent( changeEvent );
    }

    rotateObject(axis, rad) {
        var mat = new THREE.Matrix4();
        mat.makeRotationAxis(axis, rad);
        var transformed_center = this.center.clone();
        transformed_center.applyMatrix4(this.mat);
        wrapTransformation(mat, transformed_center);
        this.mat.premultiply(mat);
    }

    panObject(dir, dist) {
        var mat = new THREE.Matrix4();
        mat.makeTranslation(dist*dir.x, dist*dir.y, dist*dir.z);
        this.mat.premultiply(mat);
    }

    updateCenter() {
        let pos = new THREE.Vector3();
        let rot = new THREE.Quaternion();
        let scale = new THREE.Vector3();
        this.mat.decompose(pos,rot,scale);

        let rotmat = new THREE.Matrix4().makeRotationFromQuaternion(rot);
        wrapTransformation(rotmat, this.center);

        let s = scale.x;
        let scalemat = wrapTransformation(new THREE.Matrix4().makeScale(s,s,s), this.center);
        this.mat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        this.mat.multiply(rotmat);
        this.mat.multiply(scalemat);

        this.update();
        this.scene.setCenterTag();
    }

    loadSettings(settings) {
        if(settings.mat) {
            this.mat.copy( settings.mat );
            this.center.copy(settings.center);
            this.update();
            this.scene.setCenterTag();
        }
        if(settings.transformations) {
            for( let trans of settings.transformations ) {
                switch( trans.type ) {
                    case "move":
                        let v = trans.dir;
                        let dist = trans.dist || 1.0;
                        this.panObject( new THREE.Vecto3(v[0], v[1], v[2]), dist );
                        break;
                    case "rotateX":
                        console.log("rotate", trans);
                        this.rotateObject(new THREE.Vector3(1, 0, 0), trans.angle)
                        break;
                    case "rotateY":
                        this.rotateObject(new THREE.Vector3(0, 1, 0), trans.angle)
                        break;
                    case "rotateZ":
                        this.rotateObject(new THREE.Vector3(0, 0, 1), trans.angle)
                        break;
                }
            }
        }
    }

    storeSettings( settings ) {
        settings.mat = this.mat;
        settings.center = this.center;
    }

    keydown(event) {
        var needs_update = false;

        if (event.shiftKey){ // pan
            if (event.keyCode == this.keys.DOWN) {
                needs_update = true;
                this.panObject(new THREE.Vector3(0, -1, 0), this.pan_step)
            } else if (event.keyCode == this.keys.UP) {
                needs_update = true;
                this.panObject(new THREE.Vector3(0, 1, 0), this.pan_step)
            } else if (event.keyCode == this.keys.LEFT) {
                needs_update = true;
                this.panObject(new THREE.Vector3(-1, 0, 0), this.pan_step)
            } else if (event.keyCode == this.keys.RIGHT) {
                needs_update = true;
                this.panObject(new THREE.Vector3(1, 0, 0), this.pan_step)
            }

        } else { // rotate
            if (event.keyCode == this.keys.DOWN) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(1, 0, 0), this.rotation_step_degree)
            } else if (event.keyCode == this.keys.UP) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(-1, 0, 0), this.rotation_step_degree)
            } else if (event.keyCode == this.keys.LEFT) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(0, -1, 0), this.rotation_step_degree)
            } else if (event.keyCode == this.keys.RIGHT) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(0, 1, 0), this.rotation_step_degree)
            } else if (event.keyCode == this.keys.CLOCKWISE) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(0, 0, 1), this.rotation_step_degree)
            } else if (event.keyCode == this.keys.COUNTERCLOCKWISE) {
                needs_update = true;
                this.rotateObject(new THREE.Vector3(0, 0, -1), this.rotation_step_degree)
            }
        }

        if(needs_update) {
            event.preventDefault();
            this.update();
        }
    }

    onMouseDown(event) {
        this.did_move = false;
        if(event.button==0) {
            event.preventDefault();
            this.mode = "rotate";
        }
        if(event.button==2) {
            event.preventDefault();
            this.mode = event.ctrlKey ? "move_clipping_plane" : "move";
        }
        event.stopPropagation();
    }

    async onMouseUp(event) {
        this.mode = null;

        if(!this.did_move) {
            event.preventDefault();
            var rect = this.domElement.getBoundingClientRect();
            const index = await this.scene.getMeshIndex(event.clientX-rect.left, event.clientY-rect.top);
            if(this.onSelect)
                this.onSelect(index, event);
        }
        super.dispatchEvent( changeEvent );
    }


    onMouseMove(event) {
        var needs_update = false;
        this.did_move = true;

        if(this.mode=="rotate") {
            needs_update = true;
            this.rotateObject(new THREE.Vector3(1, 0, 0), 0.01*event.movementY);
            this.rotateObject(new THREE.Vector3(0, 1, 0), 0.01*event.movementX);
        }
        if(this.mode=="move") {
            needs_update = true;
            this.panObject(new THREE.Vector3(1, 0, 0), 0.004*event.movementX);
            this.panObject(new THREE.Vector3(0, -1, 0), 0.004*event.movementY);
        }
        if(this.mode=="move_clipping_plane") {
            this.scene.gui_status.Clipping.dist += 0.0001*event.movementY * this.scene.mesh_radius;
            this.scene.animate();
        }
        if(needs_update) {
            event.preventDefault();
            this.update();
        }
    }

    onTouchStart(event) {
        this.touchfirst = true;
        this.touchnum = event.targetTouches.length;
        if (event.targetTouches.length == 2) {
            this.oldtouch.x = 0.5*(event.touches[0].pageX+event.touches[1].pageX)
            this.oldtouch.y = 0.5*(event.touches[0].pageY+event.touches[1].pageY)
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if(event.targetTouches.length != this.touchnum)
            return;

        switch ( event.targetTouches.length ) {
            case 1:
                var pos = new THREE.Vector2(event.touches[0].pageX, event.touches[0].pageY);
                if (!this.touchfirst) {
                    this.rotateObject(new THREE.Vector3(1, 0, 0), 0.01*(pos.y-this.oldtouch.y));
                    this.rotateObject(new THREE.Vector3(0, 1, 0), 0.01*(pos.x-this.oldtouch.x));
                }
                this.oldtouch = pos;
                this.touchfirst = false;
                this.update();
                break;

            case 2: // 2 or more
                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var delta = Math.sqrt( dx * dx + dy * dy );

                const pos_x = 0.5*(event.touches[0].pageX+event.touches[1].pageX)
                const move_x = pos_x-this.oldtouch.x;
                const pos_y = 0.5*(event.touches[0].pageY+event.touches[1].pageY)
                const move_y = pos_y-this.oldtouch.y;

                if (!this.touchfirst) {
                    var s = Math.exp(0.01*(delta-this.olddelta));
                    this.scale(s, pos_x, pos_y); // event.clientX, event.clientY);
                    // if( this.scene.center_tag )
                        //this.scene.center_tag.scale.multiplyScalar(1.0/s);
                    this.panObject(new THREE.Vector3(1, 0, 0), 0.004*move_x);
                    this.panObject(new THREE.Vector3(0, -1, 0), 0.004*move_y);
                }
                this.touchfirst = false;
                this.update();
                this.olddelta = delta;
                this.oldtouch.x = pos_x;
                this.oldtouch.y = pos_y;
                break;
        }
    }

    async scale(s, x, y) {
        console.log("scale", s, x, y);
        var rect = this.domElement.getBoundingClientRect();
        let p = await this.scene.getPixelCoordinates(x-rect.left, y-rect.top);
        p = p || this.center;
        console.log("center", p, this.center);

        let m = new THREE.Matrix4().makeScale(s,s,s);
        wrapTransformation(m, p);
        this.mat.multiply(m);
        this.update();
        await this.scene.animate();
    }

    async wheel(event) {
        event.preventDefault();
        event.stopPropagation();

        let dy = event.deltaY;
        if(event.deltaMode==1) // 1==DOM_DELTA_LINE -> scroll in lines, not pixels
            dy *= 30;

        var s = Math.exp(-0.001*dy);
        this.scale(s, event.clientX, event.clientY);
    }

    contextmenu( event ) {
        event.preventDefault();
    }

    async onDblClick( event ){
        event.preventDefault();
        event.stopPropagation();
        var rect = this.domElement.getBoundingClientRect();
        const p = await this.scene.getPixelCoordinates(event.clientX-rect.left, event.clientY-rect.top);
        if(p) {
            this.scene.uniforms.highlight_selected_face.value = false;
            this.scene.tooltip.style.visibility = "hidden";
            this.center.copy(p);
            this.updateCenter();
        }
    }
}
