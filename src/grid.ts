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

function toString( x ) {
  if(Math.abs(x)<1e-15)
    return 0.0.toPrecision(2);

  return x.toPrecision(2);
}


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
  style += 'position: absolute; z-index: 1; display:block; translate(-50%, -50%);';

  element.style.cssText = style; //("style", style);
  element.setAttribute("style", style);
  // element.style.transform = "translate(-50%, -50%);";
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

  constructor( parent, p_, h, n, normaldir)
  {
    super();

    const n0 = n;
    const n1 = n;

    let v0 = new THREE.Vector3(0,0,0);
    let v1 = new THREE.Vector3(0,0,0);
    let d0, d1;

    if(normaldir=='x')
    {
      d0 = 'y';
      d1 = 'z';
    }

    if(normaldir=='y')
    {
      d0 = 'x';
      d1 = 'z';
    }

    if(normaldir=='z')
    {
      d0 = 'x';
      d1 = 'y';
    }

    v0[d0] = h;
    v1[d1] = h;


    let vertices = []

    let p = new THREE.Vector3();
    p.copy(p_);

    let p0 = new THREE.Vector3();
    let p1 = new THREE.Vector3()
    p0.copy(p);
    p1.copy(p);
    p1.addScaledVector(v1, n1);

    this.labels = [];

    let lp0 = new THREE.Vector3();
    let lp1 = new THREE.Vector3();
    lp0.copy(p0).addScaledVector(v1, -0.5);
    lp1.copy(p1).addScaledVector(v1, 0.2);


    for ( let i=0; i<=n0; i++ ) {
      vertices.push( p0.x, p0.y, p0.z );
      vertices.push( p1.x, p1.y, p1.z );
      if(i>0 && i<n0)
      {
        // this.labels.push( Label3D( parent, lp0, `${toString(p0[d0])}` ) );
        this.labels.push( Label3D( parent, lp1, `${toString(p1[d0])}` ) );
      }
      p0.add(v0);
      p1.add(v0);
      lp0.add(v0);
      lp1.add(v0);
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

  updateLabelPositions( canvas, camera, matrix, visible ) {
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

        if(visible && (y<rect.top || y>rect.bottom || x>rect.right || x<rect.left))
          el.style.display = "block";
        else
          el.style.display = "none";

        el.style.top  = `${y}px`;
        el.style.left = `${x}px`;
      }

  }
}


function roundFloatTo125( x ) {
  let scale = 1.0;

  while(x<1.0) {
    scale /= 10;
    x*=10;
  }

  while(x>=10.0) {
    scale *= 10;
    x/=10;
  }

  if(x<1.5)
    return scale;

  if(x<3.5)
    return 2*scale;

  if(x<7.5)
    return 5*scale;

  return 10*scale;
}

function roundDownToMultiple( x, h ) {
  const n = Math.floor(x/h);
  return n*h;
}

function roundUpToMultiple( x, h ) {
  const n = Math.ceil(x/h);
  return n*h;
}

export function Grid3D ( parent, bounding_sphere) {

  let center = bounding_sphere.center;
  let radius = bounding_sphere.radius;

  let n = 7;
  let h = roundFloatTo125(2*radius/n);

  const x0 = roundDownToMultiple(center.x - radius, h);
  const nx = Math.round((roundUpToMultiple(center.x + radius, h)-x0)/h);
  const y0 = roundDownToMultiple(center.y - radius, h);
  const ny = Math.round((roundUpToMultiple(center.y + radius, h)-y0)/h);
  const z0 = roundDownToMultiple(center.z - radius, h);
  const nz = Math.round((roundUpToMultiple(center.z + radius, h)-z0)/h);

  const vertices = [];

  const vx = new THREE.Vector3(h, 0, 0);
  const vy = new THREE.Vector3(0, h, 0);
  const vz = new THREE.Vector3(0, 0, h);

  let p = new THREE.Vector3();
  p.copy(center).addScaledVector(vx, -0.5*n).addScaledVector(vy, -0.5*n).addScaledVector(vz, -0.5*n);

  let group = new THREE.Group();
  let planes = [];
  planes.push(new PlaneGridWithLabels( parent, p, h, n, 'x'));
  planes.push(new PlaneGridWithLabels( parent, p, h, n, 'y'));
  planes.push(new PlaneGridWithLabels( parent, p, h, n, 'z'));

  for (const p of planes)
    group.add(p);

  group.updateLabelPositions = (canvas, camera, matrix) => {
    for(const p of planes)
      p.updateLabelPositions(canvas, camera, matrix, group.visible);
  };
  return group;
}
