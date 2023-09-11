export default `
uniform sampler2D heightmap;
uniform sampler2D buildingmap;
uniform bool buildingView;

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

    vec2 cellSize = vec2( 1.0 / WIDTH, 1.0 / WIDTH );

    #include <uv_vertex>
    #include <color_vertex>

    // # include <beginnormal_vertex>
    // Compute normal from heightmap
    vec3 objectNormal = vec3(
        ( texture2D( heightmap, uv + vec2( - cellSize.x, 0 ) ).w - texture2D( heightmap, uv + vec2( cellSize.x, 0 ) ).w ) * WIDTH / BOUNDS,
        ( texture2D( heightmap, uv + vec2( 0, - cellSize.y ) ).w - texture2D( heightmap, uv + vec2( 0, cellSize.y ) ).w ) * WIDTH / BOUNDS,
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
    float heightValue = texture2D( heightmap, uv ).w;
    float building_height = texture2D( buildingmap, uv ).x;
    float r_height = 0.;
    if(buildingView){
        r_height = heightValue + building_height;
    }else{
        r_height = heightValue;
    }

    vec3 transformed = vec3( position.x, position.y, r_height);
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