varying vec3 p_;
varying vec3 normal_;
varying vec3 value_;
uniform int n_segments;

attribute vec2 position;

void main()
{
  float u = (position.x)/float(n_segments);
  float v = (position.y)/float(n_segments);

  float w = 1.0-u-v;

  vec4 pv = GetPositionAndScalar(u,v);
  value_.x = pv.w;
  value_.yz = GetVectorValues(u,v);
  /* if(isNan(value_)) { */
  /*     gl_Position = vec4(0.0, 0.0, 0.0, 0.0); */
  /*     return; */
  /* } */

  normal_ = GetNormal(u,v);

#ifdef DEFORMATION
  pv.xyz += deformation*value_;
#endif
#ifdef DEFORMATION_2D
  pv.z += GetValue(deformation*value_);
#endif

  vec4 p = vec4(pv.xyz,1);
  p_ = p.xyz;
  vec4 modelViewPosition = modelViewMatrix * vec4(pv.xyz, 1.0); //0.. dir, 1.. pos
  normal_ =  normalMatrix*normal_;

  gl_Position = projectionMatrix * modelViewPosition;
}
