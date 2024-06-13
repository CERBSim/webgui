uniform float fieldline_thickness;
uniform float fieldline_phase;
uniform float fieldline_max_phase_dist;
uniform float fieldline_fade_dist;
uniform int fieldline_is_complex;

// default attributes (from cylinder-geometry)
attribute vec3 position;
attribute vec3 normal;

// instance attributes
attribute vec3 pstart;
attribute vec3 pend;
attribute float value;
attribute float phase;

varying vec3 p_;
varying vec3 normal_;
varying vec3 value_;

float fade(float t) {
  return 1.0-clamp(t*t*t*(t*(t*6.0-15.0)+10.0), 0.0, 1.0);
}

void main() {
    float phase_dist = abs(phase - fieldline_phase);
    if( phase_dist > fieldline_max_phase_dist + 2.*fieldline_fade_dist) {
      gl_Position = vec4(0,0,0,0);
      return;
    }
    float thickness = fieldline_thickness;
    if(fieldline_fade_dist>0. && phase_dist>fieldline_max_phase_dist) {
      float d = (phase_dist-fieldline_max_phase_dist)/fieldline_fade_dist;
      thickness *= fade(d);
    }
    float len = length(pend-pstart);
    vec4 quat = quaternion(pend-pstart);
    vec3 p = vec3(thickness, len, thickness)*position;
    p_ = pstart;
    p_ += rotate(p, quat);

    normal_ = rotate(normalMatrix * normal, quat);

    value_ = vec3(value,0,0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p_, 1.0);
}
