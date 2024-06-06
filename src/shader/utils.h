precision highp float;

uniform mat4 viewMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform vec4 clipping_plane;
uniform bool do_clipping;

uniform sampler2D tex_colormap;
uniform float colormap_min;
uniform float colormap_max;
uniform vec2 colormap_size;

uniform bool dark_backside;
uniform vec3 light_dir;
uniform vec4 light_mat; // x=ambient, y=diffuse, z=shininess, w=specularity

// 0-2 ... function component
// 3   ... norm
// 4   ... all 3 components (as rgb)
// 5   ... real part
// 6   ... imag part
// 7   ... geometry information (node type, index)
// 8   ... coordinates as rgb

uniform float function_mode;
uniform vec2 complex_scale;
uniform float complex_deform;
uniform float deformation;

uniform vec2 trafo;

bool isNan(float val)
{
  return (val <= 0.0 || 0.0 <= val) ? false : true;
}

bool isNan(vec3 v)
{
  return isNan(v.x+v.y+v.z);
}

float GetValue( vec3 value )
{
  if(function_mode==0.0) return value.x;
  if(function_mode==1.0) return value.y;
  if(function_mode==2.0) return value.z;
  if(function_mode==3.0) return length(value);
  if(function_mode==5.0) return value.x*complex_scale.x - value.y*complex_scale.y;
  if(function_mode==6.0) return value.x*complex_scale.y + value.y*complex_scale.x;
  return 0.0;
}

///////////////////////////////////////////////////////////////////////////////
#ifdef VERTEX_SHADER
#ifdef MESH_2D

/////////////////////////////////////////////
#if ORDER==1
attribute vec4 p0;
attribute vec4 p1;
attribute vec4 p2;

attribute vec2 v0;
attribute vec2 v1;
attribute vec2 v2;

#ifdef HAVE_NORMALS
attribute vec3 n0;
attribute vec3 n1;
attribute vec3 n2;
#endif // HAVE_NORMALS

vec4 GetPositionAndScalar(float u, float v)
{
  float w = 1.0-u-v;
  return u*p0 + v*p1 + w*p2;
}

vec3 GetNormal(float u, float v)
{
#ifdef HAVE_NORMALS
  float w = 1.0-u-v;
  return normalize(u*n0 + v*n1 + w*n2);
#else // HAVE_NORMALS
  vec4 du = p1-p0;
  vec4 dv = p2-p0;
  return normalize(cross(du.xyz, dv.xyz));
#endif // HAVE_NORMALS
}

vec2 GetVectorValues(float u, float v)
{
  float w = 1.0-u-v;
  return u*v0 + v*v1 + w*v2;
}

#endif // ORDER==1

/////////////////////////////////////////////
#if ORDER==2

attribute vec4 p00;
attribute vec4 p01;
attribute vec4 p02;
attribute vec4 p10;
attribute vec4 p11;
attribute vec4 p20;

attribute vec4 vec00_01;
attribute vec4 vec02_10;
attribute vec4 vec11_20;

vec4 GetPositionAndScalar(float u, float v)
{
  float w = 1.0-u-v;

  float b00 = u*u;
  float b01 = 2.0*u*v;
  float b02 = v*v;
  float b10 = 2.0*u*w;
  float b11 = 2.0*v*w;
  float b20 = w*w;

  vec4 position = b00*p00+b01*p01+b02*p02 +
    b10*p10+b11*p11 +
    b20*p20;
  return position;
}

vec3 GetNormal(float u, float v)
{
  float w = 1.0-u-v;

  float B00 = 2.0*u;
  float B01 = 2.0*v;
  float B10 = 2.0*w;

  vec4 du = B00*(p00-p10) + B01*(p01-p11) + B10*(p10-p20);
  vec4 dv = B00*(p01-p10) + B01*(p02-p11) + B10*(p11-p20);

  #ifdef DEFORMATION
    du.x += deformation*du.w;
    dv.x += deformation*dv.w;
    vec2 d00 = vec00_01.xy;
    vec2 d01 = vec00_01.zw;
    vec2 d02 = vec02_10.xy;
    vec2 d10 = vec02_10.zw;
    vec2 d11 = vec11_20.xy;
    vec2 d20 = vec11_20.zw;

    du.yz += deformation*(B00*(d00-d10) + B01*(d01-d11) + B10*(d10-d20));
    dv.yz += deformation*(B00*(d01-d10) + B01*(d02-d11) + B10*(d11-d20));
  #endif // DEFORMATION
  #ifdef DEFORMATION_2D
    du.z += deformation*du.w;
    dv.z += deformation*dv.w;
  #endif

  return normalize(cross(du.xyz, dv.xyz));
}

vec2 GetVectorValues(float u, float v)
{
  float w = 1.0-u-v;

  float b00 = u*u;
  float b01 = 2.0*u*v;
  float b02 = v*v;
  float b10 = 2.0*u*w;
  float b11 = 2.0*v*w;
  float b20 = w*w;

  vec2 v00 = vec00_01.xy;
  vec2 v01 = vec00_01.zw;
  vec2 v02 = vec02_10.xy;
  vec2 v10 = vec02_10.zw;
  vec2 v11 = vec11_20.xy;
  vec2 v20 = vec11_20.zw;

  vec2 values = b00*v00+b01*v01+b02*v02 +
    b10*v10+b11*v11 +
    b20*v20;
  return values;
}

#endif // ORDER==2

/////////////////////////////////////////////
#if ORDER==3
attribute vec4 p00;
attribute vec4 p01;
attribute vec4 p02;
attribute vec4 p03;
attribute vec4 p10;
attribute vec4 p11;
attribute vec4 p12;
attribute vec4 p20;
attribute vec4 p21;
attribute vec4 p30;

attribute vec4 vec00_01;
attribute vec4 vec02_03;
attribute vec4 vec10_11;
attribute vec4 vec12_20;
attribute vec4 vec21_30;

vec4 GetPositionAndScalar(float u, float v)
{
  float w = 1.0-u-v;

  float b00 = u*u*u;
  float b01 = 3.0*u*u*v;
  float b02 = 3.0*u*v*v;
  float b03 = v*v*v;
  float b10 = 3.0*u*u*w;
  float b11 = 6.0*u*v*w;
  float b12 = 3.0*v*v*w;
  float b20 = 3.0*u*w*w;
  float b21 = 3.0*v*w*w;
  float b30 = w*w*w;

  vec4 position = b00*p00+b01*p01+b02*p02+b03*p03 +
    b10*p10+b11*p11+b12*p12 +
    b20*p20+b21*p21 +
    b30*p30;

  return position;
}

vec3 GetNormal(float u, float v)
{
  float w = 1.0-u-v;

  float B00 = 3.0*u*u;
  float B01 = 6.0*u*v;
  float B02 = 3.0*v*v;
  float B10 = 6.0*u*w;
  float B11 = 6.0*v*w;
  float B20 = 3.0*w*w;

  vec4 du = B00*(p00-p10) + B01*(p01-p11) + B02*(p02-p12) +
            B10*(p10-p20) + B11*(p11-p21) +
            B20*(p20-p30);
  vec4 dv = B00*(p01-p10) + B01*(p02-p11) + B02*(p03-p12) +
            B10*(p11-p20) + B11*(p12-p21) +
            B20*(p21-p30);
#ifdef DEFORMATION
  du.x += deformation*du.w;
  dv.x += deformation*dv.w;

  vec2 d00 = vec00_01.xy;
  vec2 d01 = vec00_01.zw;
  vec2 d02 = vec02_03.xy;
  vec2 d03 = vec02_03.zw;
  vec2 d10 = vec10_11.xy;
  vec2 d11 = vec10_11.zw;
  vec2 d12 = vec12_20.xy;
  vec2 d20 = vec12_20.zw;
  vec2 d21 = vec21_30.xy;
  vec2 d30 = vec21_30.zw;

  du.yz += deformation*(B00*(d00-d10) + B01*(d01-d11) + B02*(d02-d12) +
            B10*(d10-d20) + B11*(d11-d21) +
            B20*(d20-d30));
  dv.yz += deformation*(B00*(d01-d10) + B01*(d02-d11) + B02*(d03-d12) +
            B10*(d11-d20) + B11*(d12-d21) +
            B20*(d21-d30));
#endif // DEFORMATION
#ifdef DEFORMATION_2D
  du.z += deformation*du.w;
  dv.z += deformation*dv.w;
#endif
  return normalize(cross(du.xyz, dv.xyz));
}

vec2 GetVectorValues(float u, float v)
{
  float w = 1.0-u-v;

  vec2 v00 = vec00_01.xy;
  vec2 v01 = vec00_01.zw;
  vec2 v02 = vec02_03.xy;
  vec2 v03 = vec02_03.zw;
  vec2 v10 = vec10_11.xy;
  vec2 v11 = vec10_11.zw;
  vec2 v12 = vec12_20.xy;
  vec2 v20 = vec12_20.zw;
  vec2 v21 = vec21_30.xy;
  vec2 v30 = vec21_30.zw;

  float b00 = u*u*u;
  float b01 = 3.0*u*u*v;
  float b02 = 3.0*u*v*v;
  float b03 = v*v*v;
  float b10 = 3.0*u*u*w;
  float b11 = 6.0*u*v*w;
  float b12 = 3.0*v*v*w;
  float b20 = 3.0*u*w*w;
  float b21 = 3.0*v*w*w;
  float b30 = w*w*w;

  vec2 values = b00*v00+b01*v01+b02*v02+b03*v03 +
    b10*v10+b11*v11+b12*v12 +
    b20*v20+b21*v21 +
    b30*v30;

  return values;
}

float GetImagValue(float u, float v) {
  return GetVectorValues(u,v).x;
}

#endif // ODER==3
#endif // MESH_2D
#endif // VERTEX_SHADER
///////////////////////////////////////////////////////////////////////////////
vec4 getPositionAsColor(vec3 pos){
  vec4 ret_val = vec4(0.0,0.0,0.0,1.0);
  ret_val.x = pos.x*trafo.x+trafo.y;
  ret_val.y = pos.y*trafo.x+trafo.y;
  ret_val.z = pos.z*trafo.x+trafo.y;

  return ret_val;
}

bool isBehindClippingPlane(vec3 pos)
{
#ifdef NO_CLIPPING
  return false;
#else // NO_CLIPPING
  return do_clipping && dot(clipping_plane, vec4(pos, 1.0)) < 0.0;
#endif // NO_CLIPPING
}

vec4 getColor(float value)
{
  float x = 0.0;
  float y = 0.5;
  if(colormap_size.y > 1.0)
  {
      x = mod(value, colormap_size.x);
      y = ((value-x) / colormap_size.x)/(colormap_size.y-1.);
      x = x/(colormap_size.x-1.);
  }
  else if(colormap_size.x > 1.0)
      x = value/(colormap_size.x-1.);
  else
      x = (value-colormap_min)/(colormap_max-colormap_min);
  return texture2D(tex_colormap, vec2(x, y));
}

vec4 calcLight(vec4 color, vec3 position, vec3 norm, bool inside)
{
  vec3 n = normalize(norm);
  vec3 s = light_dir;
  vec4 p = modelViewMatrix * vec4( position, 1);
  vec3 v = normalize( -p.xyz );
  vec3 r = reflect( -s, n );

  float light_ambient = light_mat.x;
  float light_diffuse = light_mat.y;
  float light_shininess = light_mat.z;
  float light_spec = light_mat.w;

  float sDotN;
  float dimm = 1.0;
  if (dark_backside && inside) {
    dimm  = 0.5;
  }

  sDotN = max( dot( s, n ), 0.0 );
#ifdef SIDE_LIGHTS
  sDotN *= 0.8;
  const float c = 0.3;
  vec3 s0 = normalize( vec3(  1, 1, c ) );
  vec3 s1 = normalize( vec3( -1, 1, c ) );
  vec3 s2 = normalize( vec3( -1,-1, c ) );
  vec3 s3 = normalize( vec3(  1,-1, c ) );

  sDotN += 0.4*max( dot( s0, n ), 0.0 );
  sDotN += 0.4*max( dot( s1, n ), 0.0 );
  sDotN += 0.4*max( dot( s2, n ), 0.0 );
  sDotN += 0.4*max( dot( s3, n ), 0.0 );
#endif // SIDE_LIGHTS

  float diffuse = light_diffuse * sDotN;

  // spec = Light[lightIndex].Ls * Material.Ks * pow( max( dot(r,v) , 0.0 ), Material.Shininess );
  float spec = pow( max( dot(r,v) , 0.0 ), light_shininess );
  if(diffuse==0.0 || light_shininess==0.0) spec = 0.0;
  return vec4(dimm*(color.xyz*(light_ambient+diffuse) + spec*light_spec*vec3(1,1,1)), color.w);
}

vec4 quaternion(vec3 vTo){
    vec3 vFrom = vec3(0.0, 1.0, 0.0);
    float EPS = 0.000001;
    // assume that vectors are not normalized
    float n = length(vTo);
    float r = n + dot(vFrom, vTo);
    vec3 tmp;

	if ( r < EPS ) {
		r = 0.0;
		    if ( abs(vFrom.x) > abs(vFrom.z) ) {
                tmp = vec3(-vFrom.y, vFrom.x, 0.0);
			} else {
                tmp = vec3(0, -vFrom.z, vFrom.y);
			}
    } else {
        tmp = cross(vFrom, vTo);
    }
	return normalize(vec4(tmp.x, tmp.y, tmp.z, r));
}

// apply a rotation-quaternion to the given vector
// (source: https://goo.gl/Cq3FU0)
vec3 rotate(const vec3 v, const vec4 q) {
vec3 t = 2.0 * cross(q.xyz, v);
return v + q.w * t + cross(q.xyz, t);
}

