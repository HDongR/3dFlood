import heightmapFragmentShader from '../shader/heightmapFragmentShader.js';
import waterVertexShader from '../shader/waterVertexShader.js';
import waterFragmentShader from '../shader/waterFragmentShader.js';
import smoothFragmentShader from '../shader/smoothFragmentShader.js';
import readWaterLevelFragmentShader from '../shader/readWaterLevelFragmentShader.js';

import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Texture width for simulation
const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
const BOUNDS_HALF = BOUNDS * 0.5;

let container, stats;
let camera, scene, renderer, controls;
let material;
let mouseMoved = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let waterMesh;
let meshRay;
let gpuCompute;
let heightmapVariable;
let waterUniforms;
let smoothShader;
let readWaterLevelShader;
let readWaterLevelRenderTarget;
let readWaterLevelImage;
const waterNormal = new THREE.Vector3();

const NUM_SPHERES = 5;
const spheres = [];
let spheresEnabled = true;

let setilView = false;

const simplex = new SimplexNoise();


console.log(GeoTIFF); 
let parseGeoTiff = async ()=>{
        
    const rawTiff = await GeoTIFF.fromUrl('/asset/daejeon_1.tif');
    const image = await rawTiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();
    const samplesPerPixel = image.getSamplesPerPixel();

    // when we are actually dealing with geo-data the following methods return
    // meaningful results:
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const bbox = image.getBoundingBox();
    
    const data = await image.readRasters({ interleave: true });
    console.log(data);


    init(data);
    animate();
}

parseGeoTiff();



function init(data) {
    
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.set( 0, 200, 350 );
    camera.lookAt( 0, 0, 0 );

    scene = new THREE.Scene();

    const sun = new THREE.DirectionalLight( 0xFFFFFF, 3.0 );
    sun.position.set( 300, 400, 175 );
    scene.add( sun );

    const sun2 = new THREE.DirectionalLight( 0x40A040, 2.0 );
    sun2.position.set( - 100, 350, - 200 );
    scene.add( sun2 );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.listenToKeyEvents( window ); // optional
    //controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    //controls.dampingFactor = 0.05;

    controls.screenSpacePanning = false;

    controls.minDistance = 100;
    controls.maxDistance = 500;

    controls.maxPolarAngle = Math.PI;


    stats = new Stats();
    container.appendChild( stats.dom );

    container.style.touchAction = 'none';
    container.addEventListener( 'pointermove', onPointerMove );

    document.addEventListener( 'keydown', function ( event ) {

        // W Pressed: Toggle wireframe
        if ( event.keyCode === 87 ) {

            waterMesh.material.wireframe = ! waterMesh.material.wireframe;
            waterMesh.material.needsUpdate = true;

        }

    } );

    window.addEventListener( 'resize', onWindowResize );


    const gui = new GUI();

    const effectController = {
        mouseSize: 20.0,
        viscosity: 0.98,
        spheresEnabled: spheresEnabled
    };

    const valuesChanger = function () {

        heightmapVariable.material.uniforms[ 'mouseSize' ].value = effectController.mouseSize;
        heightmapVariable.material.uniforms[ 'viscosityConstant' ].value = effectController.viscosity;
        spheresEnabled = effectController.spheresEnabled;
        for ( let i = 0; i < NUM_SPHERES; i ++ ) {

            if ( spheres[ i ] ) {

                spheres[ i ].visible = spheresEnabled;

            }

        }

    };
    const setilController = {
        'setilView': setilView
    };

    //gui.add( effectController, 'mouseSize', 1.0, 100.0, 1.0 ).onChange( valuesChanger );
    //gui.add( effectController, 'viscosity', 0.9, 0.999, 0.001 ).onChange( valuesChanger );
    gui.add(setilController, 'setilView' ).name('위성지도').onChange( (check)=>{
        console.log(check)

        material.uniforms[ 'setilView' ].value = check;
    } );
    // const buttonSmooth = {
    //     smoothWater: function () {

    //         smoothWater();

    //     }
    // };
    // gui.add( buttonSmooth, 'smoothWater' );


    initWater(data);

    //createSpheres();

    //valuesChanger();

}


function initWater(data) {
    
    const texture = new THREE.TextureLoader().load( "/asset/output_daejeon_proc2.png" );

    const materialColor = 0x555555;

    const geometry = new THREE.PlaneGeometry( BOUNDS, BOUNDS, BOUNDS - 1, BOUNDS - 1 );
    
    // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
    material = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
                'setilmap' : {value: texture},
                'setilView' :  {value: false },
            }
        ] ),
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader//THREE.ShaderChunk[ 'meshphong_frag' ]

    } );
    //const material = new THREE.MeshPhongMaterial({map:texture});

    
    material.lights = true;
    //material.map = texture; 
    // Material attributes from THREE.MeshPhongMaterial
    // Sets the uniforms with the material values
    material.uniforms[ 'diffuse' ].value = new THREE.Color( materialColor );
    material.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    material.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    material.uniforms[ 'opacity' ].value = material.opacity;

    // Defines
    material.defines.WIDTH = WIDTH.toFixed( 1 );
    material.defines.BOUNDS = BOUNDS.toFixed( 1 );

    waterUniforms = material.uniforms;

    waterMesh = new THREE.Mesh( geometry, material );
    waterMesh.rotation.x = - Math.PI / 2;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();

    scene.add( waterMesh );

    // THREE.Mesh just for mouse raycasting
    const geometryRay = new THREE.PlaneGeometry( BOUNDS, BOUNDS, 1, 1 );
    meshRay = new THREE.Mesh( geometryRay, new THREE.MeshBasicMaterial( { color: 0xFFFFFF, visible: false } ) );
    meshRay.rotation.x = - Math.PI / 2;
    meshRay.matrixAutoUpdate = false;
    meshRay.updateMatrix();
    scene.add( meshRay );


    // Creates the gpu computation class and sets it up

    gpuCompute = new GPUComputationRenderer( BOUNDS, BOUNDS, renderer );

    if ( renderer.capabilities.isWebGL2 === false ) {

        gpuCompute.setDataType( THREE.HalfFloatType );

    }

    const heightmap0 = gpuCompute.createTexture();

    fillTexture( heightmap0, data );
    heightmap0.flipY = true;
    heightmapVariable = gpuCompute.addVariable( 'heightmap', heightmapFragmentShader, heightmap0 );

    gpuCompute.setVariableDependencies( heightmapVariable, [ heightmapVariable ] );

    heightmapVariable.material.uniforms[ 'mousePos' ] = { value: new THREE.Vector2( 10000, 10000 ) };
    heightmapVariable.material.uniforms[ 'mouseSize' ] = { value: 20.0 };
    heightmapVariable.material.uniforms[ 'viscosityConstant' ] = { value: 0.98 };
    heightmapVariable.material.uniforms[ 'heightCompensation' ] = { value: 0 };
    heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed( 1 );

    const error = gpuCompute.init();
    if ( error !== null ) {

        console.error( error );

    }

    // Create compute shader to smooth the water surface and velocity
    //smoothShader = gpuCompute.createShaderMaterial( smoothFragmentShader, { smoothTexture: { value: null } } );

    // Create compute shader to read water level
    // readWaterLevelShader = gpuCompute.createShaderMaterial( readWaterLevelFragmentShader, {
    //     point1: { value: new THREE.Vector2() },
    //     levelTexture: { value: null }
    // } );
    //readWaterLevelShader.defines.WIDTH = WIDTH.toFixed( 1 );
    //readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed( 1 );

    // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
    //readWaterLevelImage = new Uint8Array( 4 * 1 * 4 );

    // readWaterLevelRenderTarget = new THREE.WebGLRenderTarget( 4, 1, {
    //     wrapS: THREE.ClampToEdgeWrapping,
    //     wrapT: THREE.ClampToEdgeWrapping,
    //     minFilter: THREE.NearestFilter,
    //     magFilter: THREE.NearestFilter,
    //     format: THREE.RGBAFormat,
    //     type: THREE.UnsignedByteType,
    //     depthBuffer: false
    // } );

}

function fillTexture( texture, data ) {

    const waterMaxHeight = 10;

    function noise( x, y ) {

        let multR = waterMaxHeight;
        let mult = 0.025;
        let r = 0;
        for ( let i = 0; i < 15; i ++ ) {

            r += multR * simplex.noise( x * mult, y * mult );
            multR *= 0.53 + 0.025 * i;
            mult *= 1.25;

        }

        return r;

    }

    const pixels = texture.image.data;

    let p = 0;
    //let cnt = BOUNDS * BOUNDS - 1;
    let cnt = 0;
    for ( let j = 0; j < BOUNDS; j ++ ) {

        for ( let i = 0; i < BOUNDS; i ++ ) {

            //const x = i * 128 / BOUNDS;
            //const y = j * 128 / BOUNDS;

            pixels[ p + 0 ] = data[cnt]//noise(x, y);
            pixels[ p + 1 ] = 0//pixels[ p + 0 ];
            pixels[ p + 2 ] = 0;
            pixels[ p + 3 ] = 0;

            p+=4;
            cnt++;

        }

    }

}

function smoothWater() {

    const currentRenderTarget = gpuCompute.getCurrentRenderTarget( heightmapVariable );
    const alternateRenderTarget = gpuCompute.getAlternateRenderTarget( heightmapVariable );

    for ( let i = 0; i < 10; i ++ ) {

        smoothShader.uniforms[ 'smoothTexture' ].value = currentRenderTarget.texture;
        gpuCompute.doRenderTarget( smoothShader, alternateRenderTarget );

        smoothShader.uniforms[ 'smoothTexture' ].value = alternateRenderTarget.texture;
        gpuCompute.doRenderTarget( smoothShader, currentRenderTarget );

    }

}

function createSpheres() {

    const sphereTemplate = new THREE.Mesh( new THREE.SphereGeometry( 4, 24, 12 ), new THREE.MeshPhongMaterial( { color: 0xFFFF00 } ) );

    for ( let i = 0; i < NUM_SPHERES; i ++ ) {

        let sphere = sphereTemplate;
        if ( i < NUM_SPHERES - 1 ) {

            sphere = sphereTemplate.clone();

        }

        sphere.position.x = ( Math.random() - 0.5 ) * BOUNDS * 0.7;
        sphere.position.z = ( Math.random() - 0.5 ) * BOUNDS * 0.7;

        sphere.userData.velocity = new THREE.Vector3();

        scene.add( sphere );

        spheres[ i ] = sphere;

    }

}

function sphereDynamics() {

    const currentRenderTarget = gpuCompute.getCurrentRenderTarget( heightmapVariable );

    readWaterLevelShader.uniforms[ 'levelTexture' ].value = currentRenderTarget.texture;

    for ( let i = 0; i < NUM_SPHERES; i ++ ) {

        const sphere = spheres[ i ];

        if ( sphere ) {

            // Read water level and orientation
            const u = 0.5 * sphere.position.x / BOUNDS_HALF + 0.5;
            const v = 1 - ( 0.5 * sphere.position.z / BOUNDS_HALF + 0.5 );
            readWaterLevelShader.uniforms[ 'point1' ].value.set( u, v );
            gpuCompute.doRenderTarget( readWaterLevelShader, readWaterLevelRenderTarget );

            renderer.readRenderTargetPixels( readWaterLevelRenderTarget, 0, 0, 4, 1, readWaterLevelImage );
            const pixels = new Float32Array( readWaterLevelImage.buffer );

            // Get orientation
            waterNormal.set( pixels[ 1 ], 0, - pixels[ 2 ] );

            const pos = sphere.position;

            // Set height
            pos.y = pixels[ 0 ];

            // Move sphere
            waterNormal.multiplyScalar( 0.1 );
            sphere.userData.velocity.add( waterNormal );
            sphere.userData.velocity.multiplyScalar( 0.998 );
            pos.add( sphere.userData.velocity );

            if ( pos.x < - BOUNDS_HALF ) {

                pos.x = - BOUNDS_HALF + 0.001;
                sphere.userData.velocity.x *= - 0.3;

            } else if ( pos.x > BOUNDS_HALF ) {

                pos.x = BOUNDS_HALF - 0.001;
                sphere.userData.velocity.x *= - 0.3;

            }

            if ( pos.z < - BOUNDS_HALF ) {

                pos.z = - BOUNDS_HALF + 0.001;
                sphere.userData.velocity.z *= - 0.3;

            } else if ( pos.z > BOUNDS_HALF ) {

                pos.z = BOUNDS_HALF - 0.001;
                sphere.userData.velocity.z *= - 0.3;

            }

        }

    }

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function setMouseCoords( x, y ) {

    mouseCoords.set( ( x / renderer.domElement.clientWidth ) * 2 - 1, - ( y / renderer.domElement.clientHeight ) * 2 + 1 );
    mouseMoved = true;

}

function onPointerMove( event ) {

    if ( event.isPrimary === false ) return;

    setMouseCoords( event.clientX, event.clientY );

}

function animate() {

    requestAnimationFrame( animate );

    render();
    stats.update();

}

function render() {

    // Set uniforms: mouse interaction
    //const uniforms = heightmapVariable.material.uniforms;
    // if ( mouseMoved ) {

    //     raycaster.setFromCamera( mouseCoords, camera );

    //     const intersects = raycaster.intersectObject( meshRay );

    //     if ( intersects.length > 0 ) {

    //         const point = intersects[ 0 ].point;
    //         uniforms[ 'mousePos' ].value.set( point.x, point.z );

    //     } else {

    //         uniforms[ 'mousePos' ].value.set( 10000, 10000 );

    //     }

    //     mouseMoved = false;

    // } else {

    //     uniforms[ 'mousePos' ].value.set( 10000, 10000 );

    // }

    // Do the gpu computation
    //gpuCompute.compute();

    // if ( spheresEnabled ) {

    //     sphereDynamics();

    // }

    // Get compute output in custom uniform
    waterUniforms[ 'heightmap' ].value = gpuCompute.getCurrentRenderTarget( heightmapVariable ).texture;

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Render
    renderer.render( scene, camera );
}