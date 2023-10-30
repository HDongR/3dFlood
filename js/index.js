import waterVertexShader from '../shader/waterVertexShader.js';
import waterFragmentShader from '../shader/waterFragmentShader.js';
import terrainVertexShader from '../shader/terrainVertexShader.js';
import terrainFragmentShader from '../shader/terrainFragmentShader.js';
import prefix from '../shader/prefix.js';
import prefix2 from '../shader/prefix2.js';
import velocity from '../shader/step/velocity.js';
import height from '../shader/step/height.js';
import advect from '../shader/step/advect.js';
import hydrology from '../shader/step/hydrology.js';
import solve_q from '../shader/step/solve_q.js';
import update_h from '../shader/step/update_h.js';

import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { GPUComputationRenderer } from '../js/jsm/misc/GPUComputationRenderer.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import { Water } from './water/water.js';
import { Water2 } from './water/water2.js';
import { Sky } from './water/Sky.js';

import { parseInp } from './utils/inp.js';
import { apply_linkage_flow } from './swmm.js';
import { transformEpsg } from './utils/utils.js';
import { TDSLoader } from '../js/jsm/loaders/TDSLoader.js';


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
let water2;
let terrainMesh;
let meshRay;
let gpuCompute;

let onlyDrainView = false;
let setilView = true;
let buildingView = true;
let drainView = true;
let waterView = true;
let weatherView = false;
let mouseMoved = false;

let global_bbox = [];
let centerXY = [0,0];
let realWidth = 0;
let realHeight = 0;
let beX = 0;
let beY = 0;

let initStreamHeight = 6; //초기 강의 수위 m
let cfl = 0.7;
let infiltrationRate = 1.0; //침투능 효율
let simTime = 0; //현재 시뮬레이션 걸린시간
let dtmax = 0.25;
let dt = 0.25; //step dt
let simTimeView = document.getElementById('simTimeView');
let rain_per_sec = 3600;
let rain_val = 40; //시간당 강수량 50mm/h; 
let MinSurfArea = 12.566;

const clock = new THREE.Clock();
const cycle = 0.3; // a cycle of a flow map phase
const halfCycle = cycle * 0.5;

 

async function loadBuildings(){
    
    // Access and handle the files 
    $('#loadBuilding').click(()=>{
        var inp = document.getElementById("get-files");
        for (let i = 0; i < inp.files.length; i++) {
            let file = inp.files[i];
            //console.log(file);
            // do things with file

            loadBuilding('asset/31/01.normal/', file.name);
        }
    });
    
    
    proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');

    
    const loader = new TDSLoader( );

    let buildingBoundCheck = async (child)=>{
        let index = 0;
        for(let j=0; j<child.geometry.attributes.position.count; ++j){ 
            let _x = child.geometry.attributes.position.array[index];
            let _y = child.geometry.attributes.position.array[index+1];
            let _z = child.geometry.attributes.position.array[index+2];
            let oxy = transformEpsg('5186', '3857', [_x,_y]);


            if(global_bbox[0] < oxy.x && global_bbox[1] < oxy.y 
                && global_bbox[2] > oxy.x && global_bbox[3] > oxy.y){
            }else{
                return false;
            }

        } 

        
        return true;
    }
    
    let loadBuilding = async (resourcePath, name)=>{
    
        loader.setResourcePath( resourcePath );
        loader.load( resourcePath + name, function ( object ) {

            object.traverse( function ( child ) {
                if ( child.isMesh ) {
                    //console.log(child);
                    //child.material.specular.setScalar( 0.1 );
                    //child.material.normalMap = normal;
                    
                    if(buildingBoundCheck(child)){
                        let index = 0;
                        for(let j=0; j<child.geometry.attributes.position.count; ++j){ 
                            let _x = child.geometry.attributes.position.array[index];
                            let _y = child.geometry.attributes.position.array[index+1];
                            let _z = child.geometry.attributes.position.array[index+2];
                            let oxy = transformEpsg('5186', '3857', [_x,_y]);
                             
                            
                            
                            let subX = centerXY[0] - oxy.x;
                            let subY = centerXY[1] - oxy.y;

                            let bX = subX / beX;
                            let bY = subY / beY;
                            
                            let index_x = bX > 0 ? bX - BOUNDS_HALF : BOUNDS_HALF - bX;
                            let index_y = bY > 0 ? bY - BOUNDS_HALF : BOUNDS_HALF - bY;
                            index_x = Math.abs(index_x);
                            index_y = Math.abs(index_y);
                            //if(Math.round(index_x) >= BOUNDS || Math.round(index_y) >= BOUNDS){
                            //    junction['containStudy'] = false;
                            //}
                            //console.log(jkey, index_x, index_y);

                            let world_x = index_x - BOUNDS_HALF;
                            let world_z = BOUNDS_HALF - index_y;

                            child.geometry.attributes.position.array[index] = world_x;
                            child.geometry.attributes.position.array[index+1] = child.geometry.attributes.position.array[index+2];
                            child.geometry.attributes.position.array[index+2] = world_z;
                           
                            index+=3;

                            
                            
                            
                        } 
                        

                    
                        child.geometry.attributes.position.needsUpdate = true;
                        child.material.side = THREE.BackSide;
                        
                        scene.add( child ); 
                    }
                }

            } );

            //scene.add( object );

        } );
    }
}

async function parseTif(src, callback){
    const rawTiff = await GeoTIFF.fromUrl(src);
    const image = await rawTiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    //let out = MercatorToWGS84([14000000,4000000]);
    // when we are actually dealing with geo-data the following methods return
    // meaningful results:
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const bbox = image.getBoundingBox();
    if(callback){
        callback(bbox);
    }
    const data = await image.readRasters({ interleave: true });
    return data;
}

async function parseGeoTiff(){

    const tifData = await parseTif('/asset/daejeon_1.tif', (bbox)=>{
        global_bbox = bbox;
        centerXY[0] = (bbox[0]+bbox[2])/2.0;
        centerXY[1] = (bbox[1]+bbox[3])/2.0;
        realWidth = bbox[2] - bbox[0];
        realHeight = bbox[3] - bbox[1];
        beX = realWidth / BOUNDS;
        beY = realHeight / BOUNDS;
    });
    const buildingData = await parseTif('/asset/building.tif');
    const streamData = await parseTif('/asset/stream_1.tif');
    const surf_rough_Data = await parseTif('/asset/tmp_1_surface_roughness_result_1.tiff');
    const surf_infilmax_Data = await parseTif('/asset/tmp_1_surface_infilmax_result_1.tiff');
    const surf_infilmin_Data = await parseTif('/asset/tmp_1_surface_infilmin_result_1.tiff');
    
    await init(tifData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data);
    animate();
}

parseGeoTiff();

let swmm = {nodes:[], links:[]};
async function loadSwmm(inpFile){
    //FS.createPath('/', '/', true, true);
    //FS.ignorePermissions = true;
    //var f = FS.findObject('input.inp');
    //if (f) {
    //    FS.unlink('input.inp');
    //}

    let inpRes = await fetch(inpFile);
    let inpText = await inpRes.text();
    let inp = parseInp(inpText);

    
    await preProcessModel();
    let p_inpText = await autoCollect(inp);
    await initSwmm(inpText);
    
    async function autoCollect(p_inp){
        function collectJunction(junction, geom1){
            const heightmap_pixels = heightmap.image.data;
            
            let elevation = Number(junction.Invert);
            let b_elev = elevation;
            let node_pos = xyPos(junction.index_x, junction.index_y);
            let d_elev = heightmap_pixels[node_pos+3];
            
            if(elevation > d_elev
                || elevation == 0.0
                || b_elev < elevation){
                if(d_elev-1.0 > b_elev){

                }else{
                    b_elev = d_elev-1;
                }
            }else{
                b_elev = elevation;
            }

            let maxDepth = d_elev - b_elev;
            if(geom1 > maxDepth){
                maxDepth = geom1;
                b_elev = d_elev - maxDepth;
            }

            //console.log('z:'+d_elev, 'invert:'+junction.Invert, 'Depth:'+junction.Dmax, 'elevation:'+b_elev, 'maxdepth:'+maxDepth);
            //console.log('z:'+d_elev, 'rz:'+(b_elev+maxDepth));
            junction.Dmax = maxDepth;
            junction.Invert = b_elev;
        }

        for(let i=0; i<swmm.links.length; ++i){
            let conduit = swmm.links[i];

            let prevJunction = conduit.fromNode;
            let nextJunction = conduit.toNode;
       
            if(!prevJunction || !nextJunction){
               continue; 
            }
            let c_geom1 = Number(conduit.Geom1);
            
            collectJunction(prevJunction, c_geom1);
            collectJunction(nextJunction, c_geom1);
        }

        function outputInp(p_inp){
            //title
            let resultInp=`[TITLE]\n`;
            let title = p_inp.TITLE[0].TitleNotes;
            resultInp+=`${title}`;
            resultInp+=`\n\n`;

            //options
            resultInp+=`[OPTIONS]\n`;
            let options = Object.keys(p_inp.OPTIONS);
            for(let i=0; i<options.length; ++i){
                let key = options[i];
                //console.log(key, p_inp.OPTIONS[key].Value);
                resultInp+=`${key}          ${p_inp.OPTIONS[key].Value}\n`;
            }
            resultInp+=`\n\n`;

            //junctions
            resultInp+=`[JUNCTIONS]\n`;
            for(let i=0; i<swmm.nodes.length; ++i){
                let node = swmm.nodes[i];
                if(node.Name.startsWith('J')){
                    resultInp+=`${node.Name}          ${node.Invert}          ${node.Dmax}          ${node.Dinit}          ${node.Dsurch}          ${node.Aponded}\n`;
                }
            }
            resultInp+=`\n\n`;

            //outfalls
            resultInp+=`[OUTFALLS]\n`;
            for(let i=0; i<swmm.nodes.length; ++i){
                let node = swmm.nodes[i];
                if(node.Name.startsWith('O')){
                    resultInp+=`${node.Name}          ${node.Invert}          ${node.Type}          ${node.StageData}          ${node.Gated}\n`;
                }
            }
            resultInp+=`\n\n`;

            //conduits
            resultInp+=`[CONDUITS]\n`;
            for(let i=0; i<swmm.links.length; ++i){
                let conduit = swmm.links[i];
    
                let prevJunction = conduit.fromNode;
                let nextJunction = conduit.toNode;
           
                if(!prevJunction || !nextJunction){
                   continue; 
                }

                resultInp+=`${conduit.Name}          ${prevJunction.Name}          ${nextJunction.Name}          ${conduit.Length}          ${conduit.Roughness}          ${conduit.InOffset}          ${conduit.OutOffset}          ${conduit.InitFlow}          ${conduit.MaxFlow}\n`;
            }
            resultInp+=`\n\n`;

            //xsections
            resultInp+=`[XSECTIONS]\n`;
            for(let i=0; i<swmm.links.length; ++i){
                let conduit = swmm.links[i];
    
                let prevJunction = conduit.fromNode;
                let nextJunction = conduit.toNode;
           
                if(!prevJunction || !nextJunction){
                   continue; 
                }

                resultInp+=`${conduit.Name}          ${conduit.Shape}          ${conduit.Geom1}          ${conduit.Geom2}          ${conduit.Geom3}          ${conduit.Geom4}          ${conduit.Barrels}          \n`;
            }
            resultInp+=`\n\n`;

            //losses
            resultInp+=`[LOSSES]\n`;
            for(let i=0; i<swmm.links.length; ++i){
                let conduit = swmm.links[i];

                let prevJunction = conduit.fromNode;
                let nextJunction = conduit.toNode;
                if(!prevJunction || !nextJunction){
                   continue; 
                }

                resultInp+=`${conduit.Name}          0          0          0          NO          0          \n`;
            }
            resultInp+=`\n\n`;

            //coordinates
            resultInp+=`[COORDINATES]\n`;
            for(let i=0; i<swmm.nodes.length; ++i){
                let node = swmm.nodes[i]; 
                resultInp+=`${node.Name}          ${node.x}          ${node.y}\n`;
            }
            resultInp+=`\n\n`;

            return resultInp;
        }

        return outputInp(p_inp);
    }
    
    async function initSwmm(p_inpText){
        FS.createDataFile('/tmp/', 'input.inp', p_inpText, true, true);
        swmm_open("/tmp/input.inp", "/tmp/Example1x.rpt", "/tmp/out.out");
        swmm_start(1);
        swmm_setAllowPonding(1);
        let ponding = swmm_getAllowPonding();

        await nodePonding();
    }

    async function nodePonding(){
        for(let i=0; i<swmm.nodes.length; ++i){
            let node = swmm.nodes[i];
            if(!node['containStudy']){
                continue;
            }
            swmm_setNodePondedArea(i, MinSurfArea);
        }
    }

    async function preProcessModel(){
        //junction 전처리
        let junctionkeys = Object.keys(inp.JUNCTIONS);
        for(let i=0; i<junctionkeys.length; ++i){
            let jkey = junctionkeys[i];
            let junction = inp.JUNCTIONS[jkey];
            let coord = inp.COORDINATES[jkey];
            junction['Name'] = jkey;
            junction['junction_kind'] = 'junction';
            junction['x'] = coord.x;
            junction['y'] = coord.y;
            if(global_bbox[0] < junction.x && global_bbox[1] < junction.y 
                && global_bbox[2] > junction.x && global_bbox[3] > junction.y){
                junction['containStudy'] = true;

                let subX = centerXY[0] - junction.x;
                let subY = centerXY[1] - junction.y;

                let bX = subX / beX;
                let bY = subY / beY;
                
                let index_x = bX > 0 ? bX - BOUNDS_HALF : BOUNDS_HALF - bX;
                let index_y = bY > 0 ? bY - BOUNDS_HALF : BOUNDS_HALF - bY;
                index_x = Math.abs(index_x);
                index_y = Math.abs(index_y);
                if(Math.round(index_x) >= BOUNDS || Math.round(index_y) >= BOUNDS){
                    junction['containStudy'] = false;
                }
                //console.log(jkey, index_x, index_y);

                let world_x = index_x - BOUNDS_HALF;
                let world_z = BOUNDS_HALF - index_y;

                junction['raw_index_x'] = index_x;
                junction['raw_index_y'] = index_y;
                junction['index_x'] = Math.round(index_x);
                junction['index_y'] = Math.round(index_y);
                junction['world_x'] = world_x;
                junction['world_z'] = world_z;
            }else{
                junction['containStudy'] = false;
            }
            swmm.nodes.push(junction);
        }

        //outfall 전처리
        let outfallkeys = Object.keys(inp.OUTFALLS);
        for(let i=0; i<outfallkeys.length; ++i){
            let okey = outfallkeys[i];
            let outfall = inp.OUTFALLS[okey];
            let coord = inp.COORDINATES[okey];
            outfall['Name'] = okey;
            outfall['junction_kind'] = 'spew';
            outfall['x'] = coord.x;
            outfall['y'] = coord.y;
            if(global_bbox[0] < outfall.x && global_bbox[1] < outfall.y 
                && global_bbox[2] > outfall.x && global_bbox[3] > outfall.y){
                outfall['containStudy'] = true;
                let subX = centerXY[0] - outfall.x;
                let subY = centerXY[1] - outfall.y;

                let bX = subX / beX;
                let bY = subY / beY;
                
                let index_x = bX > 0 ? bX - BOUNDS_HALF : BOUNDS_HALF - bX;
                let index_y = bY > 0 ? bY - BOUNDS_HALF : BOUNDS_HALF - bY;
                index_x = Math.abs(index_x);
                index_y = Math.abs(index_y);
                if(index_x >= BOUNDS || index_y >= BOUNDS){
                    outfall['containStudy'] = false;
                    debugger
                }
                //console.log(okey, index_x, index_y);

                let world_x = index_x - BOUNDS_HALF;
                let world_z = BOUNDS_HALF - index_y;

                outfall['index_x'] = Math.round(index_x);
                outfall['index_y'] = Math.round(index_y);
                outfall['world_x'] = world_x;
                outfall['world_z'] = world_z;

            }else{
                outfall['containStudy'] = false;
            }
            swmm.nodes.push(outfall);
        }

        //conduit 전처리
        let conduitKeys = Object.keys(inp.CONDUITS);
        for(let i=0; i<conduitKeys.length; ++i){
            let ckey = conduitKeys[i];
            let conduit = inp.CONDUITS[ckey];
            let fromNode = conduit.FromNode;
            let toNode = conduit.ToNode;
            if(fromNode && fromNode.startsWith('J')){
                fromNode = inp.JUNCTIONS[fromNode];
            }else if(fromNode && fromNode.startsWith('O')){
                fromNode = inp.OUTFALLS[fromNode];
            }
            if(toNode && toNode.startsWith('J')){
                toNode = inp.JUNCTIONS[toNode];
            }else if(toNode && toNode.startsWith('O')){
                toNode = inp.OUTFALLS[toNode];
            }

            //스터디 범위 밖이면 무시
            if(!fromNode['containStudy'] || !toNode['containStudy']){
                continue;
            }

            let length_x = fromNode.world_x - toNode.world_x;
            let length_z = fromNode.world_z - toNode.world_z;
            let length_y = Math.abs(Number(fromNode.Invert) - Number(toNode.Invert));
            let length = Math.sqrt(length_x*length_x + length_z*length_z); //2d

            // if(ckey == 'C_16'){
            //     debugger
            // }
            let _3dLen = 0;
            if(length_y > 0){
                _3dLen = Math.sqrt(length*length + length_y*length_y); //3d
            }
            //console.log(length);
            conduit['Name'] = ckey;
            conduit['Length'] = length;
            conduit['_3dLen'] = _3dLen;
            let xsection = inp.XSECTIONS[ckey];
            conduit['Barrels'] = xsection['Barrels'];
            conduit['Geom1'] = xsection['Geom1'];
            conduit['Geom2'] = xsection['Geom2'];
            conduit['Geom3'] = xsection['Geom3'];
            conduit['Geom4'] = xsection['Geom4'];
            conduit['Shape'] = xsection['Shape'];
            conduit['fromNode'] = fromNode;
            conduit['toNode'] = toNode;

            swmm.links.push(conduit);
        }


        //let startTime = performance.now(); // 측정 시작
        // for(let i=0; i<junctionkeys.length; ++i){
        //     let Name = junctionkeys[i];
        //     const node = Module.ccall('swmm_getNodeData','number',['number'], [i]);

        //     let inflow = Module.getValue(node, 'double');
        //     let outflow = Module.getValue(node + 8, 'double');
        //     let head = Module.getValue(node + 16, 'double');
        //     let crestElev = Module.getValue(node + 24, 'double');
        //     let type = Module.getValue(node + 32, 'i32');
        //     let subIndex = Module.getValue(node + 36, 'i32');
        //     let InverElev = Module.getValue(node + 40, 'double');
        //     let InitDepth = Module.getValue(node + 48, 'double');
        //     let fullDepth = Module.getValue(node + 56, 'double');
        //     let surDepth = Module.getValue(node + 64, 'double');
        //     let pondedArea = Module.getValue(node + 72, 'double');
        //     let degree = Module.getValue(node + 80, 'i32');
        //     let updated = String.fromCharCode(Module.getValue(node + 84, 'i8'));
        //     let crownElev = Module.getValue(node + 88, 'double');
        //     let losses = Module.getValue(node + 96, 'double');
        //     let newVolume = Module.getValue(node + 104, 'double');
        //     let fullVolume = Module.getValue(node + 112, 'double');
        //     let overflow = Module.getValue(node + 120, 'double');
        //     let newDepth = Module.getValue(node + 128, 'double');
        //     let newLatFlow = Module.getValue(node + 136, 'double');
        //     _free(node);
        //     //console.log('Name:'+Name+" invEl:"+InverElev + " fullDepth:"+fullDepth);
        // }
        
        //let endTime = performance.now(); // 측정 종료
        //console.log(`걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);

        //let rpt = intArrayToString(FS.findObject('/tmp/Example1x.rpt').contents);
        //console.log(rpt);
    }
 
 
}

var cloudParticles, flash, rain, rainGeo, rainCount = 3000, cloudCount = 20;
const dummy = new THREE.Object3D();
let thunder = 500000;
let gravity = 9.80665;

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

async function addDrainNetworkMesh(){
    //const originmap_pixcels = originmap.image.data;

    let drawJunction = (node, conduitGeom1, offset)=>{
        let j_elevation = Number(node.Invert);
        let j_maxDepth = node.junction_kind == 'spew' ? 0 : Number(node.Dmax);
        /** junction의 depth와 conduit의 geom1을 비교해서 큰 값으로 depth를 정함. */
        let sumJunctionDepth = j_elevation + j_maxDepth;
        let sumDepth = j_elevation + conduitGeom1;
        let resultDepth = sumDepth > sumJunctionDepth ? sumDepth : sumJunctionDepth;
        resultDepth += offset;

        let x = 0;
        let y = resultDepth;
        let width = 1.2192; //4ft를 m로 치환시 1.2192미터로 지름을 환산.
        let height = resultDepth-j_elevation;

        const geometry = new THREE.CylinderGeometry( width/beX, width/beY, height, 24, 1, true, 0 ); 
        const material = new THREE.MeshPhongMaterial( {wireframe:false, depthTest:true, /*transparent:true, opacity:0.5,*/ color: 0xaaaaaa, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true} ); 
        const cylinder = new THREE.Mesh( geometry, material ); 
        cylinder.position.x = node.world_x;
        cylinder.position.z = node.world_z;

        //let pos = xyPos(node.index_x, node.index_y);
        //let terrain = originmap_pixcels[pos+3];
        cylinder.position.y = j_elevation + height/2;// + 0.1; //0.1m 지표면으로 표출

        scene.add(cylinder);

        node.mesh = cylinder;
    };


    for(let i=0; i<swmm.links.length; ++i){
        let conduit = swmm.links[i];
        let c_length = Number(conduit.Length);
        let _3dLen = Number(conduit._3dLen);
        if(_3dLen == 0){
            _3dLen = c_length;
        }

        let prevJunction = conduit.fromNode;
        let nextJunction = conduit.toNode;
   
        if(!prevJunction || !nextJunction){
           continue; 
        }
        let c_geom1 = Number(conduit.Geom1);
        let c_inOffset = Number(conduit.InOffset);
        let c_outOffset = Number(conduit.OutOffset);

        let prev_j_elevation = Number(prevJunction.Invert);
        //let prev_j_maxDepth = prevJunction.junction_kind == 'spew' ? 0 : Number(prevJunction.Dmax);
        let next_j_elevation = Number(nextJunction.Invert);
        //let next_j_maxDepth = nextJunction.junction_kind == 'spew' ? 0 : Number(nextJunction.Dmax);

        // let prev_sumJunctionDepth = prev_j_elevation + prev_j_maxDepth;
        // let prev_sumDepth = prev_j_elevation + c_geom1;
        // let next_sumJunctionDepth = next_j_elevation + next_j_maxDepth;
        // let next_sumDepth = next_j_elevation + c_geom1;

        //let top_startPos = prev_sumDepth > prev_sumJunctionDepth ? prev_sumDepth : prev_sumJunctionDepth;
        //let top_endPos = next_sumDepth > next_sumJunctionDepth ? next_sumDepth : next_sumJunctionDepth;
        let bottom_startPos = prev_j_elevation + c_inOffset;
        let bottom_endPos = next_j_elevation + c_outOffset;

        /** conduit 상단 바 */
        let top_start_x =  0;
        let top_next_x = c_length;
        let top_start_y = c_geom1 + prev_j_elevation + c_inOffset;
        let top_next_y = c_geom1 + next_j_elevation + c_outOffset;

        /** conduit 하단 바 */
        let bottom_start_x = top_start_x;
        let bottom_next_x = top_next_x;
        let bottom_start_y = bottom_startPos;
        let bottom_next_y = bottom_endPos;

        //상단바 기울기 각도 구하기
        let t_difX = top_next_x - top_start_x;
        let t_difY = top_next_y - top_start_y;
        let t_radian = Math.atan2(t_difY, t_difX);
        let t_degree = t_radian * 180 / Math.PI;

        //하단바 기울기 각도 구하기
        let b_difX = bottom_next_x - bottom_start_x;
        let b_difY = bottom_next_y - bottom_start_y;
        let b_radian = Math.atan2(b_difY, b_difX);
        let b_degree = b_radian * 180 / Math.PI;

        //xz 축 각도 구하기
        let h_difX = nextJunction.world_x - prevJunction.world_x;
        let h_difZ = prevJunction.world_z - nextJunction.world_z;
        let h_radian = Math.atan2(h_difZ, h_difX);
        let h_degree = h_radian * 180 / Math.PI;

        //if(conduit.Name == 'C_16'){
        //    debugger
        //}
        //console.log(t_degree, b_degree, h_degree);

        const geometry = new THREE.CylinderGeometry( c_geom1/beX, c_geom1/beY, _3dLen, 24, 1, true, 0 ); 
        const material = new THREE.MeshPhongMaterial( {wireframe:false,depthTest:true,/*transparent:true, opacity:0.5,*/ color: 0xaaaaaa, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true} ); 
        const cylinder = new THREE.Mesh( geometry, material ); 
        cylinder.position.x = (prevJunction.world_x + nextJunction.world_x) / 2;
        cylinder.position.z = (prevJunction.world_z + nextJunction.world_z) / 2;
        cylinder.position.y = (prev_j_elevation+next_j_elevation)/2 + (c_geom1/beX+c_geom1/beY)/2;
        
        cylinder.rotation.z = Math.PI/2 + t_radian;
        cylinder.rotation.y = h_radian;
        scene.add(cylinder);

        //prevJunction 그리기
        drawJunction(prevJunction, c_geom1, c_inOffset);
        //nextJunction 그리기
        if(nextJunction.junction_kind == 'junction'){ //마지막 outfall은 그리지 않음.
            drawJunction(nextJunction, c_geom1, c_outOffset);
        }

        conduit.mesh = cylinder;
    }
}

let cube;
let pxv, pyv, pzv;
async function init(terrainData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data) {
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

    const sun2 = new THREE.DirectionalLight( 0xFFFFFF, 2.0 );
    sun2.position.set( - 100, 350, - 200 );
    scene.add( sun2 );

    const geometry = new THREE.BoxGeometry(4,4,4);
    cube = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( 0xff0000 ) );
    
    
    //0,0, 300
    cube.position.x = 0;
    cube.position.y = 0;
    cube.position.z = 0;
    cube.visible = false;
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

    const onlyDrainController = {
        'onlyDrainView': onlyDrainView
    };

    const setilController = {
        'setilView': setilView
    };

    const buildingController = {
        'buildingView': buildingView
    };

    const drainController = {
        'drainView': drainView
    };

    const waterController = {
        'waterView' : waterView
    }

    const weatherController = {
        'weatherView' : weatherView
    }

    gui.add(onlyDrainController, 'onlyDrainView' ).name('관망도만 보기').onChange( (check)=>{
        console.log(check)
        //weatherOn(!check);
        terrainMaterial.uniforms[ 'setilView' ].value = !check;
        terrainMaterial.uniforms[ 'buildingView' ].value = !check;
        terrainMaterial.uniforms[ 'drainView' ].value = !check;
        water.visible = !check;
        terrainMesh.visible = !check;
    } );

    gui.add(setilController, 'setilView' ).name('위성지도').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'setilView' ].value = check;
        waterMaterial.uniforms[ 'setilView' ].value = check;
        water2.material.uniforms[ 'setilView' ].value = check;
    } );
    gui.add(buildingController, 'buildingView' ).name('건물').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'buildingView' ].value = check;
    } );
    gui.add(drainController, 'drainView' ).name('관망').onChange( (check)=>{
        console.log(check)

        terrainMaterial.uniforms[ 'drainView' ].value = check;
    } );
    gui.add(waterController, 'waterView' ).name('물').onChange( (check)=>{
        console.log(check)

        water.visible = check;
        waterMesh.visible = check;
    } );
    gui.add(weatherController, 'weatherView' ).name('날씨효과').onChange( (check)=>{
        console.log(check)

        weatherOn(check);
    } );

    await initWater();
    await setCompute(terrainData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data);
    
    await loadSwmm('/asset/swmm/drain_00387.inp');
    await addDrainNetworkMesh();

    
    await loadBuildings();
}

function weatherOn(check){
    sky.visible = check;
    cloudParticles.visible = check;
    flash.visible = check;
    rain.visible = check;
    
    //water.material.uniforms.waterColor.value = check ? new THREE.Color(0x001e0f) : new THREE.Color(0xaff);
}

function loadTexture(src){
    return new Promise((resolve, reject)=>{
        new THREE.TextureLoader().load(src, (texture)=>{
            resolve(texture);
        });
    });
}

let waterRenderTarget;
let setilmapTexture;
async function initWater() {
    
    setilmapTexture = await loadTexture('/asset/output_daejeon_proc2.png'); 
    const geometry = new THREE.PlaneGeometry( BOUNDS, BOUNDS, BOUNDS-1, BOUNDS-1);
    
    // material: make a THREE.ShaderMaterial clone of THREE.MeshPhongMaterial, with customized vertex shader
    terrainMaterial = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
                'drainmap': { value: null },
                'setilmap' : {value: setilmapTexture},
                'setilView' :  {value: setilView },
                'buildingView' :  {value: buildingView },
                'drainView' :  {value: drainView },
                'originmap' :  {value: null },
            }
        ] ),
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        transparent: true
    } );
    terrainMaterial.side = THREE.DoubleSide;
    terrainMaterial.depthTest = true;

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

    water2 = new Water2(geometry, {
        textureWidth: BOUNDS,
        textureHeight: BOUNDS,
        color: 0x3366ff
    });

    water.rotation.x = - Math.PI / 2;
    water.matrixAutoUpdate = false;
    water.updateMatrix();

    water2.rotation.x = - Math.PI / 2;
    water2.matrixAutoUpdate = false;
    water2.updateMatrix();


    const normalMap0 = await loadTexture( '/js/water/Water_1_M_Normal.jpg' );
    const normalMap1 = await loadTexture( '/js/water/Water_2_M_Normal.jpg' );
    normalMap0.wrapS = normalMap0.wrapT = THREE.RepeatWrapping;
    normalMap1.wrapS = normalMap1.wrapT = THREE.RepeatWrapping;
    const textureMatrix = new THREE.Matrix4();
    textureMatrix.set(
        0.5, 0.0, 0.0, 0.5,
        0.0, 0.5, 0.0, 0.5,
        0.0, 0.0, 0.5, 0.5,
        0.0, 0.0, 0.0, 1.0
    );
    waterMaterial = new THREE.ShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib[ 'phong' ].uniforms,
            {
                'heightmap': { value: null },
                'originmap': { value: null },
                'unit': { value: 1./BOUNDS.toFixed(1) },
                'buildingmap': { value: null },
                'setilmap' : {value: setilmapTexture},
                'setilView' :  {value: setilView },
                'uvmap' :  {value: null },
                'thismap' :  {value: null },
                'tNormalMap0' :  {value: normalMap0 },
                'tNormalMap1' :  {value: normalMap1 },
                'config' : {value: new THREE.Vector4() },
                'textureMatrix' : {value: textureMatrix },
            }
        ] ),
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,
        depthTest: true,
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
    waterMaterial.uniforms[ 'diffuse' ].value = new THREE.Color( 0x3366ff );
    waterMaterial.uniforms[ 'specular' ].value = new THREE.Color( 0x111111 );
    waterMaterial.uniforms[ 'shininess' ].value = Math.max( 50, 1e-4 );
    waterMaterial.uniforms[ 'opacity' ].value = 1.0;
    waterMaterial.uniforms[ 'config' ].value.x = 0.0;
    waterMaterial.uniforms[ 'config' ].value.y = halfCycle;
    waterMaterial.uniforms[ 'config' ].value.z = halfCycle;
    waterMaterial.uniforms[ 'config' ].value.w = 1.0;

    // Defines
    terrainMaterial.defines.WIDTH = WIDTH.toFixed( 1 );
    terrainMaterial.defines.BOUNDS = BOUNDS.toFixed( 1 );
    waterMaterial.defines.WIDTH = WIDTH.toFixed( 1 );
    waterMaterial.defines.BOUNDS = BOUNDS.toFixed( 1 );
    waterMaterial.defines.resolution = 'vec2( ' + BOUNDS.toFixed( 1 ) + ', ' + BOUNDS.toFixed( 1 ) + ' )';
 

    waterMesh = new THREE.Mesh( geometry, waterMaterial );
    waterMesh.rotation.x = - Math.PI / 2;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();

    // waterRenderTarget = new THREE.WebGLRenderTarget( BOUNDS, BOUNDS, {
    //     wrapS: THREE.ClampToEdgeWrapping,
    //     wrapT: THREE.ClampToEdgeWrapping,
    //     minFilter: THREE.LinearFilter,
    //     magFilter: THREE.LinearFilter,
    // } );

    // let scope = waterMesh;
    // waterMesh.onBeforeRender = function (renderer, scene, camera){
    //     // Render
    //     const currentRenderTarget = renderer.getRenderTarget();

    //     const currentXrEnabled = renderer.xr.enabled;
    //     const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

    //     scope.visible = false;

    //     renderer.xr.enabled = false; // Avoid camera modification and recursion
    //     renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

    //     renderer.setRenderTarget( waterRenderTarget );

    //     renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897

    //     if ( renderer.autoClear === false ) renderer.clear();
    //     renderer.render( scene, camera );

    //     scope.visible = true;

    //     renderer.xr.enabled = currentXrEnabled;
    //     renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

    //     renderer.setRenderTarget( currentRenderTarget );

    //     // Restore viewport

    //     const viewport = camera.viewport;

    //     if ( viewport !== undefined ) {

    //         renderer.state.viewport( viewport );

    //     }
    // }


    terrainMesh = new THREE.Mesh( geometry, terrainMaterial );
    terrainMesh.rotation.x = - Math.PI / 2;
    terrainMesh.matrixAutoUpdate = false;
    terrainMesh.updateMatrix();

    transformControl.attach(cube);

    scene.add( waterMesh );
    //scene.add(water);
    //scene.add(water2);
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

let hydrologyFilter;
let qFilter;
let hFilter;
let myFilter1, myFilter2;
let myRenderTarget1, myRenderTarget2;
let renderTargets;
let currentRenderIndex = 0;

let readWaterLevelRenderTarget;
let readWaterLevelImage;
let heightmap;
let buildingmap;
let originmap;
let drainmap;
let outfallmap;
let infilmap;
let uvmap;

async function setCompute(terrainData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data){
    
    // Creates the gpu computation class and sets it up

    gpuCompute = new GPUComputationRenderer( BOUNDS, BOUNDS, renderer );

    if ( renderer.capabilities.isWebGL2 === false ) {

        gpuCompute.setDataType( THREE.HalfFloatType );

    }

    heightmap = gpuCompute.createTexture();
    originmap = gpuCompute.createTexture();
    buildingmap = gpuCompute.createTexture();
    infilmap = gpuCompute.createTexture();
    uvmap = gpuCompute.createTexture();

    fillTexture( heightmap, originmap, buildingmap, infilmap, terrainData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data); 
    makeUvMap(uvmap);
    //heightmap.flipY = true; //위성사진 y값을 거꿀로 바꿈
    //originmap.flipY = true; //위성사진 y값을 거꿀로 바꿈

    terrainMaterial.uniforms[ 'originmap' ].value = originmap;

    
    let uniforms = {
        'heightmap': { value: null },
        'buildingmap': { value: buildingmap },
        'infilmap': { value: infilmap },
        'drainmap': { value: null },
        'outfallmap': { value: null },
        'infiltrationRate': { value: infiltrationRate },
        'simTime': { value: 0.0 },
        'rain_per_sec': { value: rain_per_sec },
        'mousePos': { value: new THREE.Vector2( 10000, 10000 ) },
        'mouseSize': { value: 20.0 },
        'viscosityConstant': { value: 0.98 },
        'heightCompensation': { value: 0 },
        'unit': { value: 1.0/BOUNDS.toFixed(1) },
        'dt': { value: dt },
        'dx': { value: beX },
        'dy': { value: beY },
        'manningCoefficient': { value: 0.07 },
        'minFluxArea': { value: 0.01 },
        'sourceWaterHeight': { value: 49 },
        'sourceWaterVelocity': { value: 0.5 },
        'drainageAmount': { value: 0},
    }
    

    hydrologyFilter = gpuCompute.createShaderMaterial( hydrology, uniforms );
    qFilter = gpuCompute.createShaderMaterial( solve_q, uniforms );
    hFilter = gpuCompute.createShaderMaterial( update_h, uniforms );
    myFilter1 = gpuCompute.createShaderMaterial( advect, uniforms );
    myFilter2 = gpuCompute.createShaderMaterial( height, uniforms );
    
    
    myRenderTarget1 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
    myRenderTarget2 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
    //infilRenderTarget1 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.NearestFilter);
    //infilRenderTarget2 = gpuCompute.createRenderTarget(BOUNDS, BOUNDS, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.NearestFilter);

    renderTargets = [myRenderTarget1, myRenderTarget2];

    
    //gpuCompute.renderTexture( infilmap, infilRenderTarget1);
    //gpuCompute.renderTexture( infilmap, infilRenderTarget2);
    gpuCompute.renderTexture( heightmap, myRenderTarget1);
    gpuCompute.renderTexture( heightmap, myRenderTarget2);

    
    terrainMaterial.uniforms[ 'originmap' ].value = originmap;
    water.material.uniforms[ 'unit' ].value = 1.0/BOUNDS.toFixed(1);
    water.material.uniforms[ 'originmap' ].value = originmap;
    water.material.uniforms[ 'buildingmap' ].value = buildingmap;
    water2.material.uniforms[ 'unit' ].value = 1.0/BOUNDS.toFixed(1);
    water2.material.uniforms[ 'originmap' ].value = originmap;
    water2.material.uniforms[ 'buildingmap' ].value = buildingmap;
    water2.material.uniforms[ 'setilmap' ].value = setilmapTexture;
    waterMesh.material.uniforms[ 'unit' ].value = 1.0/BOUNDS.toFixed(1);
    waterMesh.material.uniforms[ 'originmap' ].value = originmap;
    waterMesh.material.uniforms[ 'buildingmap' ].value = buildingmap;

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

function fillTexture( heightmap, originmap, buildingmap, infilmap, terrainData, buildingData, streamData, surf_rough_Data, surf_infilmax_Data, surf_infilmin_Data) {

    const heightmap_pixels = heightmap.image.data;
    const originmap_pixcels = originmap.image.data;
    const buildingmap_pixcels = buildingmap.image.data;
    const infilmap_pixcels = infilmap.image.data;

    let cnt = 0;
    for ( let j = BOUNDS-1; j >= 0 ; j -- ) {
        for ( let i = 0; i < BOUNDS; i ++ ) {
            let pos = xyPos(i,j);
            //console.log('idx'+pos);
            let xPox = pos;
            let yPos = pos+1;
            let zPos = pos+2;
            let wPos = pos+3;

            let buildingHeight = buildingData[cnt];
            if(isNaN( buildingHeight )){
                buildingHeight = 0;
            }

            let streamHeight = streamData[cnt];
            
            if(streamHeight != 0){
                streamHeight = initStreamHeight;
            }else{
                streamHeight = 0;
            }
            
            
            let dbg = false;
            if(
                (i==BOUNDS_HALF && j == BOUNDS_HALF)
                // ||
                //(i==256 && j == 256)
                ){
                dbg = true;
                console.log(pos);
                //debugger
            }
            
            let terrain = terrainData[cnt];
            // for(let i=0; i<swmm.nodes.length; ++i){
            //     let node = swmm.nodes[i];
            //     let Name = node.Name;
            //     if(!node['containStudy']){
            //         continue;
            //     }
            //     let node_pos = xyPos(node.index_x, node.index_y);
            //     //if(pos == node_pos && Name == 'J_143'){
            //     //    console.log('dbg');
            //     //}
            //     if(pos == node_pos){
            //         collectHeight = node.Invert + node.Dmax;
            //         break;
            //     }
                
            // }

            heightmap_pixels[ xPox ] = 0;
            heightmap_pixels[ yPos ] = 0;
            heightmap_pixels[ zPos ] = streamHeight;
            heightmap_pixels[ wPos ] = terrain+buildingHeight;

            buildingmap_pixcels[ xPox ] = buildingHeight;
            buildingmap_pixcels[ yPos ] = 0;
            buildingmap_pixcels[ zPos ] = 0;
            buildingmap_pixcels[ wPos ] = 0;

            originmap_pixcels[ xPox ] = 0;
            originmap_pixcels[ yPos ] = 0;
            originmap_pixcels[ zPos ] = 0;
            originmap_pixcels[ wPos ] = terrain;

            let roughness = surf_rough_Data[cnt];
            if(isNaN( roughness ) || roughness == 0){
                roughness = 0.001;
            }
            let infilmax = surf_infilmax_Data[cnt];
            if(isNaN( infilmax ) || infilmax == 0){
                infilmax = 0;
            }
            let infilmin = surf_infilmin_Data[cnt];
            if(isNaN( infilmin ) || infilmin == 0){
                infilmin = 0;
            }
            infilmap_pixcels[ xPox ] = roughness;
            infilmap_pixcels[ yPos ] = infilmax;
            infilmap_pixcels[ zPos ] = infilmin;
            infilmap_pixcels[ wPos ] = rain_val;

            cnt++;

        }
    }

}

function makeUvMap(uvmap){
    const uvmap_pixcels = uvmap.image.data;

    //const width_half = BOUNDS / 2;
    //const height_half = BOUNDS / 2;

    const gridX = Math.floor( BOUNDS-1 );
    const gridY = Math.floor( BOUNDS-1 );

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    //const segment_width = BOUNDS / gridX;
    //const segment_height = BOUNDS / gridY;
    
    //const uvs = [];

    //let cnt = 0;
    for ( let iy = 0; iy < gridY1; iy ++ ) {

        //const y = iy * segment_height - height_half;

        for ( let ix = 0; ix < gridX1; ix ++ ) {

            //const x = ix * segment_width - width_half;
            
            let rx =  ix / gridX;
            let ry =  iy / gridY;

            let pos = xyPos(ix,iy);
           
            uvmap_pixcels[pos] = rx;
            uvmap_pixcels[pos+1] = ry;

            //console.log(cnt, rx, ry);
            //cnt++;
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
let swmmColor = [
    new THREE.Color(0.,1.,0.), //0~20%
    new THREE.Color(0.,0.,1.), //21~40%
    new THREE.Color(1.,1.,0.), //41~60%
    new THREE.Color(1.,0.5,0.), //61~80%
    new THREE.Color(1.,0,0.), //81~100%
];

function drainageStep(rt){
    let swmm_solve_dt = ()=>{
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
        elapsed_time = Module.getValue(input_ptr, 'double');
        //_free(input_ptr);

        //let endTime = performance.now(); // 측정 종료
        //console.log(`step:${elapsed_time} 걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);
    }

    let apply_linkage = ()=>{
        renderer.readRenderTargetPixels( rt , 0, 0, BOUNDS, BOUNDS, readWaterLevelImage );
        const readPixels = new Float32Array( readWaterLevelImage.buffer );

        // for(let i=0; i<pixels.length; ++i){
        //     if(pixels[i] >= 9999.){
        //         //debugger;
        //     }
        // }

        // let x = BOUNDS/2;
        // let y = BOUNDS/2;
        // let r = xyPos(x, y);
        // //console.log(pixels[r], pixels[r+1], pixels[r+2], pixels[r+3]); 
        // if(pixels[r+2] == 0.5){
        //     //debugger
        // }


        //let startTime = performance.now(); // 측정 시작
        //dt1d_sum+=10;
        
        drainmap = gpuCompute.createTexture();
        const drainmap_pixcels = drainmap.image.data;

        for(let i=0; i<swmm.nodes.length; ++i){
            let node = swmm.nodes[i];
            let Name = node.Name;
            
            if(!node['containStudy'] || Name.startsWith('O')){
                continue;
            }

            //swmm_setNodeFullDepth(i, 2.0/FOOT);
            //let head = swmm_getNodeHead(i);
            //let crestElev = swmm_getNodeCrestElev(i);
            //let depth = swmm_getNodeDepth(i);
            
            let pos = xyPos(node.index_x, node.index_y);
            let h = readPixels[pos+2];
            let z = readPixels[pos+3];
            let qdrain = apply_linkage_flow(i, h, z, node.Invert, beX*beY, dt1d);
           
            drainmap_pixcels[pos] = qdrain;

            if(node.mesh){
                let fullDepth = node.Dmax;
                let depth = swmm_getNodeDepth(i) * FOOT;
                let percent = depth / fullDepth * 100;
                //console.log('post', Name, depth, fullDepth, percent, qdrain);
                //if(qdrain > 0 )debugger
                if(percent > 0 && percent <= 20){
                    node.mesh.material.color = swmmColor[0];
                }else if(percent > 20 && percent <= 40){
                    node.mesh.material.color = swmmColor[1];
                }else if(percent > 40 && percent <= 60){
                    node.mesh.material.color = swmmColor[2];
                }else if(percent > 60 && percent <= 80){
                    node.mesh.material.color = swmmColor[3];
                }else if(percent > 80 && percent <= Number.POSITIVE_INFINITY){
                    node.mesh.material.color = swmmColor[4];
                }
            }
        }
        
        //let endTime = performance.now(); // 측정 종료
        //console.log(`apply_linkage 걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);
        
    }

    let outfall = ()=>{
        outfallmap = gpuCompute.createTexture();
        const outfallmap_pixcels = drainmap.image.data;

        for(let i=0; i<swmm.links.length; ++i){
            let conduit = swmm.links[i];
            let Name = conduit.Name;
            let prevJunction = conduit.fromNode;
            let nextJunction = conduit.toNode;
       
            if(!prevJunction || !nextJunction){
               continue; 
            }

            if(conduit.mesh){ 
                let fullDepth = conduit.Geom1;
                let depth = swmm_getLinkDepth(i) * FOOT;
                let percent = depth / fullDepth * 100;
                //console.log('post', Name, depth, fullDepth, percent, qdrain);
                //if(qdrain > 0 )debugger
                if(percent > 0 && percent <= 20){
                    conduit.mesh.material.color = swmmColor[0];
                }else if(percent > 20 && percent <= 40){
                    conduit.mesh.material.color = swmmColor[1];
                }else if(percent > 40 && percent <= 60){
                    conduit.mesh.material.color = swmmColor[2];
                }else if(percent > 60 && percent <= 80){
                    conduit.mesh.material.color = swmmColor[3];
                }else if(percent > 80 && percent <= Number.POSITIVE_INFINITY){
                    conduit.mesh.material.color = swmmColor[4];
                }
            }
            
            if(nextJunction.Name.startsWith('O')){
                //let cName = swmm_getLinkID(i);
                let cFlow = swmm_getLinkFlow(i);

                let pos = xyPos(nextJunction.index_x, nextJunction.index_y);
                outfallmap_pixcels[pos] = cFlow*FOOT3;

                //console.log(Name, nextJunction.Name, cFlow);
            }
            
            
        }
    }

    swmm_solve_dt();
    step();
    apply_linkage();
    outfall();

}

let _prefix = "";
function ____(pixels){
    let maxh = Number.MIN_VALUE;

    let maxi = -1;
    let maxj = -1;
    let maxY = 0;
    //let startTime = performance.now(); // 측정 시작
    let rainVol = 0;
    for ( let j = BOUNDS-1; j >= 0 ; j -- ) {
        for ( let i = 0; i < BOUNDS; i ++ ) {
            let pos = xyPos(i,j);
            //console.log('idx'+pos);
            let zPos = pos+2;
            if(pixels[zPos] > maxh){
                maxh = pixels[zPos];
                maxi = i;
                maxj = j;
                maxY = pixels[zPos+1] + maxh + 10;
            }
            
            rainVol+=pixels[zPos];
        }
    }
    console.log('simTime'+simTimeView.textContent, 'rainVol:'+rainVol);
    if(true){
        //if(_prefix == 'updateH'){
            let min_dim = Math.min(beX, beY);
            if(maxh > 0){
                dt = cfl * (min_dim / Math.sqrt(gravity*maxh));
                dt = Math.min(dtmax, dt);
            }else{
                dt = dtmax;
            }

            //console.log(maxh, dt);
        //}
    }
    

    // if(_prefix == 'ini'){
    //     c_i = maxi;
    //     c_j = maxj;
    //     let world_x = c_i - BOUNDS_HALF;
    //     let world_z = BOUNDS_HALF - c_j;
    //     cube.position.x = Math.abs(world_x);
    //     cube.position.y = maxY;
    //     cube.position.z = Math.abs(world_z);
    // }else{
    //     maxi = c_i;
    //     maxj = c_j;
    // }

    // maxi = 68;
    // maxj = 511;
 
    // let pos = xyPos(maxi, maxj);
    // let posLeft = xyPos(maxi-1, maxj);
    // let posRight = xyPos(maxi+1, maxj);
    // let posTop = xyPos(maxi, maxj+1);
    // let posBottom = xyPos(maxi, maxj-1);
    // console.log(_prefix,'center', maxi, maxj, maxh, pixels[pos], pixels[pos+1], pixels[pos+2], pixels[pos+3]);
    //console.log(_prefix,'left', maxi, maxj, maxh, pixels[posLeft], pixels[posLeft+1], pixels[posLeft+2], pixels[posLeft+3]);
    //console.log(_prefix,'right', maxi, maxj, maxh, pixels[posRight], pixels[posRight+1], pixels[posRight+2], pixels[posRight+3]);
    //console.log(_prefix,'top', maxi, maxj, maxh, pixels[posTop], pixels[posTop+1], pixels[posTop+2], pixels[posTop+3]);
    //console.log(_prefix,'bottom', maxi, maxj, maxh, pixels[posBottom], pixels[posBottom+1], pixels[posBottom+2], pixels[posBottom+3]);

}

async function solve_dt(rt){
    renderer.readRenderTargetPixels( rt , 0, 0, BOUNDS, BOUNDS, readWaterLevelImage );
    const pixels = new Float32Array( readWaterLevelImage.buffer );
    //console.log(pixels[0], pixels[1], pixels[2], pixels[3]);
    
    //console.log('h',pixels[dbgPos470_r+2]);

    let maxh = Number.MIN_VALUE;

    let maxi = -1;
    let maxj = -1;
    let maxY = 0;
    //let startTime = performance.now(); // 측정 시작
    let rainVol = 0;
    for ( let j = BOUNDS-1; j >= 0 ; j -- ) {
        for ( let i = 0; i < BOUNDS; i ++ ) {
            let pos = xyPos(i,j);
            //console.log('idx'+pos);
            let zPos = pos+2;
            if(pixels[zPos] > maxh){
                maxh = pixels[zPos];
                maxi = i;
                maxj = j;
                maxY = pixels[zPos+1] + maxh + 10;
            }
            
            rainVol+=pixels[zPos];
        }
    }
    //console.log('simTime'+simTimeView.textContent, 'rainVol:'+rainVol);
    
    let min_dim = Math.min(beX, beY);
    if(maxh > 0){
        dt = cfl * (min_dim / Math.sqrt(gravity*maxh));
        dt = Math.min(dtmax, dt);
    }else{
        dt = dtmax;
    }

    //console.log(maxh, dt);
    
  
    //let endTime = performance.now(); // 측정 종료
    //console.log(`걸린 작업 시간은 총 ${endTime - startTime} 밀리초입니다.`);
    //console.log(maxh);
}


let next_surf = 0.0;
let next_drain = 0.0;
let next_step = 0;
async function compute(){
    for(let i=0; i<1; ++i){
        let nextRenderIndex = currentRenderIndex == 0 ? 1 : 0;

        let rt1 = renderTargets[currentRenderIndex];
        let rt2 = renderTargets[nextRenderIndex];
         
        hydrologyFilter.uniforms.dt.value = dt;
        hydrologyFilter.uniforms.simTime.value = simTime;
        hydrologyFilter.uniforms.heightmap.value = rt2.texture;
        gpuCompute.doRenderTarget( hydrologyFilter, rt1 );
        
        if(true && simTime == next_drain){
            drainageStep(rt1);
            next_drain += dt1d;
            //console.log(next_drain, dt1d, dt);
        }

        qFilter.uniforms.dt.value = dt;
        qFilter.uniforms.heightmap.value = rt1.texture;
        gpuCompute.doRenderTarget( qFilter, rt2 );

        hFilter.uniforms.dt.value = dt;
        hFilter.uniforms.heightmap.value = rt2.texture;
        hFilter.uniforms.drainmap.value = drainmap;
        hFilter.uniforms.outfallmap.value = outfallmap;
        gpuCompute.doRenderTarget( hFilter, rt1 );
        //_prefix = "updateH"
        solve_dt(rt1);
        next_surf+=dt;

        next_step = Math.min(next_surf, next_drain);
        next_surf = next_step;
        dt = next_step - simTime;

        //myFilter1.uniforms.drainmap.value = drainmap;
        //myFilter1.uniforms.heightmap.value = rt2.texture;
        //myFilter1.uniforms.infilmap.value = infilRenderTarget1.texture;
        //getReadPixcel('init', rt2, true);
        //gpuCompute.doRenderTarget( myFilter1, rt1 );

        //myFilter2.uniforms.heightmap.value = rt1.texture;
        //getReadPixcel('advect', rt1, false);
        //gpuCompute.doRenderTarget( myFilter2, rt2 );
 
        //myFilter3.uniforms.heightmap.value = rt2.texture;
        //getReadPixcel('height', rt2, false);
        //gpuCompute.doRenderTarget( myFilter3, rt1 );
        //getReadPixcel('velocity', rt1, false);
        
        
        simTime += dt;

        currentRenderIndex = currentRenderIndex == 0 ? 1 : 0;
    }

    simTimeView.innerText = convTime();
}

function convTime(){
    let sec = simTime%60;
    let min = simTime/60;
    let hour = min/60;
    let day = hour/24;
    return day.toFixed(1)+'일 '+hour.toFixed(1)+'시 '+min.toFixed(1)+'분 '+sec.toFixed(1)+'초';
}

async function render() {
    await compute();
    terrainMaterial.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex ].texture; 
    water.material.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex ].texture;
    water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
    water2.material.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex ].texture;

    waterMaterial.uniforms[ 'heightmap' ].value = renderTargets[currentRenderIndex ].texture;
    waterMaterial.uniforms[ 'uvmap' ].value = uvmap;

    rainRender();
    updateFlow();
    // Render
    //renderer.setRenderTarget( null );
    //let lv = renderer.getActiveMipmapLevel()
    //debugger
    renderer.render( scene, camera );
   
    //waterMaterial.uniforms[ 'thismap' ].value = waterRenderTarget.texture;
    
    //pxv.innerText = cube.position.x;
    //pyv.innerText = cube.position.y;
    //pzv.innerText = cube.position.z;

    
}

let flowSpeed = 0.03;
function updateFlow() {

    const delta = clock.getDelta();
    const config = waterMaterial.uniforms[ 'config' ];

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