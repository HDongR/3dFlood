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

import { GPUComputationRenderer } from '../js/jsm/misc/GPUComputationRenderer.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from './water/water2.js';

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
const raycaster = new THREE.Raycaster();

let waterMesh;
let water;
let terrainMesh;
let meshRay;
let gpuCompute;

let setilView = false;
let buildingView = false;
let mouseMoved = false;

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
    const streamData = await parseTif('/asset/stream_1.tif');
    
    await init(tifData, buildingData, streamData);
    animate();
}

parseGeoTiff();



async function init(data, buildingData, streamData) {
    
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

    const geometry = new THREE.BoxGeometry( 512, 512, 512 ); 
     

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.listenToKeyEvents( window ); // optional
    //controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    //controls.dampingFactor = 0.05;

    controls.screenSpacePanning = false;

    controls.minDistance = 1;
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

    container.addEventListener( 'pointermove', onMouseMove);

    window.addEventListener( 'resize', onWindowResize );

    const gui = new GUI();

    const setilController = {
        'setilView': setilView
    };

    const buildingController = {
        'buildingView': buildingView
    };

    let waterView = true;
    const waterController = {
        'waterView' : waterView
    }
    gui.add(setilController, 'setilView' ).name('위성지도').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'setilView' ].value = check;
    } );
    gui.add(buildingController, 'buildingView' ).name('건물').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'buildingView' ].value = check;
    } );
    gui.add(waterController, 'waterView' ).name('물').onChange( (check)=>{
        console.log(check)

        waterMesh.visible = check;
    } );

    await initWater();
    await setCompute(data, buildingData, streamData);
}

function loadTexture(src){
    return new Promise((resolve, reject)=>{
        new THREE.TextureLoader().load(src, (texture)=>{
            resolve(texture);
        });
    });
}

async function initWater() {
    
    let setilmapTexture = await loadTexture('/asset/output_daejeon_proc2.png');
 

    const geometry = new THREE.PlaneGeometry( BOUNDS, BOUNDS, BOUNDS-1, BOUNDS-1);
    
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


    const flowMap = await loadTexture( '/js/water/Water_1_M_Flow.jpg' );

    water = new Water( geometry, {
        scale: 1,
        textureWidth: BOUNDS,
        textureHeight: BOUNDS,
        flowMap: flowMap,
    } );
    water.rotation.x = - Math.PI / 2;
    water.matrixAutoUpdate = false;
    water.updateMatrix();


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

    //scene.add( waterMesh );
    scene.add(water);
    scene.add( terrainMesh );

    // THREE.Mesh just for mouse raycasting
    // const geometryRay = new THREE.PlaneGeometry( BOUNDS, BOUNDS, 1, 1 );
    // meshRay = new THREE.Mesh( geometryRay, new THREE.MeshBasicMaterial( { color: 0xFFFFFF, visible: true } ) );
    // meshRay.rotation.x = - Math.PI / 2;
    // meshRay.matrixAutoUpdate = false;
    // meshRay.updateMatrix();
    // scene.add( meshRay );
}

let step = [];
let myFilter1, myFilter2, myFilter3;
let myRenderTarget1, myRenderTarget2;
let renderTargets;
let currentRenderIndex = 0;

let readWaterLevelRenderTarget;
let readWaterLevelImage;

async function setCompute(data, buildingData, streamData){
    
    // Creates the gpu computation class and sets it up

    gpuCompute = new GPUComputationRenderer( BOUNDS, BOUNDS, renderer );

    if ( renderer.capabilities.isWebGL2 === false ) {

        gpuCompute.setDataType( THREE.HalfFloatType );

    }

    const heightmap = gpuCompute.createTexture();
    const originmap = gpuCompute.createTexture(); 

    fillTexture( heightmap, originmap, data, buildingData, streamData); 
    
    heightmap.flipY = true; //위성사진 y값을 거꿀로 바꿈
    originmap.flipY = true; //위성사진 y값을 거꿀로 바꿈

    terrainMaterial.uniforms[ 'originmap' ].value = originmap;

    
    let uniforms = {
        'heightmap': { value: null },
        'mousePos': { value: new THREE.Vector2( 10000, 10000 ) },
        'mouseSize': { value: 20.0 },
        'viscosityConstant': { value: 0.98 },
        'heightCompensation': { value: 0 },
        'unit': { value: 1.0/BOUNDS.toFixed(1) },
        'dt': { value: 0.25 },
        'gravity': { value: 9.81 },
        'manningCoefficient': { value: 0.07 },
        'minFluxArea': { value: 0.01 },
        'sourceWaterHeight': { value: 49 },
        'sourceWaterVelocity': { value: 0.5 },
        'drainageAmount': { value: 0},
    }
    

    myFilter1 = gpuCompute.createShaderMaterial( advect, uniforms );
    myFilter2 = gpuCompute.createShaderMaterial( height, uniforms );
    myFilter3 = gpuCompute.createShaderMaterial( velocity, uniforms );
    
    step.push(myFilter1);
    step.push(myFilter2);
    step.push(myFilter3);
    
    myFilter1.uniforms.heightmap.value = null;
    myFilter2.uniforms.heightmap.value = null;
    myFilter3.uniforms.heightmap.value = null;
    
    myRenderTarget1 = gpuCompute.createRenderTarget();
    myRenderTarget2 = gpuCompute.createRenderTarget();

    renderTargets = [myRenderTarget1, myRenderTarget2];
    
    gpuCompute.renderTexture( heightmap, myRenderTarget1);
    gpuCompute.renderTexture( heightmap, myRenderTarget2);

    
    terrainMaterial.uniforms[ 'originmap' ].value = originmap;


    const error = gpuCompute.init();
    if ( error !== null ) { 
        console.error( error );
    }


    readWaterLevelImage = new Float32Array( 4 * 1 * 4 );

    readWaterLevelRenderTarget = new THREE.WebGLRenderTarget( 4, 1, {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false
    } );
}

function fillTexture( texture, originmap, data, buildingData, streamData) {

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

            let streamHeight = streamData[cnt];
            
            if(streamHeight != 0){
                streamHeight = 1;
            }else{
                streamHeight = -0.0001;
            }

            pixels[ p + 0 ] = 100000;//noise(x, y);
            pixels[ p + 1 ] = 100000;//pixels[ p + 0 ];
            pixels[ p + 2 ] = streamHeight;
            pixels[ p + 3 ] = data[cnt] + buildingHeight;
            //pixels[ p + 2 ] = 1;
            //pixels[ p + 3 ] = 1;

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

function getReadPixcel(log, rt, debug){
    // if(debug){
    //     renderer.readRenderTargetPixels( rt, 268, 257, 4, 1, readWaterLevelImage );
    //     const pixels = new Float32Array( readWaterLevelImage.buffer );
    //     console.log(log, pixels);
    // }
}

 
const mouse = new THREE.Vector2();
const onClickPosition = new THREE.Vector2();

function onMouseMove( evt ) {
    return;
    evt.preventDefault();

    const array = getMousePosition( container, evt.clientX, evt.clientY );
    onClickPosition.fromArray( array );

    const intersects = getIntersects( onClickPosition, scene.children );

    if ( intersects.length > 0 && intersects[ 0 ].uv ) {

        const uv = intersects[ 0 ].uv;
        console.log(uv.x, uv.y);
        //intersects[ 0 ].object.material.map.transformUv( uv );
        //console.log(uv.x, uv.y);
        //canvas.setCrossPosition( uv.x, uv.y );

    }

}

function getMousePosition( dom, x, y ) {

    const rect = dom.getBoundingClientRect();
    return [ ( x - rect.left ) / rect.width, ( y - rect.top ) / rect.height ];

}

function getIntersects( point, objects ) {

    mouse.set( ( point.x * 2 ) - 1, - ( point.y * 2 ) + 1 );

    raycaster.setFromCamera( mouse, camera );

    return raycaster.intersectObjects( objects, false );

}

function compute(){
    for(let i=0; i<10; ++i){
        let nextRenderIndex = currentRenderIndex == 0 ? 1 : 0;

        let rt1 = renderTargets[currentRenderIndex];
        let rt2 = renderTargets[nextRenderIndex];

        myFilter1.uniforms.heightmap.value = rt2.texture;
        //getReadPixcel('init', rt2, true);
        gpuCompute.doRenderTarget( myFilter1, rt1 );

        myFilter2.uniforms.heightmap.value = rt1.texture;
        //getReadPixcel('advect', rt1, false);
        gpuCompute.doRenderTarget( myFilter2, rt2 );

        myFilter3.uniforms.heightmap.value = rt2.texture;
        //getReadPixcel('height', rt2, false);
        gpuCompute.doRenderTarget( myFilter3, rt1 );
        //getReadPixcel('velocity', rt1, false);
        
        currentRenderIndex = currentRenderIndex == 0 ? 1 : 0;
    }
}

function render() {
    
    compute();

    terrainMaterial.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex].texture;
    waterMaterial.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex].texture;
    water.material.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex].texture;
    
    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Render
    //renderer.setRenderTarget( null );
    renderer.render( scene, camera );

    // if ( mouseMoved ) {

    //     raycaster.setFromCamera( mouseCoords, camera );
    //     const intersects = raycaster.intersectObject( terrainMesh );
    //     if ( intersects.length > 0 ) {
    //         let pixelX = Math.round(intersects[0].uv.x * 512);
    //         let pixelY = Math.round(intersects[0].uv.y * 512);

    //         //const point = intersects[ 0 ].point;
    //         console.log(pixelX, pixelY);
    //         rx = pixelX;
    //         ry = pixelY;
    //         //getReadPixcel()
    //         //uniforms[ 'mousePos' ].value.set( point.x, point.z );
    //     } else {
    //         //uniforms[ 'mousePos' ].value.set( 10000, 10000 );
    //     } 
    // }


    let nextRenderIndex = currentRenderIndex == 0 ? 1 : 0;

    let rt1 = renderTargets[currentRenderIndex];
    let rt2 = renderTargets[nextRenderIndex];

    myFilter1.uniforms.heightmap.value = rt2.texture;
    getReadPixcel('init', rt2, true);
    gpuCompute.doRenderTarget( myFilter1, rt1 );

    myFilter2.uniforms.heightmap.value = rt1.texture;
    //getReadPixcel('advect', rt1, false);
    gpuCompute.doRenderTarget( myFilter2, rt2 );

    myFilter3.uniforms.heightmap.value = rt2.texture;
    //getReadPixcel('height', rt2, false);
    gpuCompute.doRenderTarget( myFilter3, rt1 );
    //getReadPixcel('velocity', rt1, false);

    terrainMaterial.uniforms[ 'heightmap' ].value = rt2.texture
    waterMaterial.uniforms[ 'heightmap' ].value = rt2.texture

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Render
    //renderer.setRenderTarget( null );
    renderer.render( scene, camera );

    currentRenderIndex = currentRenderIndex == 0 ? 1 : 0;
    
}