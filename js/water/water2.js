import {
	Clock,
	Color,
	Matrix4,
	Mesh,
	RepeatWrapping,
	ShaderMaterial,
	TextureLoader,
	UniformsLib,
	UniformsUtils,
	Vector2,
	Vector4
} from 'three';
import { Reflector } from '../jsm/objects/Reflector.js';
import { Refractor } from '../jsm/objects/Refractor.js';

/**
 * References:
 *	https://alex.vlachos.com/graphics/Vlachos-SIGGRAPH10-WaterFlow.pdf
 *	http://graphicsrunner.blogspot.de/2010/08/water-using-flow-maps.html
 *
 */

class Water2 extends Mesh {

	constructor( geometry, options = {} ) {

		super( geometry );

		this.isWater = true;

		this.type = 'Water';

		const scope = this;

		const color = ( options.color !== undefined ) ? new Color( options.color ) : new Color( 0xFFFFFF );
		const textureWidth = options.textureWidth || 512;
		const textureHeight = options.textureHeight || 512;
		const clipBias = options.clipBias || 0;
		const flowDirection = options.flowDirection || new Vector2( 1, 0 );
		const flowSpeed = options.flowSpeed || 0.03;
		const reflectivity = options.reflectivity || 0.52;
		const scale = options.scale || 0.1;
		const shader = options.shader || Water2.WaterShader;

		const textureLoader = new TextureLoader();

		const normalMap0 = options.normalMap0 || textureLoader.load( '/js/water/Water_1_M_Normal.jpg' );
		const normalMap1 = options.normalMap1 || textureLoader.load( '/js/water/Water_2_M_Normal.jpg' );

		const cycle = 0.15; // a cycle of a flow map phase
		const halfCycle = cycle * 0.5;
		const textureMatrix = new Matrix4();
		const clock = new Clock();

		// internal components

		if ( Reflector === undefined ) {

			console.error( 'THREE.Water: Required component Reflector not found.' );
			return;

		}

		if ( Refractor === undefined ) {

			console.error( 'THREE.Water: Required component Refractor not found.' );
			return;

		}

		const reflector = new Reflector( geometry, {
			textureWidth: textureWidth,
			textureHeight: textureHeight,
			clipBias: clipBias
		} );

		const refractor = new Refractor( geometry, {
			textureWidth: textureWidth,
			textureHeight: textureHeight,
			clipBias: clipBias
		} );

		reflector.matrixAutoUpdate = false;
		refractor.matrixAutoUpdate = false;

		// material

		this.material = new ShaderMaterial( {
			uniforms: UniformsUtils.merge( [
				{'setilView' : {value: true }},
				shader.uniforms
			] ),
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			transparent: true,
		} );

	

		

		// maps

		normalMap0.wrapS = normalMap0.wrapT = RepeatWrapping;
		normalMap1.wrapS = normalMap1.wrapT = RepeatWrapping;

		this.material.uniforms[ 'tReflectionMap' ].value = reflector.getRenderTarget().texture;
		this.material.uniforms[ 'tRefractionMap' ].value = refractor.getRenderTarget().texture;
		this.material.uniforms[ 'tNormalMap0' ].value = normalMap0;
		this.material.uniforms[ 'tNormalMap1' ].value = normalMap1;

		// water

		this.material.uniforms[ 'color' ].value = color;
		this.material.uniforms[ 'reflectivity' ].value = reflectivity;
		this.material.uniforms[ 'textureMatrix' ].value = textureMatrix;
		this.material.uniforms[ 'setilView' ].value = true;

		// inital values

		this.material.uniforms[ 'config' ].value.x = 0; // flowMapOffset0
		this.material.uniforms[ 'config' ].value.y = halfCycle; // flowMapOffset1
		this.material.uniforms[ 'config' ].value.z = halfCycle; // halfCycle
		this.material.uniforms[ 'config' ].value.w = scale; // scale

		// functions

		function updateTextureMatrix( camera ) {

			textureMatrix.set(
				0.5, 0.0, 0.0, 0.5,
				0.0, 0.5, 0.0, 0.5,
				0.0, 0.0, 0.5, 0.5,
				0.0, 0.0, 0.0, 1.0
			);

			textureMatrix.multiply( camera.projectionMatrix );
			textureMatrix.multiply( camera.matrixWorldInverse );
			textureMatrix.multiply( scope.matrixWorld );

		}

		function updateFlow() {

			const delta = clock.getDelta();
			const config = scope.material.uniforms[ 'config' ];

			config.value.x += flowSpeed * delta; // flowMapOffset0
			config.value.y = config.value.x + halfCycle; // flowMapOffset1

			// Important: The distance between offsets should be always the value of "halfCycle".
			// Moreover, both offsets should be in the range of [ 0, cycle ].
			// This approach ensures a smooth water flow and avoids "reset" effects.

			if ( config.value.x >= cycle ) {

				config.value.x = 0;
				config.value.y = halfCycle;

			} else if ( config.value.y >= cycle ) {

				config.value.y = config.value.y - cycle;

			}

		}

		//

		this.onBeforeRender = function ( renderer, scene, camera ) {

			updateTextureMatrix( camera );
			updateFlow();

			scope.visible = false;

			reflector.matrixWorld.copy( scope.matrixWorld );
			refractor.matrixWorld.copy( scope.matrixWorld );

			reflector.onBeforeRender( renderer, scene, camera );
			refractor.onBeforeRender( renderer, scene, camera );

			scope.visible = true;

		};

	}

}

Water2.WaterShader = {

	uniforms: {

		'heightmap': {
			type: 't',
			value: null
		},
		'originmap': {
			type: 't',
			value: null
		},
		'buildingmap': {
			type: 't',
			value: null
		},
		'setilmap': {
			type: 't',
			value: null
		},
		'unit': {
			type: 'f',
			value: 0
		},
		'color': {
			type: 'c',
			value: null
		},

		'reflectivity': {
			type: 'f',
			value: 0
		},

		'tReflectionMap': {
			type: 't',
			value: null
		},

		'tRefractionMap': {
			type: 't',
			value: null
		},

		'tNormalMap0': {
			type: 't',
			value: null
		},

		'tNormalMap1': {
			type: 't',
			value: null
		},

		'textureMatrix': {
			type: 'm4',
			value: null
		},

		'config': {
			type: 'v4',
			value: new Vector4()
		}

	},

	vertexShader: /* glsl */`

		uniform sampler2D heightmap;

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

		uniform mat4 textureMatrix;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		void main() {

			vUv = uv;
			vCoord = textureMatrix * vec4( position, 1.0 );

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vToEye = cameraPosition - worldPosition.xyz;

			//vec4 mvPosition =  viewMatrix * worldPosition; // used in fog_vertex
			//gl_Position = projectionMatrix * mvPosition;

			#include <uv_vertex>
			#include <color_vertex>

			// # include <beginnormal_vertex>
			// Compute normal from heightmap
			vec3 objectNormal = vec3(1.0, 1.0, 1.0 );
			//<beginnormal_vertex>

			#include <morphnormal_vertex>
			#include <skinbase_vertex>
			#include <skinnormal_vertex>
			#include <defaultnormal_vertex>

		#ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

			vNormal = normalize( transformedNormal );

		#endif


			vec4 data = texture2D( heightmap, uv );
			float height = data.z > 0.0 ? data.z + data.w : 0.0;
			
			vec3 transformed = vec3( position.x, position.y, height);

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

		}`,

	fragmentShader: /* glsl */`

		uniform sampler2D heightmap;
		uniform sampler2D buildingmap;
		uniform bool setilView;
		uniform float unit;
		uniform sampler2D setilmap; 

		#include <common>
		#include <logdepthbuf_pars_fragment>

		uniform sampler2D tReflectionMap;
		uniform sampler2D tRefractionMap;
		uniform sampler2D tNormalMap0;
		uniform sampler2D tNormalMap1;
			

		uniform vec3 color;
		uniform float reflectivity;
		uniform vec4 config;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		#define discardWaterHeight 0.1

		void main() {

			#include <logdepthbuf_fragment>

			float flowMapOffset0 = config.x;
			float flowMapOffset1 = config.y;
			float halfCycle = config.z;
			float scale = config.w;

			vec3 toEye = normalize( vToEye );

			// determine flow direction
			vec2 flow = texture2D( heightmap, vUv ).xy * 2.0 - 1.0;
			//flow *= 1000.;
			//flow.x *= - 1.0;

			// sample normal maps (distort uvs with flowdata)
			vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );
			vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );

			// linear interpolate to get the final normal color
			float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;
			vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );

			// calculate normal vector
			vec3 normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );

			// calculate the fresnel term to blend reflection and refraction maps
			float theta = max( dot( toEye, normal ), 0.0 );
			float reflectance = reflectivity + ( 1.0 - reflectivity ) * pow( ( 1.0 - theta ), 5.0 );

			// calculate final uv coords
			vec3 coord = vCoord.xyz / vCoord.w;
			vec2 uv = coord.xy + coord.z * normal.xz * 0.05;

			vec4 reflectColor = texture2D( tReflectionMap, vec2( 1.0 - uv.x, uv.y ) );
			vec4 refractColor = texture2D( tRefractionMap, uv );


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

			// multiply water color with the mix of both textures
			vec4 originColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );
			
			float alpha = mix(0., 1., clamp(data.z, 0., 1.));
	
			if(setilView){
				vec3 mx = vec3(texture2D( setilmap, vUv));
				vec3 color = mix(mx, originColor.rgb, alpha);
				gl_FragColor = vec4(color, 1.);
			}else{
				gl_FragColor.xyz = gl_FragColor.rgb;
			}
			//gl_FragColor.a = 1.;

			

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`

};

export { Water2 };
