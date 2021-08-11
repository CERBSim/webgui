varying vec4 color;

attribute vec3 position;
attribute vec2 times;
attribute float name_id;
attribute float rect_id;
attribute float level;

uniform float n_colors;
uniform int mode;
uniform float selected_rect;

void main()
{
  vec4 p = vec4(position, 1);

  p.y *= 0.95;

  if(mode==0)
  {
      color = texture2D(tex_colormap, vec2((name_id+0.5)/n_colors, 0.5));
      color.w = 1.0;
      color.xyz = (1.0-0.3*p.x)*color.xyz;
      if(selected_rect == rect_id)
      {
          // color.xyz = vec3(0,0,0);
          color.xyz *= 1.3;
          p.y /= 0.95;
      }
  }
  else
  {
      color = vec4(rect_id, 0., 0., 1.);
  }

  p.y -= 1.3 * level;

  p.x = times[0] + p.x*(times[1]-times[0]);
  p.z = level*1e-2;

  vec4 modelViewPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * modelViewPosition;
}
