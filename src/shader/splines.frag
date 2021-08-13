varying vec3 p_;
varying vec3 value_;

uniform bool render_depth;

uniform int selected_face;
uniform bool highlight_selected_face;


void main()
{
  if (render_depth) {
    gl_FragColor = getPositionAsColor(p_);
    return;
  }
  if( isBehindClippingPlane(p_) )
    discard;

  if(function_mode == 4.0)
  {
    gl_FragColor = vec4(value_, 1.0);
    return;
  }

  gl_FragColor = vec4(0,0,0, 1);

  if(highlight_selected_face && selected_face == int(value_.x+0.5))
      gl_FragColor = gl_FragColor + vec4(0.3,0.3,0.3,0);

}
