/*
import { 
  LineSegments,
  LineBasicMaterial,
  Mesh,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  Float32BufferAttribute,
  BufferGeometry,
  Vector3,
  Object3D,
} from 'three';
*/

import * as THREE from 'three';
// import TextSprite from '@seregpie/three.text-sprite';

function Label3D (  parent, p, text ) {

  /*
  const instance :any = new TextSprite({
    alignment: 'left',
    color: '#24ff00',
    fontSize: 8,
    fontStyle: 'italic',
    text: text,
  });
  console.log("sprite", instance);
  instance.position.set(p.x, p.y, p.z);
  return instance;
  */







  // const obj = new THREE.Points();

  // obj.position.set(p.x, p.y, p.z)
  // obj.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [p.x, p.y, p.z] , 3 ) );
  const element = document.createElement("div");
  var el_text = document.createTextNode(text);
  element.appendChild(el_text)

  parent.appendChild(element);

  let style = '-moz-user-select: none; -webkit-user-select: none; -ms-user-select:none; onselectstart="return false;';
  style += 'onmousedown="return false; user-select:none;-o-user-select:none;unselectable="on";';
  style += 'position: absolute; z-index: 1; display:block;';

  element.setAttribute("style", style+`transform: translate(-50%, -50%);`);
  element.style.transform = `translate(-50%, -50%); top(0px,0px)`;
  element.style.top = '0px';
  element.style.left = '0px';

  return { el: element, p: new THREE.Vector3().copy(p) };

  /*
  obj.onBeforeRender = ( renderer, scene, camera, geometry, material, group) => {
    console.log("camera", camera);
    obj.updateWorldMatrix(true, false);
    var vector = new THREE.Vector3();
    var canvas = renderer.domElement;

    vector.copy(obj.position);

    // map to normalized device coordinate (NDC) space
    vector.project( camera );
    console.log(vector.x, vector.y);

    // map to 2D screen space
    const x = Math.round( (   vector.x + 1 ) * canvas.width  / 2 );
    const y = Math.round( (   vector.y + 1 ) * canvas.height / 2 );

    // console.log(vector.x, vector.y);
    // element.setAttribute("style", style+`transform: translate(-50%, -50%); left: ${vector.x}px; top: ${vector.y}px` );
    element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
  };
  return obj;
  */
}

class PlaneGridWithLabels extends THREE.Group {
  labels : any;

  constructor( parent, p_, v0, v1, n0, n1 )
  {
    super();
    let vertices = []

    let p = new THREE.Vector3();
    p.copy(p_);

    let p0 = new THREE.Vector3();
    let p1 = new THREE.Vector3()
    p0.copy(p);
    p1.copy(p);
    p1.addScaledVector(v1, n1);

    this.labels = [];

    for ( let i=0; i<=n0; i++ ) {
      vertices.push( p0.x, p0.y, p0.z );
      vertices.push( p1.x, p1.y, p1.z );
      this.labels.push( Label3D( parent, p0, `${i}` ) );
      this.labels.push( Label3D( parent, p1, `${i}` ) );
      p0.add(v0);
      p1.add(v0);
    }

    p0.copy(p);
    p1.copy(p);
    p1.addScaledVector(v0, n0);
    for ( let i=0; i<=n1; i++ ) {
      vertices.push( p0.x, p0.y, p0.z );
      vertices.push( p1.x, p1.y, p1.z );
      p0.add(v1);
      p1.add(v1);
    }

    const line_geo = new THREE.BufferGeometry();
    line_geo.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    const line_mat = new THREE.LineBasicMaterial( { color: 'black' } );
    /*
    line_mat.polygonOffset = true;
    line_mat.polygonOffsetFactor = 1.0;
    line_mat.polygonOffsetUnits = 1.0;
    */

    const lines = new THREE.LineSegments(line_geo, line_mat);
    super.add ( lines );

    // for( const l of this.labels )
    //   super.add( l );

    p0.copy(p).addScaledVector(v0, n0);
    p1.copy(p).addScaledVector(v1, n1);
    vertices = [];
    vertices.push( p.x, p.y, p.z );
    vertices.push( p0.x, p0.y, p0.z );
    vertices.push( p1.x, p1.y, p1.z );

    p.addScaledVector(v0,n0).addScaledVector(v1,n1);
    vertices.push( p.x, p.y, p.z );
    vertices.push( p0.x, p0.y, p0.z );
    vertices.push( p1.x, p1.y, p1.z );

    const mesh_geo = new THREE.BufferGeometry();
    mesh_geo.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    const mesh_mat = new THREE.MeshBasicMaterial( { color: 'lightgrey', side: THREE.DoubleSide } );
    super.add ( new THREE.Mesh(mesh_geo, mesh_mat) );
  }

  updateLabelPositions( canvas, camera, matrix ) {
    var vector = new THREE.Vector3();
    const rect = canvas.getBoundingClientRect();

    for(let {el, p} of this.labels)
      {
        vector.copy(p).applyMatrix4(matrix);

        // map to normalized device coordinate (NDC) space
        vector.project( camera );

        // map to 2D screen space
        const x = Math.round( (   vector.x + 1 ) * rect.width  / 2 );
        const y = Math.round( ( - vector.y + 1 ) * rect.height / 2 );

        el.style.top  = `${y}px`;
        el.style.left = `${x}px`;
      }

  }
}



export function Grid3D ( parent, bounding_sphere) {

  const center = bounding_sphere.center;
  const radius = bounding_sphere.radius;


  const x0 = center.x - radius;
  const x1 = center.x + radius;
  const y0 = center.y - radius;
  const y1 = center.y + radius;
  const z0 = center.z - radius;
  const z1 = center.z + radius;

  const n = 12;

  const vertices = [];

  const vx = new THREE.Vector3((x1-x0)/n, 0, 0);
  const vy = new THREE.Vector3(0, (y1-y0)/n, 0);
  const vz = new THREE.Vector3(0, 0, (z1-z0)/n);

  let p = new THREE.Vector3();
  p.copy(center).addScaledVector(vx, -0.5*n).addScaledVector(vy, -0.5*n).addScaledVector(vz, -0.5*n);

  let group = new THREE.Group();
  let planes = [];
  planes.push(new PlaneGridWithLabels( parent, p, vx, vy, n, n ));
  planes.push(new PlaneGridWithLabels( parent, p, vy, vz, n, n ));
  planes.push(new PlaneGridWithLabels( parent, p, vx, vz, n, n ));

  for (const p of planes)
    group.add(p);

  group.updateLabelPositions = (canvas, camera, matrix) => {
    for(const p of planes)
      p.updateLabelPositions(canvas, camera, matrix);
  };
  return group;
}
