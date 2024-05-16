uniform float line_thickness;

// default attributes (from cylinder-geometry)
attribute vec3 position;
attribute vec3 normal;

// instance attributes
attribute vec3 pstart;
attribute vec3 pend;
attribute float value;

varying vec3 p_;
varying vec3 normal_;
varying vec3 value_;

void main() {
    float len = length(pend-pstart);
    vec4 quat = quaternion(pend-pstart);
    vec3 p = vec3(line_thickness, len, line_thickness)*position;
    p_ = pstart;
    p_ += rotate(p, quat);

    normal_ = rotate(normalMatrix * normal, quat);

    value_ = vec3(value,0,0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p_, 1.0);
}
