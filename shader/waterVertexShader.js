export default `
uniform sampler2D heightmap;
uniform mat4 textureMatrix;

#define PHONG

varying vec3 vViewPosition;

#ifndef FLAT_SHADED

    varying vec3 vNormal;

#endif

#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

varying vec2 vUv;

void main() {
    vUv = uv;

    vec2 cellSize = vec2( 1.0 / BOUNDS, 1.0 / BOUNDS );
   
    #include <uv_vertex>
    #include <color_vertex>

    // # include <beginnormal_vertex>
    // Compute normal from heightmap
    //vec3 objectNormal = vec3(1.0, 1.0, 1.0 );
    vec3 objectNormal = vec3(
        ( texture2D( heightmap, uv + vec2( - cellSize.x, 0 ) ).z - texture2D( heightmap, uv + vec2( cellSize.x, 0 ) ).z ) * 1. / 1.,
        ( texture2D( heightmap, uv + vec2( 0, - cellSize.y ) ).z - texture2D( heightmap, uv + vec2( 0, cellSize.y ) ).z ) * 1. / 1.,
        1.0 );
    //<beginnormal_vertex>

    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>

#ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

    vNormal = normalize( transformedNormal );

#endif

    //# include <begin_vertex>
    vec4 data = texture2D( heightmap, uv ); 

    float height = data.z > 0.0 ? data.z + data.w : 0.0;

    vec3 transformed = vec3( position.x, position.y, height);
    //<begin_vertex>

    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <displacementmap_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    vViewPosition = - mvPosition.xyz;

    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <shadowmap_vertex>

}
`;