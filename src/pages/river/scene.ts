import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RiverPhysics, NX, NZ, LENGTH, WIDTH, center, breadth, obstacles } from './physics';
import { waveNumber, environment, currentSpeed, type SimulationSettings } from './system';
import { downloadCanvas } from './capture';
import { photographicLight } from './photographicLight';
import { scannedRocks } from './scannedRocks';
import { forest } from './forest';
import { windState } from './wind';
import { floatingLeaves } from './floatingLeaves';
import { vertexShader, fragmentShader } from './shaders';

function noise(x: number, z: number) { return Math.sin(x * 1.13 + z * .73) * .45 + Math.sin(x * 2.91 - z * 1.63) * .17 + Math.cos(x * .33 + z * .38) * .7; }
function terrainHeight(x: number, z: number, depth: number) {
    const side = Math.abs(x - center(z)) / breadth(z);
    if (side < 1) return -depth * (.35 + .65 * (1 - side * side)) + noise(x * 3, z * 3) * .045;
    return .07 + Math.pow(Math.min(side - 1, 5), .8) * .9 + noise(x, z) * .16 * Math.min(1, (side - 1) * 4);
}
export interface RiverScene { dispose(): void; resetCamera(): void; setView(view: 'surface' | 'overview'): void; reset(): void; disturb(): void; screenshot(): void }
export function createRiverScene(host: HTMLDivElement, getSettings: () => SimulationSettings, onReady: () => void): RiverScene {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    host.appendChild(renderer.domElement);
    let loadedAssets=0;const assetReady=()=>{loadedAssets++;};
    const scene = new THREE.Scene();
    const env=environment(getSettings().kind),scaleX=env.width/WIDTH,scaleZ=env.length/LENGTH;
    const landscape=new THREE.Group();landscape.scale.set(scaleX,1,scaleZ);scene.add(landscape);
    scene.fog = new THREE.FogExp2('#acbcb4', .009);
    const camera = new THREE.PerspectiveCamera(49, 1, .1, 260);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .065;
    controls.minDistance = 5; controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * .475;
    controls.target.set(0, .05, 0);
    const resetCamera = () => { camera.position.set(4.2*scaleX, getSettings().kind==='creek'?1.25:2.0, 14.5*scaleZ); controls.target.set(-.2*scaleX, 0, -2.5*scaleZ); controls.update(); };
    resetCamera();
    scene.add(new THREE.HemisphereLight('#dbe8ef', '#536444', .35));
    const sun = new THREE.DirectionalLight('#fff1d1', 1.4);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: .1, far: 100 });
    sun.shadow.bias = -.0005; sun.shadow.normalBias = .08;
    scene.add(sun);
    const sky = new Sky(); sky.scale.setScalar(240);
    const skyUniforms = sky.material.uniforms;
    skyUniforms.turbidity.value = 3.5; skyUniforms.rayleigh.value = 1.4;
    skyUniforms.mieCoefficient.value = .004; skyUniforms.mieDirectionalG.value = .82;
    sky.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );','gl_FragColor = vec4( retColor * 0.28, 1.0 );');};
    scene.add(sky);
    const stopLight=photographicLight(scene,renderer,true,()=>{sky.visible=false;assetReady();},true);

    let seed = 83051;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const terrain = new THREE.PlaneGeometry(110, 280, 250, 660); terrain.rotateX(-Math.PI / 2); terrain.translate(0,0,-60);
    const positions = terrain.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const soil = new THREE.Color(), sand = new THREE.Color('#a9a396'), grass = new THREE.Color('#aaa69a');
    const updateTerrain = (depth: number) => {
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), z = positions.getZ(i), side = Math.abs(x - center(z)) / breadth(z);
            positions.setY(i, terrainHeight(x, z, depth));
            soil.copy(sand).lerp(grass, THREE.MathUtils.smoothstep(side, 1.06, 1.6));
            soil.multiplyScalar(.85 + noise(x * 4, z * 4) * .18);
            soil.toArray(colors, i * 3);
        }
        positions.needsUpdate = true; terrain.computeVertexNormals();
        terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    };
    updateTerrain(getSettings().depth);
    const wind=windState();
    const waterClock={value:0},waterFlow={value:0};
    const surfaceDetail=(material:THREE.MeshStandardMaterial,rock:boolean)=>{
        material.onBeforeCompile=shader=>{
            shader.uniforms.waterClock=waterClock;shader.uniforms.waterFlow=waterFlow;
            shader.vertexShader='varying vec3 detailPosition;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
                vec4 detailP=vec4(transformed,1.0);
                #ifdef USE_INSTANCING
                    detailP=instanceMatrix*detailP;
                #endif
                detailPosition=(modelMatrix*detailP).xyz;`);
            shader.fragmentShader=`varying vec3 detailPosition;uniform float waterClock;uniform float waterFlow;
                float dh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
                float dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
                    return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
                    mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
                `+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
                float mineral=dn(detailPosition*18.0)*.5+dn(detailPosition*59.0)*.3+dn(detailPosition*183.0)*.2;
                float mineralPatch=dn(detailPosition*2.7);
                diffuseColor.rgb*=.62+mineral*.75;
                ${rock?`float vein=pow(1.0-abs(sin(detailPosition.x*19.0+detailPosition.y*23.0+mineralPatch*6.0)),12.0);
                diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.41,.36),vein*.4);
                float moss=smoothstep(.58,.82,mineralPatch)*smoothstep(.03,.25,detailPosition.y);
                diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.13,.035),moss*.65);`:
                `diffuseColor.rgb*=.75+.5*dn(detailPosition*1.2);
                float wet=1.0-smoothstep(.0,.23,detailPosition.y);
                diffuseColor.rgb*=1.0-wet*.24;
                if(detailPosition.y<-.04){
                    vec2 cp=detailPosition.xz-vec2(.11,waterFlow)*waterClock;
                    float c1=sin(cp.x*18.0+sin(cp.y*11.0+waterClock*1.3));
                    float c2=sin(cp.y*21.0+sin(cp.x*9.0-waterClock*1.7));
                    diffuseColor.rgb*=1.0+.3*pow(max(0.0,c1*c2),7.0)*exp(detailPosition.y*.9);
                }`}
            `);
        };
    };
    const groundMaterial=new THREE.MeshStandardMaterial({ vertexColors:true,roughness:.96 });surfaceDetail(groundMaterial,false);
    const groundTextures:THREE.Texture[]=[];
    const groundLoader=new THREE.TextureLoader();
    const loadGround=(url:string,normal:boolean)=>groundLoader.load(url,t=>{if(disposed){t.dispose();return;}t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(45*scaleX,55*scaleZ);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());groundTextures.push(t);
        if(normal){groundMaterial.normalMap=t;groundMaterial.normalScale.set(.65,.65);}else{t.colorSpace=THREE.SRGBColorSpace;groundMaterial.map=t;}
        groundMaterial.needsUpdate=true;assetReady();});
    loadGround('/river/ground.jpg',false);loadGround('/river/ground-normal.jpg',true);
    const ground = new THREE.Mesh(terrain,groundMaterial);
    ground.receiveShadow = true; landscape.add(ground);

    const rockGeometry = mergeVertices(new THREE.IcosahedronGeometry(1, 3));
    const rp = rockGeometry.attributes.position;
    for (let i = 0; i < rp.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(rp, i);
        p.multiplyScalar(1 + noise(p.x * 3, p.z * 3 + p.y) * .1);
        rp.setXYZ(i, p.x, p.y, p.z);
    }
    rockGeometry.computeVertexNormals();
    const mineralCanvas=document.createElement('canvas');mineralCanvas.width=256;mineralCanvas.height=256;
    const mineralContext=mineralCanvas.getContext('2d')!,mineralPixels=mineralContext.createImageData(256,256);
    for(let i=0;i<256*256;i++){const value=155+rand()*85;mineralPixels.data.set([value,value,value,255],i*4);}
    mineralContext.putImageData(mineralPixels,0,0);
    const mineralTexture=new THREE.CanvasTexture(mineralCanvas);mineralTexture.wrapS=mineralTexture.wrapT=THREE.RepeatWrapping;
    mineralTexture.repeat.set(3,3);
    const rockMaterial = new THREE.MeshStandardMaterial({ map:mineralTexture,bumpMap:mineralTexture,bumpScale:.025,roughness: .85, vertexColors: true });
    surfaceDetail(rockMaterial,true);
    const rc = new Float32Array(rp.count * 3);
    for (let i = 0; i < rp.count; i++) {
        const moss = false;
        new THREE.Color(moss ? '#66734c' : '#8b8982').multiplyScalar(.8 + rand() * .35).toArray(rc, i * 3);
    }
    rockGeometry.setAttribute('color', new THREE.BufferAttribute(rc, 3));
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 1050);
    const dummy = new THREE.Object3D();
    const rockSites: { x: number; z: number; size: number; bank: boolean; yaw: number }[] = [];
    for (let i = 0; i < 1050; i++) {
        const z = rand() * 68 - 34, side = rand() * 2 - 1;
        const bank = i < 180;
        const x = center(z) + (bank?(side>0?1:-1):side) * breadth(z) * (bank ? 1.06 + rand() * .55 : .94);
        rockSites.push({ x, z, size: bank ? .2 + rand() * .48 : .055 + rand() * .15, bank, yaw: rand() * 6.28 });
    }
    const updateRocks = (depth: number) => {
        rockSites.forEach((r, i) => {
            dummy.position.set(r.x, terrainHeight(r.x, r.z, depth) + r.size * .2, r.z);
            dummy.scale.set(r.size * 1.35, r.size * .65, r.size);
            dummy.rotation.set(.1, r.yaw, .15); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
        });
        rocks.instanceMatrix.needsUpdate = true;
    };
    updateRocks(getSettings().depth); rocks.receiveShadow = true; rocks.castShadow = true; landscape.add(rocks);
    const obstacleMeshes:THREE.Mesh[]=[];
    obstacles.forEach(o => {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(center(o.z) + o.x * breadth(o.z) / (WIDTH / 2), .04, o.z);
        rock.scale.set(o.r * 1.1, o.r * .8, o.r); rock.rotation.y = rand() * 6;
        rock.castShadow = true; rock.receiveShadow = true; landscape.add(rock);obstacleMeshes.push(rock);
    });
    const scannedSites=rockSites.filter((r,i)=>r.bank||i%4===0);
    const stoneScale=getSettings().kind==='creek'?.6:1;
    const stoneBed=(r:typeof scannedSites[number],depth:number)=>{let bed=terrainHeight(r.x,r.z,depth);for(let j=0;j<8;j++){const angle=j*Math.PI/4;bed=Math.min(bed,terrainHeight(r.x+Math.cos(angle)*r.size*stoneScale*.7/scaleX,r.z+Math.sin(angle)*r.size*stoneScale*.7/scaleZ,depth));}return bed-r.size*stoneScale*.12;};
    const scannedPlacements=scannedSites.map(r=>({x:r.x*scaleX,z:r.z*scaleZ,y:stoneBed(r,getSettings().depth),size:r.size*stoneScale,yaw:r.yaw}));
    obstacles.forEach(o=>scannedPlacements.push({x:(center(o.z)+o.x*breadth(o.z)/(WIDTH/2))*scaleX,z:o.z*scaleZ,y:-o.r*scaleX*.55,size:o.r*scaleX,yaw:rand()*6}));
    const stopRocks=scannedRocks(scene,scannedPlacements,()=>{assetReady();renderer.shadowMap.needsUpdate=true;rocks.visible=false;obstacleMeshes.forEach(r=>r.visible=false);});
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position',new THREE.Float32BufferAttribute([-.01,0,0,.01,0,0,-.007,.12,.01,.007,.12,.01,-.004,.23,.04,.004,.23,.04,.012,.31,.075],3));blade.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);blade.computeVertexNormals();
    const grasses = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), 40000);
    for (let i = 0; i < 40000; i++) {
        const z = rand() * 78 - 39, sign = rand() > .5 ? 1 : -1;
        const x = center(z) + sign * (breadth(z) + .12 + Math.pow(rand(), 2) * 10);
        dummy.position.set(x, terrainHeight(x,z,getSettings().depth) - .015,z);
        dummy.rotation.set(0,rand()*6.28,(rand()-.5)*.3);
        const scale = .3 + rand() * .8; dummy.scale.setScalar(scale); dummy.updateMatrix(); grasses.setMatrixAt(i,dummy.matrix);
        grasses.setColorAt(i,new THREE.Color().setHSL(.22 + rand()*.06,.3,.2+rand()*.14));
    }
    landscape.add(grasses);
    const grassPlacements=Array.from({length:54000},()=>{const z=rand()*78-39,sign=rand()>.5?1:-1,x=center(z)+sign*(breadth(z)+.1+Math.pow(rand(),2)*9);return {x:x*scaleX,z:z*scaleZ,y:terrainHeight(x,z,getSettings().depth)-.008,size:2.6+rand()*2.2,yaw:rand()*6.28};});
    const stopGrass=scannedRocks(scene,grassPlacements,()=>{assetReady();grasses.visible=false;renderer.shadowMap.needsUpdate=true;},'/river/grass/grass.gltf','natural','/river/grass/alpha.jpg',wind);
    const treeSites=Array.from({length:450},()=>{
        const z=rand()*240-180,sign=rand()>.5?1:-1;
        const x=center(z)+sign*(6+Math.pow(rand(),1.6)*27);
        return {x:x*scaleX,y:terrainHeight(x,z,getSettings().depth),z:z*scaleZ,height:7+rand()*8};
    });
    const stopForest=forest(scene,treeSites,()=>{assetReady();renderer.shadowMap.needsUpdate=true;},wind);
    const physics = new RiverPhysics(env.width,env.length);
    const leaves=floatingLeaves(scene,physics,scaleX,scaleZ);
    const heightTexture = new THREE.DataTexture(physics.height,NX,NZ,THREE.RedFormat,THREE.FloatType);
    heightTexture.minFilter=THREE.NearestFilter; heightTexture.magFilter=THREE.NearestFilter;
    heightTexture.needsUpdate=true;
    const reflection = new THREE.WebGLRenderTarget(800,600,{type:THREE.HalfFloatType});
    const refraction = new THREE.WebGLRenderTarget(800,600,{type:THREE.HalfFloatType});
    refraction.depthTexture=new THREE.DepthTexture(800,600,THREE.UnsignedIntType);
    const reflectionCamera = camera.clone();
    const reflectionMatrix=new THREE.Matrix4(),viewProjection=new THREE.Matrix4(),inverseViewProjection=new THREE.Matrix4();
    const uniforms = {
        heights:{value:heightTexture},time:{value:0},wind:{value:1.8},speed:{value:.9},depth:{value:.65},
        reflection:{value:reflection.texture},refraction:{value:refraction.texture},bedDepth:{value:refraction.depthTexture},viewProjection:{value:viewProjection},inverseViewProjection:{value:inverseViewProjection},
        reflectionMatrix:{value:reflectionMatrix},sunDirection:{value:new THREE.Vector3()},
        variability:{value:getSettings().variability},realization:{value:getSettings().realization%10000},longWave:{value:new THREE.Vector4()},clarity:{value:.8},domainScale:{value:new THREE.Vector2(scaleX,scaleZ)},
    };
    const waterGeometry=new THREE.PlaneGeometry(WIDTH,220,180,1400);
    const wp=waterGeometry.attributes.position;
    for (let i=0;i<wp.count;i++) {
        const u=waterGeometry.attributes.uv.getX(i), v=waterGeometry.attributes.uv.getY(i);
        const z=(v-.5)*220-70;
        waterGeometry.attributes.uv.setY(i,z/LENGTH+.5);
        wp.setXYZ(i,center(z)+(u-.5)*2*breadth(z),0,z);
    }
    waterGeometry.computeVertexNormals();
    const water=new THREE.Mesh(waterGeometry,new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,side:THREE.DoubleSide}));
    landscape.add(water);
    const arrows=new THREE.Group();
    for(let i=0;i<12;i++){
        const z=(Math.floor(i/3)-1.5)*7,x=((i%3)-1)*2+center(z);
        arrows.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(x,.3,z),1.8,'#dce8c3',.35,.15));
    }landscape.add(arrows);
    const resize = () => {
        const w=host.clientWidth,h=host.clientHeight;
        renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
        const factor=Math.min(1,1100/w);
        reflection.setSize(Math.round(w*factor),Math.round(h*factor)); refraction.setSize(Math.round(w*factor),Math.round(h*factor));
    };
    const observer=new ResizeObserver(resize); observer.observe(host); resize();
    const raycaster=new THREE.Raycaster();
    const pointer=new THREE.Vector2();
    let downX=0,downY=0;
    const onDown=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY;};
    const onUp=(e:PointerEvent)=>{
        if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)return;
        const rect=renderer.domElement.getBoundingClientRect();
        pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
        raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
        if(hit){const x=hit.x/scaleX,z=hit.z/scaleZ;
            if(Math.abs(z)<LENGTH/2&&Math.abs(x-center(z))<breadth(z)){
                physics.splash((x-center(z))/breadth(z)*env.width/2,hit.z);heightTexture.needsUpdate=true;
            }}
    };
    renderer.domElement.addEventListener('pointerdown',onDown); renderer.domElement.addEventListener('pointerup',onUp);
    const clipping=[new THREE.Plane(new THREE.Vector3(0,1,0),-.025)];
    const look=new THREE.Vector3(),target=new THREE.Vector3();
    let lastShadowSun=-1,lastWindShadow=0,lastWindKey='';
    let previous=performance.now(),simulationTime=0,lastDepth=getSettings().depth,lastWake=0,ready=false,frame=0,disposed=false;
    function render(now:number) {
        if(disposed)return;
        frame=requestAnimationFrame(render);
        const delta=Math.min((now-previous)/1000,.05); previous=now;
        const settings=getSettings();
        if(Math.abs(settings.depth-lastDepth)>.001) { lastDepth=settings.depth; updateTerrain(lastDepth);updateRocks(lastDepth);scannedSites.forEach((r,i)=>{scannedPlacements[i].y=stoneBed(r,lastDepth);});stopRocks.update();renderer.shadowMap.needsUpdate=true; }
        if(document.hidden)return;
        if(settings.playing) {
            const duration=delta*settings.timeScale;
            simulationTime+=duration;
            const substeps=Math.max(1,Math.ceil(duration/.05));
            for(let i=0;i<substeps;i++)physics.advance(duration/substeps,settings);
            if(simulationTime-lastWake>.4){
                lastWake=simulationTime;
                obstacles.forEach((o,i)=>physics.splash((o.x+Math.sin(simulationTime*3+i)*o.r*.65)*scaleX,(o.z+o.r*1.5)*scaleZ,.008*currentSpeed(settings)));
            }
            heightTexture.needsUpdate=true;
        }
        leaves.update(settings.playing?delta*settings.timeScale:0,simulationTime,settings);
        wind.time.value=simulationTime;wind.speed.value=settings.wind;wind.direction.value.set(Math.sin(settings.direction*Math.PI/180),Math.cos(settings.direction*Math.PI/180));
        const windKey=`${settings.wind}:${settings.direction}`;if(windKey!==lastWindKey){lastWindKey=windKey;renderer.shadowMap.needsUpdate=true;}
        if(settings.playing&&settings.wind>.5&&now-lastWindShadow>160){lastWindShadow=now;renderer.shadowMap.needsUpdate=true;}
        controls.update();waterClock.value=simulationTime;waterFlow.value=currentSpeed(settings);
        const sunDirection=uniforms.sunDirection.value;
        const elevation=settings.sun*Math.PI/180;
        sunDirection.set(-.65*Math.cos(elevation),Math.sin(elevation),-.76*Math.cos(elevation)).normalize();
        if(lastShadowSun!==settings.sun){lastShadowSun=settings.sun;renderer.shadowMap.needsUpdate=true;}sun.position.copy(sunDirection).multiplyScalar(45);skyUniforms.sunPosition.value.copy(sunDirection);
        uniforms.time.value=simulationTime; uniforms.wind.value=settings.wind;uniforms.speed.value=currentSpeed(settings); uniforms.depth.value=settings.depth;
        const k=waveNumber(settings.period,settings.depth);
        uniforms.longWave.value.set(k,2*Math.PI/settings.period,settings.waveHeight*.5,settings.direction*Math.PI/180);
        uniforms.variability.value=settings.variability;uniforms.realization.value=settings.realization%10000;uniforms.clarity.value=settings.clarity;
        (water.material as THREE.ShaderMaterial).wireframe=settings.wireframe;arrows.visible=settings.vectors;
        camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);inverseViewProjection.copy(viewProjection).invert(); camera.getWorldDirection(look);
        reflectionCamera.position.copy(camera.position); reflectionCamera.position.y*=-1;
        target.copy(camera.position).add(look);target.y*=-1;
        reflectionCamera.up.set(0,-1,0); reflectionCamera.lookAt(target);
        reflectionCamera.projectionMatrix.copy(camera.projectionMatrix);reflectionCamera.updateMatrixWorld();
        reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
        water.visible=false;
        renderer.clippingPlanes=clipping;renderer.setRenderTarget(reflection); renderer.render(scene,reflectionCamera);
        renderer.clippingPlanes=[];renderer.setRenderTarget(refraction);renderer.render(scene,camera);
        water.visible=true; renderer.setRenderTarget(null);renderer.render(scene,camera);
        if(!ready&&loadedAssets>=6){ ready=true;onReady(); }
    }
    frame=requestAnimationFrame(render);
    return {
        resetCamera,
        setView:(view)=>{resetCamera();if(view==='overview')camera.position.set(scaleX,29,18*scaleZ);else camera.position.set(3.5*scaleX,1.4,12*scaleZ);controls.update();},
        reset:()=>{resetCamera();physics.reset();simulationTime=0;lastWake=0;heightTexture.needsUpdate=true;},
        disturb:()=>{physics.splash(0,0);heightTexture.needsUpdate=true;},
        screenshot:()=>downloadCanvas(renderer.domElement,`水流模拟-${getSettings().kind==='creek'?'小溪':'小河'}.png`),
        dispose:()=>{
            disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
            renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);
            const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
            scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
            geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());sun.shadow.dispose();
            leaves.dispose();stopForest();stopGrass();groundTextures.forEach(t=>t.dispose());mineralTexture.dispose();stopLight();stopRocks();heightTexture.dispose();reflection.dispose();refraction.depthTexture.dispose();refraction.dispose();renderer.dispose();renderer.domElement.remove();
        },
    };
}
