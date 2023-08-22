varying vec3 p_;
varying vec3 value_;

uniform bool render_depth;

uniform int selected_face;
uniform int highlight_selected_face;

#ifdef HAVE_COLORS
uniform sampler2D edges_colormap;
uniform float edges_colormap_min;
uniform float edges_colormap_max;
uniform vec2 edges_colormap_size;


vec4 getEdgeColor(float value)
{
  float x = 0.0;
  float y = 0.5;
  if(edges_colormap_size.y > 1.0)
  {
      x = mod(value, edges_colormap_size.x)/(edges_colormap_size.x-1.);
      y = (value - x*edges_colormap_size.x)/(edges_colormap_size.y-1.);
  }
  else if(edges_colormap_size.x > 1.0)
      x = value/(edges_colormap_size.x-1.);
  else
      x = (value-edges_colormap_min)/(edges_colormap_max-edges_colormap_min);
  return texture2D(edges_colormap, vec2(x, y));
}
#endif // HAVE_COLORS

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

  if(function_mode == 7.0)
  {
    gl_FragColor = vec4(1, value_.x, value_.y, 1.0);
    return;
  }

#ifdef HAVE_COLORS
  gl_FragColor = getEdgeColor(value_.x);
#else // HAVE_COLORS
  gl_FragColor = vec4(0,0,0, 1);
#endif // HAVE_COLORS

  if(highlight_selected_face==1 && selected_face == int(value_.x+0.5))
      gl_FragColor = gl_FragColor + vec4(0.3,0.3,0.3,0);

}
