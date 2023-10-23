export default `
#define PHONG

uniform sampler2D heightmap;
uniform sampler2D buildingmap;
uniform bool setilView;
uniform float unit;
uniform sampler2D setilmap; 
uniform sampler2D uvmap; 
uniform sampler2D thismap;
uniform sampler2D tNormalMap0;
uniform sampler2D tNormalMap1;
uniform mat4 textureMatrix;
uniform vec4 config;

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

varying vec2 vUv;
varying vec4 vCoord;

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

#define discardWaterHeight 0.1

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
	
	vec4 data = texture2D(heightmap, vUv); 
	
	if(data.z > discardWaterHeight){
						
		vec2 posLeft = vUv + vec2( - unit, 0.0 );
		vec2 posRight = vUv + vec2( unit, 0.0  );
		vec2 posTop = vUv + vec2( 0.0, unit );
		vec2 posBottom = vUv + vec2( 0.0, - unit );

		vec2 posRightTop = vUv + vec2( unit, unit );
		vec2 posRightBottom = vUv + vec2( unit, - unit );
		vec2 posLeftTop = vUv + vec2( - unit, unit );
		vec2 posLeftBottom = vUv + vec2( - unit, - unit );

		vec4 _pos = texture2D(buildingmap, vUv);

		vec4 _posLeft = texture2D(buildingmap, posLeft);
		vec4 _posRight = texture2D(buildingmap, posRight);
		vec4 _posTop = texture2D(buildingmap, posTop);
		vec4 _posBottom = texture2D(buildingmap, posBottom);
		vec4 h_posLeft = texture2D(heightmap, posLeft);
		vec4 h_posRight = texture2D(heightmap, posRight);
		vec4 h_posTop = texture2D(heightmap, posTop);
		vec4 h_posBottom = texture2D(heightmap, posBottom);
		 
		vec4 _posRightTop = texture2D(buildingmap, posRightTop);
		vec4 _posRightBottom = texture2D(buildingmap, posRightBottom);
		vec4 _posLeftTop = texture2D(buildingmap, posLeftTop);
		vec4 _posLeftBottom = texture2D(buildingmap, posLeftBottom);
		vec4 h_posRightTop = texture2D(heightmap, posRightTop);
		vec4 h_posRightBottom = texture2D(heightmap, posRightBottom);
		vec4 h_posLeftTop = texture2D(heightmap, posLeftTop);
		vec4 h_posLeftBottom = texture2D(heightmap, posLeftBottom);

		if(
			_pos.x > 0.
			&&
			_posLeft.x > 0.
			&&
			_posRight.x > 0.
			&&
			_posTop.x > 0.
			&&
			_posBottom.x > 0.
			&&
			_posRightTop.x > 0.
			&&
			_posRightBottom.x > 0.
			&&
			_posLeftTop.x > 0.
			&&
			_posLeftBottom.x > 0.
			){
			
		}else if(_posLeft.x > 0. && h_posLeft.z <= discardWaterHeight){
			discard;
		}else if(_posRight.x > 0. && h_posRight.z <= discardWaterHeight){
			discard;
		}else if(_posTop.x > 0. && h_posTop.z <= discardWaterHeight){
			discard;
		}else if(_posBottom.x > 0. && h_posBottom.z <= discardWaterHeight){
			discard;
		}

		else if(_posRightTop.x > 0. && h_posRightTop.z <= discardWaterHeight){
			discard;
		}
		else if(_posRightBottom.x > 0. && h_posRightBottom.z <= discardWaterHeight){
			discard;
		}
		else if(_posLeftTop.x > 0. && h_posLeftTop.z <= discardWaterHeight){
			discard;
		}
		else if(_posLeftBottom.x > 0. && h_posLeftBottom.z <= discardWaterHeight){
			discard;
		}
	}
	if(data.z <= discardWaterHeight){
		discard;
	}

	vec2 flow = data.xy;
	float flowMapOffset0 = config.x;
	float flowMapOffset1 = config.y;
	float halfCycle = config.z;
	float scale = config.w;
	vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );
	vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );
	// linear interpolate to get the final normal color
	float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;
	vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );
	vec4 norm = normalize(normalColor);
	float alpha = mix(0., 1., clamp(data.z, 0., 1.));
	
	if(setilView){
		vec3 mx = vec3(texture2D( setilmap, vUv));
		gl_FragColor = mix(vec4(mx,1.0), norm+gl_FragColor, alpha);
	}else{
		gl_FragColor = normalColor;
	}

	//gl_FragColor = normalColor;

}
`;