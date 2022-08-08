varying vec3 p_;
varying vec3 normal_;
varying vec3 value_;

uniform bool render_depth;

uniform int selected_face;
uniform int highlight_selected_face;

#ifdef USER_FUNCTION
vec3 userFunction( vec3 value, vec3 p, vec3 normal )
{
  return vec3(USER_FUNCTION);
}
#endif // USER_FUNCTION

void main()
{
  vec3 value = value_;
#ifdef USER_FUNCTION
  value = userFunction(value_, p_, normal_);
#endif // USER_FUNCTION

  if( isBehindClippingPlane(p_) )
    discard;

#ifdef NO_FUNCTION_VALUES
  vec4 color = vec4(.7,.7,.7,1);
#else
  vec4 color = getColor(GetValue(value));
  if(color.w == 0.0)
    discard;
#endif

  if(function_mode == 4.0)
  {
    gl_FragColor = vec4(value, 1.0);
    return;
  }

  if(function_mode == 7.0)
  {
   if(getColor(value_.x).w == 0.0)
      discard;
    gl_FragColor = vec4(2, value_.x, value_.y, 1.0);
    return;
  }


  if (render_depth) {
      gl_FragColor = getPositionAsColor(p_);
      return;
  }


  vec3 norm = normal_;
  bool inside = false;
#ifndef SKIP_FACE_CHECK
  if (gl_FrontFacing == false) {
    norm = (-1.0)*normal_;
    inside = true;
  }
#endif // SKIP_FACE_CHECK

  gl_FragColor = calcLight( color, p_, norm, inside);

  if(highlight_selected_face==2 && selected_face == int(value_.x+0.5))
      gl_FragColor = gl_FragColor + vec4(0.3,0.3,0.3,0);


}
