import waterVertexShader from '../shader/waterVertexShader.js';
import waterFragmentShader from '../shader/waterFragmentShader.js';
import terrainVertexShader from '../shader/terrainVertexShader.js';
import terrainFragmentShader from '../shader/terrainFragmentShader.js';
import prefix from '../shader/prefix.js';
import prefix2 from '../shader/prefix2.js';
import velocity from '../shader/step/velocity.js';
import height from '../shader/step/height.js';
import advect from '../shader/step/advect.js';

import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Texture width for simulation
const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
const BOUNDS_HALF = BOUNDS * 0.5;

let container, stats;
let camera, scene, renderer, controls;
let terrainMaterial;
let waterMaterial;
const mouseCoords = new THREE.Vector2();

let waterMesh;
let terrainMesh;
let meshRay;
let gpuCompute;
let heightmapVariable;

let setilView = false;
let buildingView = false;

let heightShader;
let velocityShader;
let heightRenderTarget;
let velocityRenderTarget;

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
    
    await init(tifData, buildingData);
    animate();
}

parseGeoTiff();



async function init(data, buildingData) {
    
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

    document.addEventListener( 'keydown', function ( event ) {

        // W Pressed: Toggle wireframe
        if ( event.keyCode === 87 ) {

            terrainMesh.material.wireframe = ! terrainMesh.material.wireframe;
            terrainMesh.material.needsUpdate = true;

        }

    } );

    window.addEventListener( 'resize', onWindowResize );

    const gui = new GUI();

    const setilController = {
        'setilView': setilView
    };

    const buildingController = {
        'buildingView': buildingView
    };

    gui.add(setilController, 'setilView' ).name('위성지도').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'setilView' ].value = check;
    } );
    gui.add(buildingController, 'buildingView' ).name('건물').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'buildingView' ].value = check;
    } );

    await initWater(data, buildingData);

}

function loadTexture(src){
    return new Promise((resolve, reject)=>{
        new THREE.TextureLoader().load(src, (texture)=>{
            resolve(texture);
        });
    });
}

async function initWater(data, buildingData) {
    
    let setilmapTexture = await loadTexture('/asset/output_daejeon_proc2.png');
 

    const geometry = new THREE.PlaneGeometry( BOUNDS, BOUNDS, BOUNDS - 1, BOUNDS - 1 );
    
    // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
    terrainMaterial = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
                'setilmap' : {value: setilmapTexture},
                'setilView' :  {value: false },
                'buildingView' :  {value: false },
                'originmap' :  {value: null },
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

    
    terrainMaterial.lights = true;
    waterMaterial.lights = true;
    // Material attributes from THREE.MeshPhongMaterial
    // Sets the uniforms with the material values
    terrainMaterial.uniforms[ 'diffuse' ].value = new THREE.Color( 0x555555 );
    terrainMaterial.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    terrainMaterial.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    terrainMaterial.uniforms[ 'opacity' ].value = 1.0;
    terrainMaterial.uniforms[ 'originmap' ].value = null;
    waterMaterial.uniforms[ 'diffuse' ].value = new THREE.Color( 0x0040C0 );
    waterMaterial.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    waterMaterial.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    waterMaterial.uniforms[ 'opacity' ].value = 1.0;

    // Defines
    terrainMaterial.defines.WIDTH = WIDTH.toFixed( 1 );
    terrainMaterial.defines.BOUNDS = BOUNDS.toFixed( 1 );
    waterMaterial.defines.WIDTH = WIDTH.toFixed( 1 );
    waterMaterial.defines.BOUNDS = BOUNDS.toFixed( 1 );
 

    waterMesh = new THREE.Mesh( geometry, waterMaterial );
    waterMesh.rotation.x = - Math.PI / 2;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();

    terrainMesh = new THREE.Mesh( geometry, terrainMaterial );
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
    const originmap = gpuCompute.createTexture(); 

    fillTexture( heightmap0, originmap, data, buildingData); 
    
    heightmap0.flipY = true; //위성사진 y값을 거꿀로 바꿈
    originmap.flipY = true; //위성사진 y값을 거꿀로 바꿈
    let heightMapSamplerVal = '\nuniform sampler2D heightmap;\n';
    heightmapVariable = gpuCompute.addVariable( 'heightmap', prefix+prefix2+advect, heightmap0 );

    gpuCompute.setVariableDependencies( heightmapVariable, [ heightmapVariable ] );

    terrainMaterial.uniforms[ 'originmap' ].value = originmap;

    // Create compute shader to read water level
    heightShader = gpuCompute.createShaderMaterial(prefix+heightMapSamplerVal+prefix2+height, {
        heightmap: { value: null }
    } );
    heightShader.defines.BOUNDS = BOUNDS.toFixed( 1 );
    heightRenderTarget = gpuCompute.createRenderTarget();
    heightShader.uniforms.heightmap.value = heightRenderTarget.texture;

    // Create compute shader to read water level
    velocityShader = gpuCompute.createShaderMaterial(prefix+heightMapSamplerVal+prefix2+velocity, {
        heightmap: { value: null }
    } );
    

    velocityShader.defines.BOUNDS = BOUNDS.toFixed( 1 );
    
    velocityRenderTarget = gpuCompute.createRenderTarget();

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
        'drainageAmount': { value: -1},
    }

    heightmapVariable.material.uniforms = uniforms;
    heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed( 1 );

    const error = gpuCompute.init();
    if ( error !== null ) { 
        console.error( error );
    }
}

function fillTexture( texture, originmap, data, buildingData ) {

    const pixels = texture.image.data;
    const originpixcels = originmap.image.data;

    let p = 0;
    let cnt = 0;
    for ( let j = 0; j < BOUNDS; j ++ ) {

        for ( let i = 0; i < BOUNDS; i ++ ) {
            let buildingHeight = buildingData[cnt];
            if(isNaN( buildingHeight )){
                buildingHeight = 0;
            }
            pixels[ p + 0 ] = 0;//noise(x, y);
            pixels[ p + 1 ] = 0;//pixels[ p + 0 ];
            pixels[ p + 2 ] = 0;
            pixels[ p + 3 ] = data[cnt] + buildingHeight;

            originpixcels[ p + 0 ] = 0;//noise(x, y);
            originpixcels[ p + 1 ] = 0;//pixels[ p + 0 ];
            originpixcels[ p + 2 ] = 0;
            originpixcels[ p + 3 ] = data[cnt];

            p+=4;
            cnt++;

        }

    }

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}


function animate() {

    requestAnimationFrame( animate );

    render();
    stats.update();

}

let currentTextureIndex = 0;

function render() {
    // Do the gpu computation
    gpuCompute.compute();

    const currentRenderTarget = gpuCompute.getCurrentRenderTarget( heightmapVariable );
    const alternateRenderTarget = gpuCompute.getAlternateRenderTarget( heightmapVariable );
    
    heightShader.uniforms['heightmap'].value = alternateRenderTarget.texture;
    gpuCompute.doRenderTarget( heightShader, currentRenderTarget );

    //velocityShader.uniforms['heightmap'].value = alternateRenderTarget.texture;
    //gpuCompute.doRenderTarget( velocityShader, currentRenderTarget );

    // Get compute output in custom uniform
    terrainMaterial.uniforms[ 'heightmap' ].value = alternateRenderTarget.texture;
    waterMaterial.uniforms[ 'heightmap' ].value = alternateRenderTarget.texture;

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Render
    renderer.render( scene, camera );
}