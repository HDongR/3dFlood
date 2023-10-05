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
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import { Water } from './water/water.js';
import { Sky } from './water/Sky.js';

import { parseInp } from './utils/inp.js';
import { apply_linkage_flow } from './swmm.js';
import { WGS84ToMercator, MercatorToWGS84 } from './utils/utils.js';

// Texture width for simulation
const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
const BOUNDS_HALF = BOUNDS * 0.5;

const FOOT = 0.3048;
const FOOT2 = FOOT ** 2;
const FOOT3 = FOOT ** 3;

let container, stats;
let camera, scene, renderer, controls, transformControl;
let terrainMaterial;
let waterMaterial;
let sky;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let waterMesh;
let water;
let terrainMesh;
let meshRay;
let gpuCompute;

let setilView = true;
let buildingView = true;
let waterView = true;
let weatherView = false;
let mouseMoved = false;

let centerXY = new THREE.Vector2();

async function parseTif(src){
    const rawTiff = await GeoTIFF.fromUrl(src);
    const image = await rawTiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    let out = MercatorToWGS84([14000000,4000000]);
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

function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      var chr = array[i];
      if (chr > 0xFF) {
        if (ASSERTIONS) {
          assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
        }
        chr &= 0xFF;
      }
      ret.push(String.fromCharCode(chr));
    }
    return ret.join('');
}




let swmm = {junctions:[]};
async function testSwmm(){
    //FS.createPath('/', '/', true, true);
    //FS.ignorePermissions = true;
    //var f = FS.findObject('input.inp');
    //if (f) {
    //    FS.unlink('input.inp');
    //}

    let inpRes = await fetch('/asset/swmm/tmp_970.inp');
    let inpText = await inpRes.text();
    FS.createDataFile('/tmp/', 'input.inp', inpText, true, true);

    await processModel();

    async function processModel(){
        swmm_open("/tmp/input.inp", "/tmp/Example1x.rpt", "/tmp/out.out");
        swmm_start(1);
        swmm_setAllowPonding(1);

        let inp = parseInp(inpText);
        let keys = Object.keys(inp.JUNCTIONS);
        for(let i=0; i<keys.length; ++i){
            let key = keys[i];
            let junction = inp.JUNCTIONS[key];
            junction['Name'] = key;
            swmm.junctions.push(junction);
        }
        let startTime = performance.now(); // 측정 시작
        console.log('측정 시작.');

        for(let i=0; i<keys.length; ++i){
            let Name = keys[i];
    
            const node = Module.ccall('swmm_getNodeData','number',['number'], [i]);

            let inflow = Module.getValue(node, 'double');
            let outflow = Module.getValue(node + 8, 'double');
            let head = Module.getValue(node + 16, 'double');
            let crestElev = Module.getValue(node + 24, 'double');
            let type = Module.getValue(node + 32, 'i32');
            let subIndex = Module.getValue(node + 36, 'i32');
            let InverElev = Module.getValue(node + 40, 'double');
            let InitDepth = Module.getValue(node + 48, 'double');
            let fullDepth = Module.getValue(node + 56, 'double');
            let surDepth = Module.getValue(node + 64, 'double');
            let pondedArea = Module.getValue(node + 72, 'double');
            let degree = Module.getValue(node + 80, 'i32');
            let updated = String.fromCharCode(Module.getValue(node + 84, 'i8'));
            let crownElev = Module.getValue(node + 88, 'double');
            let losses = Module.getValue(node + 96, 'double');
            let newVolume = Module.getValue(node + 104, 'double');
            let fullVolume = Module.getValue(node + 112, 'double');
            let overflow = Module.getValue(node + 120, 'double');
            let newDepth = Module.getValue(node + 128, 'double');
            let newLatFlow = Module.getValue(node + 136, 'double');
            _free(node);

            //console.log('Name:'+Name+" invEl:"+InverElev + " fullDepth:"+fullDepth);
        }
        
        let endTime = performance.now(); // 측정 종료
        console.log(`걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);

        //let rpt = intArrayToString(FS.findObject('/tmp/Example1x.rpt').contents);
        //console.log(rpt);
    }
 
 
}
testSwmm();

var cloudParticles, flash, rain, rainGeo, rainCount = 3000, cloudCount = 20;
const dummy = new THREE.Object3D();
let thunder = 500000;
let gravity = 9.81;

async function makeRain(){
    flash = new THREE.PointLight(0x062d89, 30, 100 ,1.7);
    flash.position.set(0, 200, 0);
    scene.add(flash);

    let rainTexture = await loadTexture('/asset/rain.png'); 
    let smokeTexture = await loadTexture('/asset/smoke.png'); 

    rainGeo = new THREE.BufferGeometry();
    let rains = [];
    for(let i=0;i<rainCount;i++) {
        rains.push(
            Math.random()*BOUNDS - BOUNDS_HALF,
            Math.random()*200,
            Math.random()*BOUNDS - BOUNDS_HALF);
    }
    const vertices = new Float32Array(rains);
    rainGeo.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
 
    var rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 1.0,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity:1,
        map: rainTexture
    });
    rain = new THREE.Points(rainGeo,rainMaterial);
    scene.add(rain);

    var cloudGeo = new THREE.PlaneGeometry(BOUNDS, BOUNDS);
    var cloudMaterial = new THREE.MeshLambertMaterial({
        map: smokeTexture,
        transparent:true,
        depthTest:false,
        side:THREE.DoubleSide,
        opacity: 0.6,
    });

    cloudParticles = new THREE.InstancedMesh( cloudGeo, cloudMaterial, cloudCount );
    cloudParticles.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); // will be updated every frame
    scene.add( cloudParticles );

    for(let i=0; i<cloudCount; ++i){
        dummy.position.set( Math.random()*BOUNDS - BOUNDS_HALF, 200, Math.random()*BOUNDS - BOUNDS_HALF );
        dummy.rotation.x = - Math.PI / 2 ;
        dummy.rotation.y = -0.12;
        dummy.rotation.z = Math.random()*360;
        dummy.updateMatrix();
        cloudParticles.setMatrixAt( i, dummy.matrix );
    }
    cloudParticles.instanceMatrix.needsUpdate = true;
}

function rainRender(){
    for(let i=0; i<cloudCount; ++i){
        cloudParticles.getMatrixAt( i, dummy.matrix);
        dummy.position.set(dummy.matrix.elements[12], 200, dummy.matrix.elements[14] );
        //dummy.rotation.x = - Math.PI / 2 ;
        //dummy.rotation.y = -0.12;
        dummy.rotation.z -= 0.0002;
        dummy.updateMatrix();
        cloudParticles.setMatrixAt( i, dummy.matrix );
    }
    cloudParticles.instanceMatrix.needsUpdate = true;

    const positionAttribute = rain.geometry.getAttribute( 'position' );
    for ( let i = 0; i < positionAttribute.count; i ++ ) {
        let y = positionAttribute.getY(i);
        y -= 1 + Math.random() * 5;
        if (y < 0) {
            y = 200;
        }
        positionAttribute.setY(i, y);
    }
    positionAttribute.needsUpdate = true;
    
    rain.rotation.y +=0.0002;
    if(Math.random() > 0.93 || flash.power > thunder/10) {
        if(flash.power < thunder/20){
            flash.position.set(
                Math.random()*BOUNDS_HALF/2, 
               200 + Math.random(30),
               Math.random()*BOUNDS_HALF/2
            );
        }
        flash.power = 50 + Math.random() * thunder;
        //console.log('thunder');
    }
 
}

let cube;
let pxv, pyv, pzv;
async function init(data, buildingData, streamData) {
    pxv = document.getElementById('px');
    pyv = document.getElementById('py');
    pzv = document.getElementById('pz');
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.set( 0, 200, 350 );
    camera.lookAt( 0, 0, 0 );

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2( 0xcccccc, 0.0025 );

    const dirSun = new THREE.DirectionalLight( 0xFFFFFF, 3.0 );
    dirSun.position.set( 300, 400, 175 );
    scene.add( dirSun );

    const sun2 = new THREE.DirectionalLight( 0x40A040, 2.0 );
    sun2.position.set( - 100, 350, - 200 );
    scene.add( sun2 );

    const geometry = new THREE.BoxGeometry(4,4,4);
    cube = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( 0xff0000 ) );
 
    
    //0,0, 300
    cube.position.x = 0;
    cube.position.y = 0;
    cube.position.z = 0;
    scene.add( cube );

    const axesHelper = new THREE.AxesHelper( 5 );
    scene.add( axesHelper );

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
    renderer.setClearColor(0xffffff); 

    await makeRain();

    controls = new OrbitControls( camera, renderer.domElement );
    controls.listenToKeyEvents( window ); // optional
    //controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    //controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI;
    controls.update();
    //controls.addEventListener( 'change', render );

    transformControl = new TransformControls( camera, renderer.domElement );
    //transformControl.addEventListener( 'change', render );
    transformControl.addEventListener( 'dragging-changed', function ( event ) {

        controls.enabled = ! event.value;

    } );
    

    
    scene.add(transformControl);

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

    const waterController = {
        'waterView' : waterView
    }

    const weatherController = {
        'weatherView' : weatherView
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

        water.visible = check;
    } );
    gui.add(weatherController, 'weatherView' ).name('날씨효과').onChange( (check)=>{
        console.log(check)

        weatherOn(check);
    } );

    await initWater();
    await setCompute(data, buildingData, streamData);
}

function weatherOn(check){
    sky.visible = check;
    cloudParticles.visible = check;
    flash.visible = check;
    rain.visible = check;
    
    water.material.uniforms.waterColor.value = check ? new THREE.Color(0x001e0f) : new THREE.Color(0xaff);
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
                'setilView' :  {value: setilView },
                'buildingView' :  {value: buildingView },
                'originmap' :  {value: null },
            }
        ] ),
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        transparent: true
    } );

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;

    const sun = new THREE.Vector3();

    let waterNormals = await loadTexture( '/js/water/waternormals.jpg' );
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

    water = new Water(
        geometry,
        {
            textureWidth: BOUNDS,
            textureHeight: BOUNDS,
            waterNormals: waterNormals,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            //waterColor: 0x643200,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );

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

    transformControl.attach(cube);

    //scene.add( waterMesh );
    scene.add(water);
    scene.add(terrainMesh);

    // THREE.Mesh just for mouse raycasting
    // const geometryRay = new THREE.PlaneGeometry( BOUNDS, BOUNDS, 1, 1 );
    // meshRay = new THREE.Mesh( geometryRay, new THREE.MeshBasicMaterial( { color: 0xFFFFFF, visible: true } ) );
    // meshRay.rotation.x = - Math.PI / 2;
    // meshRay.matrixAutoUpdate = false;
    // meshRay.updateMatrix();
    // scene.add( meshRay );

    sky = new Sky();
    sky.scale.setScalar( 10000 );
    scene.add( sky );

    const skyUniforms = sky.material.uniforms;

    skyUniforms[ 'turbidity' ].value = 10;
    skyUniforms[ 'rayleigh' ].value = 2;
    skyUniforms[ 'mieCoefficient' ].value = 0.005;
    skyUniforms[ 'mieDirectionalG' ].value = 0.8;

    const parameters = {
        elevation: 0,
        azimuth: 180
    };

    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    const sceneEnv = new THREE.Scene();

    let renderTarget;
    function updateSun() {

        const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
        const theta = THREE.MathUtils.degToRad( parameters.azimuth );

        sun.setFromSphericalCoords( 1, phi, theta );

        sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
        water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

        if ( renderTarget !== undefined ) renderTarget.dispose();

        sceneEnv.add( sky );
        renderTarget = pmremGenerator.fromScene( sceneEnv );
        scene.add( sky );

        scene.environment = renderTarget.texture;

    }

    updateSun();

    weatherOn(weatherView);
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
    
    //heightmap.flipY = true; //위성사진 y값을 거꿀로 바꿈
    //originmap.flipY = true; //위성사진 y값을 거꿀로 바꿈

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
    
    myRenderTarget1 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.NearestFilter);
    myRenderTarget2 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.NearestFilter);

    renderTargets = [myRenderTarget1, myRenderTarget2];
    
    gpuCompute.renderTexture( heightmap, myRenderTarget1);
    gpuCompute.renderTexture( heightmap, myRenderTarget2);

    
    terrainMaterial.uniforms[ 'originmap' ].value = originmap;


    const error = gpuCompute.init();
    if ( error !== null ) { 
        console.error( error );
    }


    readWaterLevelImage = new Float32Array( BOUNDS * BOUNDS * 4 );

    readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(BOUNDS, BOUNDS, {
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
            
            let pos = xyPos(j, i);
            let dbg = false;
            if(
                (i==255 && j == 255)
                // ||
                //(i==256 && j == 256)
                ){
                dbg = true;
                console.log(pos);
                debugger
            }
            // if(i >= 0 && i < BOUNDS/2){
            //     dbg = true;
            // }
            pixels[ p + 0 ] = 100000;//noise(x, y);
            pixels[ p + 1 ] = 100000;//pixels[ p + 0 ];
            pixels[ p + 2 ] = streamHeight;
            pixels[ p + 3 ] = dbg? 10000:data[cnt] + buildingHeight;
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


async function animate() {

    await render();
    stats.update();

    requestAnimationFrame( animate );

    

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

function xyPos(x, y){
    let r = (4*x) + (4*y*BOUNDS);
    return r;
}

let elapsed_time = 0.0;
let input_ptr = _malloc(8);
Module.setValue(input_ptr, elapsed_time, "double");
let dt1d = 0;
function drainageStep(){
    let solve_dt = ()=>{
        let olds = swmm_getNewRoutingTime() / 1000.;
        let news = swmm_getOldRoutingTime() / 1000.;
        dt1d = news - olds;
        if(dt1d <= 0){
            let route_code = swmm_getRoutingModel();
            let route_step = swmm_getRoutingStep();
            dt1d = routing_getRoutingStep(route_code, route_step);
        }
        //console.log('dt1d:'+dt1d);
    }
    
    let step = ()=>{
        //let startTime = performance.now(); // 측정 시작
        let stepRst = swmm_step(input_ptr);
        elapsed_time = Module.getValue(input_ptr, 'double');;
        //_free(input_ptr);

        //let endTime = performance.now(); // 측정 종료
        //console.log(`step:${elapsed_time} 걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);
    }

    let apply_linkage = ()=>{

 
        renderer.readRenderTargetPixels( renderTargets[currentRenderIndex] , 0, 0, BOUNDS, BOUNDS, readWaterLevelImage );
        const pixels = new Float32Array( readWaterLevelImage.buffer );

        for(let i=0; i<pixels.length; ++i){
            if(pixels[i] >= 9999.){
                //debugger;
            }
        }

        let x = BOUNDS/2;
        let y = BOUNDS/2;
        let r = xyPos(x, y);
        console.log(pixels[r], pixels[r+1], pixels[r+2], pixels[r+3]); 
        if(pixels[r+2] == 0.5){
            //debugger
        }


        //let startTime = performance.now(); // 측정 시작
        
        for(let i=0; i<swmm.junctions.length; ++i){
            let junction = swmm.junctions[i];

            //swmm_setNodeFullDepth(i, 2.0/FOOT);
            //let head = swmm_getNodeHead(i);
            //let crestElev = swmm_getNodeCrestElev(i);
            //let depth = swmm_getNodeDepth(i);

            //int index, double h, double z, double cell_surf
            let flow = apply_linkage_flow(i, 0.1, junction.Invert + 2, junction.Invert, 5, dt1d);
            let Name = junction.Name;
            //const node = Module.ccall('swmm_getNodeData','number',['number'], [i]);
    
            //let inflow = Module.getValue(node, 'double');
            // let outflow = Module.getValue(node + 8, 'double');
            //let head1 = Module.getValue(node + 16, 'double');
            //let crestElev2 = Module.getValue(node + 24, 'double');
            // let type = Module.getValue(node + 32, 'i32');
            // let subIndex = Module.getValue(node + 36, 'i32');
            //let InverElev = Module.getValue(node + 40, 'double');
            // let InitDepth = Module.getValue(node + 48, 'double');
            // let fullDepth = Module.getValue(node + 56, 'double');
            // let surDepth = Module.getValue(node + 64, 'double');
            // let pondedArea = Module.getValue(node + 72, 'double');
            // let degree = Module.getValue(node + 80, 'i32');
            // let updated = String.fromCharCode(Module.getValue(node + 84, 'i8'));
            // let crownElev = Module.getValue(node + 88, 'double');
            // let losses = Module.getValue(node + 96, 'double');
            // let newVolume = Module.getValue(node + 104, 'double');
            // let fullVolume = Module.getValue(node + 112, 'double');
            // let overflow = Module.getValue(node + 120, 'double');
            // let newDepth = Module.getValue(node + 128, 'double');
            // let newLatFlow = Module.getValue(node + 136, 'double');
            //_free(node);

            //let rst1 = await swmm_open("/tmp/input.inp", "/tmp/Example1x.rpt", "/tmp/out.out");
            
            //console.log(res);
            //console.log('Name:'+Name+" invEl:"+InverElev);
        }

        
        //let endTime = performance.now(); // 측정 종료
        //console.log(`apply_linkage 걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);
        
    }

    solve_dt();
    step();
    apply_linkage();


}

async function compute(){
    for(let i=0; i<1; ++i){
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

        if(true){
            drainageStep();
        }
        
        currentRenderIndex = currentRenderIndex == 0 ? 1 : 0;
    }
}


async function render() {
    
    await compute();

    terrainMaterial.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex].texture; 
    water.material.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex].texture;
    water.material.uniforms[ 'time' ].value += 1.0 / 60.0;

    rainRender();
    // Render
    //renderer.setRenderTarget( null );
    renderer.render( scene, camera );
    
    pxv.innerText = cube.position.x;
    pyv.innerText = cube.position.y;
    pzv.innerText = cube.position.z;
}