import * as THREE from 'three';

// not to change from outside
const changeEvent = { type: 'change' };

export class CameraControls extends THREE.EventDispatcher {
    domElement: any;
    oldtouch:any = new THREE.Vector2(0,0);
    olddelta:any = 0;
    touchfirst:any = true;
    scene: any;
    center: any;
    mesh_radius: any;
    cameraObject: any;
    pivotObject: any;

    transmat = new THREE.Matrix4();
    rotmat = new THREE.Matrix4();
    centermat = new THREE.Matrix4();
    transformationmat = new THREE.Matrix4();
    scale: number;
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
        this.scale = 1.0/this.mesh_radius;
        this.centermat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);

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

        //   window.addEventListener( 'keydown', keydown, false );
        this.domElement.addEventListener( 'wheel', (e)=>this.wheel(e), false );

        // make sure element can receive keys.
        if ( this.domElement.tabIndex === - 1 ) {
            this.domElement.tabIndex = 0;
        }
    }

    reset() {
        this.transmat.identity();
        this.rotmat.identity();
        this.centermat.identity();
        this.transformationmat.identity();
        this.scale = 1.0/this.mesh_radius;
        this.center.copy(this.scene.mesh_center);
        this.centermat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        this.update();
        this.scene.setCenterTag();
    }

    update() {
        var scale_vec = new THREE.Vector3();
        scale_vec.setScalar(this.scale);
        this.pivotObject.matrix.copy(this.transmat).multiply(this.rotmat).scale(scale_vec).multiply(this.centermat);
        const aspect = this.domElement.offsetWidth/this.domElement.offsetHeight;
        this.scene.axes_object.matrixWorld.makeTranslation(-0.85*aspect, -0.85, 0).multiply(this.rotmat);

        let vector = new THREE.Vector3();
        const rect = this.scene.canvas.getBoundingClientRect();
        for(let {el, p} of this.scene.labels) {
            if(this.scene.ortho_camera) {
                vector.copy(p).applyMatrix4(this.scene.axes_object.matrixWorld);
                vector.project( this.scene.ortho_camera );
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
        this.rotmat.premultiply(mat);
    }

    panObject(dir, dist) {
        var mat = new THREE.Matrix4();
        mat.makeTranslation(dist*dir.x, dist*dir.y, dist*dir.z);
        this.transmat.premultiply(mat);
    }

    updateCenter() {
        console.log("set mesh center to", this.center);
        this.centermat.makeTranslation(-this.center.x, -this.center.y, -this.center.z);
        this.transmat.identity();
        this.scene.setCenterTag();
        this.update();
    }

    loadSettings(settings) {
        this.transmat.copy( settings.transmat );
        this.rotmat.copy( settings.rotmat );
        this.centermat.copy( settings.centermat );
        this.transformationmat.copy( settings.transformationmat );
        this.scale = settings.scale;
        this.center.copy(settings.center);
        this.update();
        this.scene.setCenterTag();
    }

    storeSettings( settings ) {
        settings.transmat = this.transmat;
        settings.rotmat = this.rotmat;
        settings.centermat = this.centermat;
        settings.transformationmat = this.transformationmat;
        settings.scale = this.scale;
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
            this.mode = "move";
        }
        event.stopPropagation();
    }

    onMouseUp(event) {
        this.mode = null;
        super.dispatchEvent( changeEvent );

        if(!this.did_move) {
            event.preventDefault();
            var rect = this.domElement.getBoundingClientRect();
            this.scene.mouse.set(event.clientX-rect.left, event.clientY-rect.top);
            this.scene.get_face_index = true;
            super.dispatchEvent( changeEvent );
        }
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
        if(needs_update) {
            event.preventDefault();
            this.update();
        }
    }

    onTouchStart(event) {
        this.touchfirst = true;
    }

    onTouchMove(event) {
        event.preventDefault();

        switch ( event.touches.length ) {
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

            default: // 2 or more
                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var delta = Math.sqrt( dx * dx + dy * dy );
                if (!this.touchfirst) {
                    var s = Math.exp(0.01*(delta-this.olddelta));
                    this.scale *=  s;
                    if( this.scene.center_tag )
                        this.scene.center_tag.scale.multiplyScalar(1.0/s);
                }
                this.touchfirst = false;
                this.update();
                this.olddelta = delta;
                break;
        }
    }

    wheel(event) {
        event.preventDefault();
        event.stopPropagation();

        let dy = event.deltaY;
        if(event.deltaMode==1) // 1==DOM_DELTA_LINE -> scroll in lines, not pixels
            dy *= 30;

        var s = Math.exp(-0.001*dy);
        this.scale *=  s ;
        if( this.scene.center_tag )
            this.scene.center_tag.scale.multiplyScalar(1.0/s);
        this.update();
    }

    contextmenu( event ) {
        event.preventDefault();
    }

    onDblClick( event ){
        event.preventDefault();
        var rect = this.domElement.getBoundingClientRect();
        this.scene.mouse.set(event.clientX-rect.left, event.clientY-rect.top);
        this.scene.get_pixel = true;
        super.dispatchEvent( changeEvent );
    }
}
