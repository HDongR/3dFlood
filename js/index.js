import heightmapFragmentShader from '../shader/heightmapFragmentShader.js';
import waterVertexShader from '../shader/waterVertexShader.js';
import waterFragmentShader from '../shader/waterFragmentShader.js';
import terrainVertexShader from '../shader/terrainVertexShader.js';
import terrainFragmentShader from '../shader/terrainFragmentShader.js';
import smoothFragmentShader from '../shader/smoothFragmentShader.js';
import readWaterLevelFragmentShader from '../shader/readWaterLevelFragmentShader.js';
import prefix from '../shader/prefix.js';
import velocity from '../shader/step/velocity.js';
import height from '../shader/step/height.js';
import advect from '../shader/step/advect.js';

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
let waterMaterial;
let mouseMoved = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let waterMesh;
let terrainMesh;
let meshRay;
let gpuCompute;
let heightmapVariable;
let smoothShader;
let readWaterLevelShader;
let readWaterLevelRenderTarget;
let readWaterLevelImage;
const waterNormal = new THREE.Vector3();

const NUM_SPHERES = 5;
const spheres = [];
let spheresEnabled = true;

let setilView = false;
let buildingView = false;

const simplex = new SimplexNoise();

let step_2_height;
let step_3_velocity;

async function parseTif(src){
    const rawTiff = await GeoTIFF.fromUrl(src);
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
    return data;
}

async function parseGeoTiff(){
    const tifData = await parseTif('/asset/daejeon_1.tif');
    const buildingData = await parseTif('/asset/building_1.tif');
    
    init(tifData, buildingData);
    animate();
}

parseGeoTiff();



function init(data, buildingData) {
    
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

            terrainMesh.material.wireframe = ! terrainMesh.material.wireframe;
            terrainMesh.material.needsUpdate = true;

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

    const buildingController = {
        'buildingView': buildingView
    };

    //gui.add( effectController, 'mouseSize', 1.0, 100.0, 1.0 ).onChange( valuesChanger );
    //gui.add( effectController, 'viscosity', 0.9, 0.999, 0.001 ).onChange( valuesChanger );
    gui.add(setilController, 'setilView' ).name('위성지도').onChange( (check)=>{
        console.log(check)

        material.uniforms[ 'setilView' ].value = check;
    } );
    gui.add(buildingController, 'buildingView' ).name('건물').onChange( (check)=>{
        console.log(check)

        material.uniforms[ 'buildingView' ].value = check;
    } );
    // const buttonSmooth = {
    //     smoothWater: function () {

    //         smoothWater();

    //     }
    // };
    // gui.add( buttonSmooth, 'smoothWater' );


    initWater(data, buildingData);

    //createSpheres();

    //valuesChanger();

}


function initWater(data, buildingData) {
    
    const texture = new THREE.TextureLoader().load( "/asset/output_daejeon_proc2.png" );
 

    const geometry = new THREE.PlaneGeometry( BOUNDS, BOUNDS, BOUNDS - 1, BOUNDS - 1 );
    
    // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
    material = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
                'setilmap' : {value: texture},
                'setilView' :  {value: false },
                'buildingmap' : {value: null},
                'buildingView' :  {value: false },
            }
        ] ),
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        transparent: true
    } );
    waterMaterial = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
            }
        ] ),
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,

    } );
    //const material = new THREE.MeshPhongMaterial({map:texture});

    
    material.lights = true;
    waterMaterial.lights = true;
    //material.map = texture; 
    // Material attributes from THREE.MeshPhongMaterial
    // Sets the uniforms with the material values
    material.uniforms[ 'diffuse' ].value = new THREE.Color( 0x555555 );
    material.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    material.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    material.uniforms[ 'opacity' ].value = material.opacity;
    waterMaterial.uniforms[ 'diffuse' ].value = new THREE.Color( 0x0040C0 );
    waterMaterial.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    waterMaterial.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    waterMaterial.uniforms[ 'opacity' ].value = 1.0;

    // Defines
    material.defines.WIDTH = WIDTH.toFixed( 1 );
    material.defines.BOUNDS = BOUNDS.toFixed( 1 );
    waterMaterial.defines.WIDTH = WIDTH.toFixed( 1 );
    waterMaterial.defines.BOUNDS = BOUNDS.toFixed( 1 );
 

    waterMesh = new THREE.Mesh( geometry, waterMaterial );
    waterMesh.rotation.x = - Math.PI / 2;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();

    terrainMesh = new THREE.Mesh( geometry, material );
    terrainMesh.rotation.x = - Math.PI / 2;
    terrainMesh.matrixAutoUpdate = false;
    terrainMesh.updateMatrix();

    scene.add( waterMesh );
    scene.add( terrainMesh );

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
    const buildingmap = gpuCompute.createTexture();

    fillTexture( heightmap0, data);
    fillTextureBuilding( buildingmap, buildingData);
    
    heightmap0.flipY = true; //위성사진 y값을 거꿀로 바꿈
    buildingmap.flipY = true; //위성사진 y값을 거꿀로 바꿈
    heightmapVariable = gpuCompute.addVariable( 'heightmap', prefix+'\n'+advect, heightmap0 );

    gpuCompute.setVariableDependencies( heightmapVariable, [ heightmapVariable ] );

    material.uniforms[ 'buildingmap' ].value = buildingmap;

    let uniforms = {
        'mousePos': { value: new THREE.Vector2( 10000, 10000 ) },
        'mouseSize': { value: 20.0 },
        'viscosityConstant': { value: 0.98 },
        'heightCompensation': { value: 0 },
        'unit': { value: 1/BOUNDS },
        'dt': { value: 0.25 },
        'gravity': { value: 9.81 },
        'manningCoefficient': { value: 0.07 },
        'minFluxArea': { value: 0.01 },
        'sourceWaterHeight': { value: 49 },
        'sourceWaterVelocity': { value: 0.5 },
        'drainageAmount': { value: -1 },
        'buildingmap' : {value: buildingmap},
    }

    heightmapVariable.material.uniforms = uniforms;
    heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed( 1 );

    const error = gpuCompute.init();
    if ( error !== null ) {

        console.error( error );

    }

    let stepUniform = Object.assign({}, uniforms);
    stepUniform.heightmap = { value: null };
    stepUniform.buildingmap = { value: null };
    step_2_height = gpuCompute.createShaderMaterial('uniform sampler2D heightmap;\n' + prefix + height, stepUniform);
    step_3_velocity = gpuCompute.createShaderMaterial('uniform sampler2D heightmap;\n' +  prefix + velocity, stepUniform);
 

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

    const pixels = texture.image.data;

    let p = 0;
    let cnt = 0;
    for ( let j = 0; j < BOUNDS; j ++ ) {

        for ( let i = 0; i < BOUNDS; i ++ ) {

            pixels[ p + 0 ] = 0;//noise(x, y);
            pixels[ p + 1 ] = 0;//pixels[ p + 0 ];
            pixels[ p + 2 ] = 0;
            pixels[ p + 3 ] = data[cnt];

            p+=4;
            cnt++;

        }

    }

}

function fillTextureBuilding( texture, data ) {

    const pixels = texture.image.data;

    let p = 0;
    let cnt = 0;
    for ( let j = 0; j < BOUNDS; j ++ ) {

        for ( let i = 0; i < BOUNDS; i ++ ) {
            let height = data[cnt];
            if(isNaN( height )){
                height = 0;
            }else{
                height = height;
            }
            pixels[ p + 0 ] = height;
            pixels[ p + 1 ] = 0;
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
    gpuCompute.compute();

    const currentRenderTarget = gpuCompute.getCurrentRenderTarget( heightmapVariable );
    const alternateRenderTarget = gpuCompute.getAlternateRenderTarget( heightmapVariable );

    step_3_velocity.uniforms[ 'heightmap' ].value = currentRenderTarget.texture;
    gpuCompute.doRenderTarget( step_3_velocity, alternateRenderTarget );
    step_3_velocity.uniforms[ 'heightmap' ].value = alternateRenderTarget.texture;
    gpuCompute.doRenderTarget( step_3_velocity, currentRenderTarget );
    
    step_2_height.uniforms[ 'heightmap' ].value = currentRenderTarget.texture;
    gpuCompute.doRenderTarget( step_2_height, alternateRenderTarget );
    step_2_height.uniforms[ 'heightmap' ].value = alternateRenderTarget.texture;
    gpuCompute.doRenderTarget( step_2_height, currentRenderTarget );

   


    // if ( spheresEnabled ) {

    //     sphereDynamics();

    // }

    // Get compute output in custom uniform
    material.uniforms[ 'heightmap' ].value = gpuCompute.getCurrentRenderTarget( heightmapVariable ).texture;
     
    waterMaterial.uniforms[ 'heightmap' ].value = gpuCompute.getCurrentRenderTarget( heightmapVariable ).texture;

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Render
    renderer.render( scene, camera );
}