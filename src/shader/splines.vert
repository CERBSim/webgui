varying vec3 p_;
// varying vec3 normal_;
varying vec3 value_;

uniform int n_segments;
uniform float aspect;
uniform float line_thickness;

attribute vec4 p0;
attribute vec4 p1;
attribute vec4 p2;
attribute vec4 p3;

attribute vec2 v0;
attribute vec2 v1;
attribute vec2 v2;
attribute vec2 v3;

attribute vec2 position;

mat3 getPositionAndValue( float t )
{
    mat3 ret;
    vec4 ps;
    vec3 position, value;

#if ORDER==1
    ps = t*p0 + (1.0-t)*p1;
    value.yz = t*v0 + (1.0-t)*v1;
#endif // ORDER==1

#if ORDER==2
    float b0 = (1.0-t)*(1.0-t);
    float b1 = 2.0*t*(1.0-t);
    float b2 = t*t;

    ps = b0*p0+b1*p1+b2*p2;
    value.yz = b0*v0+b1*v1+b2*v2;
#endif // ORDER==2

#if ORDER==3
    float b0 = (1.0-t)*(1.0-t)*(1.0-t);
    float b1 = 3.0*t*(1.0-t)*(1.0-t);
    float b2 = 3.0*t*t*(1.0-t);
    float b3 = t*t*t;
    ps = b0*p0+b1*p1+b2*p2+b3*p3;
    value.yz = b0*v0+b1*v1+b2*v2+b3*v3;
#endif // ORDER==3

    value.x = ps.w;
    position = ps.xyz;

    ret[0] = position;
    ret[1] = value;

    return ret;
}

void main()
{
  float t0 = (position.x)/float(n_segments);

  mat3 pos_and_val = getPositionAndValue(t0);
  vec3 value = pos_and_val[1];

  if(isNan(value)) {
      gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
      return;
  }

  vec4 p = vec4(pos_and_val[0],1);

#ifdef DEFORMATION
  p.xyz += deformation*value;
#endif
#ifdef DEFORMATION_2D
  p.z += GetValue(deformation*value);
#endif
  value_ = value;

  p_ = p.xyz;

  vec4 modelViewPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * modelViewPosition;

#ifdef THICK_LINES
  // thick lines, see https://mattdesl.svbtle.com/drawing-lines-is-hard#screenspace-projected-lines_2
  float t1 = (position.x+0.1)/float(n_segments);
  vec4 p1 = vec4(getPositionAndValue(t1)[0], 1);
  vec2 screen_p0 = gl_Position.xy / gl_Position.w;
  p1 = projectionMatrix * (modelViewMatrix * p1);
  vec2 screen_p1 = p1.xy / p1.w;

  screen_p0.x *= aspect;
  screen_p1.x *= aspect;

  vec2 dir = normalize(screen_p1 - screen_p0);
  vec2 normal = vec2(-dir.y, dir.x);

  normal *= line_thickness/2.0;
  normal.x /= aspect;

  gl_Position.xy += normal*position.y*gl_Position.w;
#endif // THICK_LINES
}
