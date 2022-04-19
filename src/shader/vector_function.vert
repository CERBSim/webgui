uniform sampler2D tex_values;
uniform float grid_size;
uniform vec3 clipping_plane_c;
uniform vec3 clipping_plane_t1;
uniform vec3 clipping_plane_t2;
uniform float vectors_offset;

// default attributes (from arrow-geometry)
attribute vec3 position;
attribute vec3 normal;

// instance attributes
// attribute vec3 position_buffer;
// attribute vec3 rotation_buffer;

// attribute float vertid;
attribute vec2 arrowid;

varying vec3 p_;
varying vec3 normal_;
varying vec3 value_;

void main() {
    value_ = texture2D(tex_values, arrowid).xyz;
    if(length(value_)==0.0)
    {
      gl_Position = vec4(0,0,0,1);
      return;
    }

    vec4 quat = quaternion(value_);
    float size = 0.5*length(clipping_plane_t1);
    p_ = clipping_plane_c;
    p_ += grid_size* (arrowid.x-0.5) * clipping_plane_t1;
    p_ += grid_size* (arrowid.y-0.5) * clipping_plane_t2;
    p_ += size*rotate(position, quat);
    p_ += vectors_offset*size*clipping_plane.xyz;


    // diffuse-shading
    normal_ = rotate(normalMatrix * normal, quat);

    // instance-transform, mesh-transform and projection
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p_, 1.0);
}
