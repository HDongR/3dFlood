export default `
#define PHONG

uniform sampler2D heightmap;
uniform sampler2D buildingmap;
uniform bool setilView;
uniform sampler2D setilmap; 

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

varying vec2 vUv;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	#include <clipping_planes_fragment>

	vec4 diffuseColor = vec4( diffuse, 0.5 );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	//modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
	
	vec4 height = texture2D(heightmap, vUv);
    float h = height.z;
	
	float x = 0.;
	float y = 1.;
	float value = h;

	if(h <= 0.01){
		discard;
	}

	float alpha = clamp((value - x) / (y - x), 0., 1.);

	float radius = 0.5;
	float x1 = 0.1;
	float x2 = 0.1;
	float P = radius * sqrt(1.0f - x1); // this will scale x1 into P with range <0,radius> but change the distribution to uniform number of points inside disc
    float theta = x2 * 2.0 * PI; // this will scale x2 to theta in range <0,6.28>
    vec2 o2 = vec2(P * cos(theta), P * sin(theta));
	alpha = o2.x;

	if(setilView){
		vec3 mx = vec3(texture2D( setilmap, vUv));
		gl_FragColor.xyz = mix(mx, gl_FragColor.rgb, alpha);
	}else{
		gl_FragColor.xyz = vec3(1.0, 0., 0.);
	}
	gl_FragColor.a = 1.0;
	

}
`;