import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildSpectrum, currentSpeed, environment, sampleSurface, type SimulationSettings } from './system';
import { spectralVertex, spectralFragment } from './spectralShaders';
import { SpectralOcean } from './SpectralOcean';
import { photographicLight } from './photographicLight';
import { forest, type TreeSite } from './forest';
import { windState } from './wind';
import { downloadCanvas } from './capture';
import type { RiverScene } from './scene';

export function createOpenScene(host: HTMLDivElement, getSettings:()=>SimulationSettings,onReady:()=>void): RiverScene {
    const initial=getSettings(), env=environment(initial.kind), isSea=initial.kind==='ocean'||initial.kind==='storm';
    const isStorm=initial.kind==='storm', isRiver=initial.kind==='great-river';
    const domain=new THREE.Vector2(env.width,env.length);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=isStorm?.82:1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=!isSea;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    host.appendChild(renderer.domElement);
    let loadedAssets=0;const assetReady=()=>{loadedAssets++;};
    const wind=windState();let lastWindShadow=0,lastWindKey='';
    const scene=new THREE.Scene(), haze=new THREE.Color(isStorm?'#566974':'#a3bfca');
    scene.fog=new THREE.FogExp2(haze,isSea?.0005:.00055);
    const sky=new Sky();sky.scale.setScalar(12000);scene.add(sky);
    if(isStorm)sky.visible=false;
    sky.material.uniforms.turbidity.value=isStorm?12:4;
    sky.material.uniforms.rayleigh.value=isStorm?.7:1.6;
    sky.material.uniforms.mieCoefficient.value=isStorm?.025:.004;
    sky.material.uniforms.mieDirectionalG.value=.84;
    sky.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );','gl_FragColor = vec4( retColor * 0.28, 1.0 );');};
    const stormSkyMaterial=new THREE.ShaderMaterial({
        side:THREE.BackSide,depthWrite:false,uniforms:{sun:{value:new THREE.Vector3(-.6,.3,-.7)}},
        vertexShader:`varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);}`,
        fragmentShader:`uniform vec3 sun;varying vec3 ray;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){vec3 d=normalize(ray);vec2 p=d.xz/max(d.y,.12)*1.6;float cloud=noise(p)*.55+noise(p*2.1)*.3+noise(p*4.3)*.15;
        vec3 color=mix(vec3(.07,.105,.15),vec3(.37,.46,.51),pow(1.-max(d.y,0.),3.));
        color+=vec3(.13,.15,.17)*smoothstep(.25,.8,cloud)*smoothstep(.02,.22,d.y);
        color+=vec3(.38,.32,.24)*pow(max(dot(d,sun),0.),16.)*.25;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    const stormSky=new THREE.Mesh(new THREE.SphereGeometry(12000,32,20),stormSkyMaterial);stormSky.visible=isStorm;scene.add(stormSky);
    const light=new THREE.DirectionalLight('#fff3df',isStorm?1.5:1.4);light.castShadow=!isSea;light.shadow.mapSize.set(4096,4096);Object.assign(light.shadow.camera,{left:-650,right:650,top:650,bottom:-650,near:1,far:2400});light.shadow.normalBias=.35;light.shadow.bias=-.0001;scene.add(light);
    scene.add(new THREE.HemisphereLight('#cedee5','#4d624c',.45));
    const camera=new THREE.PerspectiveCamera(52,1,.3,22000);
    const landscapeReflection=new THREE.WebGLRenderTarget(1024,576,{type:THREE.HalfFloatType});
    const landscapeCamera=camera.clone(),landscapeMatrix=new THREE.Matrix4(),reflectedLook=new THREE.Vector3(),reflectedTarget=new THREE.Vector3();
    const landscapeClip=[new THREE.Plane(new THREE.Vector3(0,1,0),-.02)];
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.055;
    controls.minDistance=isStorm?18:isSea?8:15;controls.maxDistance=isSea?1500:900;
    controls.maxPolarAngle=Math.PI*.487;controls.enablePan=true;
    const resetCamera=()=>{
        if(isStorm){camera.position.set(35,4,65);controls.target.set(0,0,-120);}
        else if(isSea){camera.position.set(35,12,78);controls.target.set(0,0,-70);}
        else if(isRiver){camera.position.set(45,5,170);controls.target.set(-15,0,-150);}
        else {camera.position.set(80,4,180);controls.target.set(0,0,-90);}
        controls.update();
    };resetCamera();
    let seed=918734;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    let updateBed:((depth:number)=>void)|null=null;
    let stopForest:(()=>void)|null=null;
    const landTextures:THREE.Texture[]=[];
    if(!isSea){
        const sizeX=isRiver?900:1600,sizeZ=isRiver?2200:1500;
        const geometry=new THREE.PlaneGeometry(sizeX,sizeZ,140,140);geometry.rotateX(-Math.PI/2);
        const terrainNoise=(x:number,z:number)=>{const hash=(a:number,b:number)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,fx=u*u*(3-2*u),fz=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),fx),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),fx),fz);};
        const landHeight=(x:number,z:number,edge:number)=>{const distance=Math.max(0,edge-1)*(isRiver?env.width/2:Math.min(env.width,env.length)/2);const fade=1-Math.exp(-distance/28);const macro=terrainNoise(x*.007,z*.007)*.55+terrainNoise(x*.018+13,z*.018-7)*.3+terrainNoise(x*.049,z*.049)*.15;return distance*.035+fade*(5+70*Math.pow(macro,1.6))+fade*terrainNoise(x*.13,z*.13)*2;};
        const pos=geometry.attributes.position,col=new Float32Array(pos.count*3),color=new THREE.Color();
        for(let i=0;i<pos.count;i++){
            const x=pos.getX(i),z=pos.getZ(i);
            const edge=isRiver?Math.abs(x-Math.sin(z*.004)*28)/(env.width/2):Math.hypot(x/(env.width/2),z/(env.length/2));
            const h=edge<1?-initial.depth*(1-edge*edge*.9):landHeight(x,z,edge);
            pos.setY(i,h);
            color.set(edge<1.08?'#999a7c':'#a4ad91');color.multiplyScalar(.8+random()*.3);color.toArray(col,i*3);
        }
        geometry.computeVertexNormals();geometry.setAttribute('color',new THREE.BufferAttribute(col,3));
        const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
        const landLoader=new THREE.TextureLoader();
        const landTexture=(url:string,normal:boolean)=>landLoader.load(url,t=>{if(disposed){t.dispose();return;}landTextures.push(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(sizeX/3,sizeZ/3);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(normal){material.normalMap=t;material.normalScale.set(.16,.16);}else{t.colorSpace=THREE.SRGBColorSpace;material.map=t;}material.needsUpdate=true;assetReady();});
        landTexture('/river/ground.jpg',false);landTexture('/river/ground-normal.jpg',true);
        const rockTexture={value:null as THREE.Texture|null};landLoader.load('/river/rock/textures/rock_moss_set_01_diff_2k.jpg',t=>{if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;rockTexture.value=t;landTextures.push(t);assetReady();});
        material.onBeforeCompile=shader=>{shader.uniforms.landRock=rockTexture;shader.vertexShader='varying vec3 landPosition;varying vec3 landNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlandPosition=position;landNormal=normal;');shader.fragmentShader='varying vec3 landPosition;varying vec3 landNormal;uniform sampler2D landRock;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
            #ifdef USE_MAP
            vec2 scanUv=landPosition.xz/3.;
            vec3 floorA=texture2D(map,scanUv).rgb,floorB=texture2D(map,mat2(.8,.6,-.6,.8)*scanUv+vec2(.31,.67)).rgb;
            diffuseColor.rgb*=mix(floorA,floorB,.45);
            #endif
            float slope=1.-abs(normalize(landNormal).y);vec3 mineral=texture2D(landRock,landPosition.xz*.2).rgb;
            diffuseColor.rgb=mix(diffuseColor.rgb,mineral*.7,smoothstep(.16,.55,slope));
            float terrainVariation=.85+.15*sin(landPosition.x*.06+sin(landPosition.z*.033)*2.);
            diffuseColor.rgb*=terrainVariation;`);};
        updateBed=(depth)=>{
            for(let i=0;i<pos.count;i++){
                const x=pos.getX(i),z=pos.getZ(i);
                const edge=isRiver?Math.abs(x-Math.sin(z*.004)*28)/(env.width/2):Math.hypot(x/(env.width/2),z/(env.length/2));
                if(edge<1)pos.setY(i,-depth*(1-edge*edge*.9));
            }pos.needsUpdate=true;geometry.computeVertexNormals();
        };
        const landMesh=new THREE.Mesh(geometry,material);landMesh.receiveShadow=true;landMesh.castShadow=true;scene.add(landMesh);
        const treeSites:TreeSite[]=[];
        for(let i=0;i<1600;i++){
            const angle=random()*Math.PI*2,r=1.015+Math.pow(random(),1.6)*.5;
            let x=Math.sin(angle)*env.width*.5*r,z=Math.cos(angle)*env.length*.5*r;
            if(isRiver){z=(random()-.5)*1600;x=(random()>.5?1:-1)*(env.width*.5+6+random()*170)+Math.sin(z*.004)*28;}
            const edge=isRiver?Math.abs(x-Math.sin(z*.004)*28)/(env.width/2):Math.hypot(x/(env.width/2),z/(env.length/2));
            const y=landHeight(x,z,edge);
            treeSites.push({x,y,z,height:12+random()*14});
        }
        stopForest=forest(scene,treeSites,()=>{assetReady();renderer.shadowMap.needsUpdate=true;},wind);
    }
    const cubeTarget=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
    const cubeCamera=new THREE.CubeCamera(1,21000,cubeTarget);cubeCamera.position.set(0,3,0);scene.add(cubeCamera);
    let spectrum=buildSpectrum(initial),spectrumKey='';
    const uniforms={
        waveShape:{value:spectrum.map(w=>new THREE.Vector4(w.dx,w.dz,w.k,w.amplitude))},
        waveMotion:{value:spectrum.map(w=>new THREE.Vector4(w.omega,w.phase,w.horizontal,0))},
        time:{value:0},current:{value:currentSpeed(initial)},depth:{value:initial.depth},
        domain:{value:domain},kind:{value:isSea?2:isRiver?1:0},
        environmentMap:{value:cubeTarget.texture},sunDirection:{value:new THREE.Vector3()},
        haze:{value:haze},waterColor:{value:new THREE.Color(isRiver?'#455e43':isStorm?'#173b47':isSea?'#075065':'#18575a')},
        roughness:{value:isStorm?.8:.25},heightScale:{value:initial.waveHeight},clarity:{value:initial.clarity},wind:{value:initial.wind},windDirection:{value:new THREE.Vector2(Math.sin(initial.direction*Math.PI/180),Math.cos(initial.direction*Math.PI/180))},variability:{value:initial.variability},realization:{value:initial.realization%10000},
        foamMap:{value:null as THREE.Texture|null},foamDomain:{value:new THREE.Vector2(isSea?2200:env.width,isSea?2200:env.length)},
        wire:{value:0},impulse:{value:new THREE.Vector4(0,0,-100,0)},
    };
    const spectral=new SpectralOcean(renderer,initial);
    spectral.update(0,0,initial);spectral.readSurface(0);
    host.dataset.waveValidation=spectral.verify(0,initial)?'passed':'failed';
    Object.assign(uniforms,{
        band0:{value:spectral.maps[0]},band1:{value:spectral.maps[1]},band2:{value:spectral.maps[2]},bandLengths:{value:spectral.lengths},
        landscapeReflection:{value:landscapeReflection.texture},landscapeMatrix:{value:landscapeMatrix},hasLandscape:{value:isSea?0:1},skyMap:{value:null as THREE.Texture|null},skyReady:{value:0},storm:{value:isStorm?1:0},
        previousScene:{value:null as THREE.Texture|null},previousViewProjection:{value:new THREE.Matrix4()},viewport:{value:new THREE.Vector2()},
    });
    const waterUniforms=uniforms as typeof uniforms & {band0:{value:THREE.Texture};band1:{value:THREE.Texture};band2:{value:THREE.Texture};skyMap:{value:THREE.Texture|null};skyReady:{value:number};previousScene:{value:THREE.Texture|null};previousViewProjection:{value:THREE.Matrix4};viewport:{value:THREE.Vector2}};
    const stopLight=photographicLight(scene,renderer,false,texture=>{assetReady();waterUniforms.skyMap.value=texture;waterUniforms.skyReady.value=1;sky.visible=false;stormSky.visible=false;});
    let frameRead=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true}),frameWrite=frameRead.clone();
    const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const postMaterial=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{frame:{value:frameWrite.texture},resolution:{value:new THREE.Vector2()},time:{value:0}},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`uniform sampler2D frame;uniform vec2 resolution;uniform float time;varying vec2 vUv;
        void main(){vec3 color=texture2D(frame,vUv).rgb;
        // Subtle lens falloff; HDR tone mapping happens once, after all water and sky passes.
        color*=1.-.12*pow(length(vUv-.5)*1.2,2.);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`});
    const postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial);postScene.add(postQuad);
    const size=isSea?2200:env.width;
    const geometry=new THREE.PlaneGeometry(size,isSea?2200:env.length,isSea?640:400,isSea?640:360);geometry.rotateX(-Math.PI/2);
    if(isSea){
        // Concentrate actual geometry near the observer: ~1 m cells in the central 200 m.
        const p=geometry.attributes.position;
        const warp=(v:number)=>Math.sign(v)*1100*(.18*Math.abs(v/1100)+.82*Math.pow(Math.abs(v/1100),3));
        for(let i=0;i<p.count;i++){p.setX(i,warp(p.getX(i)));p.setZ(i,warp(p.getZ(i)));}
        geometry.computeVertexNormals();
    }
    const material=new THREE.ShaderMaterial({uniforms,vertexShader:spectralVertex,fragmentShader:spectralFragment,side:THREE.DoubleSide});
    const water=new THREE.Mesh(geometry,material);water.frustumCulled=false;scene.add(water);
    // Low-resolution far field shares phases exactly with the detailed inner patch.
    let farWater:THREE.Mesh|null=null;
    if(isSea){
        const inner=1100,outer=7000,rings=28,edgeSegments=400;
        const farPositions:number[]=[],farIndices:number[]=[];
        const boundary:THREE.Vector2[]=[];
        for(let side=0;side<4;side++)for(let j=0;j<edgeSegments;j++){
            const raw=j/edgeSegments*2-1,t=Math.sign(raw)*(.18*Math.abs(raw)+.82*Math.pow(Math.abs(raw),3));
            boundary.push(side===0?new THREE.Vector2(t,1):side===1?new THREE.Vector2(1,-t):side===2?new THREE.Vector2(-t,-1):new THREE.Vector2(-1,t));
        }
        for(let r=0;r<=rings;r++){
            const distance=inner+(outer-inner)*Math.pow(r/rings,1.65);
            boundary.forEach(p=>farPositions.push(p.x*distance,0,p.y*distance));
        }
        const n=boundary.length;
        for(let r=0;r<rings;r++)for(let i=0;i<n;i++){
            const next=(i+1)%n,a=r*n+i,b=r*n+next,c=(r+1)*n+i,d=(r+1)*n+next;
            farIndices.push(a,c,b,b,c,d);
        }
        const farGeometry=new THREE.BufferGeometry();farGeometry.setAttribute('position',new THREE.Float32BufferAttribute(farPositions,3));farGeometry.setIndex(farIndices);farGeometry.computeVertexNormals();
        farWater=new THREE.Mesh(farGeometry,material);farWater.frustumCulled=false;scene.add(farWater);
    }
    const buoy=new THREE.Group(),buoyScale=isStorm?2:1;
    const red=new THREE.MeshStandardMaterial({color:'#d76743',roughness:.5}),white=new THREE.MeshStandardMaterial({color:'#e8e9d7',roughness:.6});
    const hull=new THREE.Mesh(new THREE.CylinderGeometry(.65,1.05,1.4,20),red);hull.position.y=.25;buoy.add(hull);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.6,10),white);mast.position.y=1.9;buoy.add(mast);
    const top=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),red);top.position.y=3.2;buoy.add(top);
    buoy.scale.setScalar(buoyScale);scene.add(buoy);
    // Ballistic spray is emitted only from compressing positive crests. Water volume is not solved.
    const sprayCount=2400,sprayPositions=new Float32Array(sprayCount*3),sprayLife=new Float32Array(sprayCount);
    const sprayVelocity=new Float32Array(sprayCount*3),sprayAge=new Float32Array(sprayCount),sprayDuration=new Float32Array(sprayCount);
    const sprayGeometry=new THREE.BufferGeometry();
    sprayGeometry.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3).setUsage(THREE.DynamicDrawUsage));
    sprayGeometry.setAttribute('life',new THREE.BufferAttribute(sprayLife,1).setUsage(THREE.DynamicDrawUsage));
    const sprayMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{haze:{value:haze},pixelHeight:{value:host.clientHeight*renderer.getPixelRatio()}},
        vertexShader:`attribute float life;uniform float pixelHeight;varying float fade;varying float distanceToEye;
        void main(){vec4 p=modelViewMatrix*vec4(position,1.);distanceToEye=-p.z;fade=life;
        gl_Position=projectionMatrix*p;gl_PointSize=life>0.?clamp(pixelHeight*.10/max(1.,-p.z),1.,14.):0.;}`,
        fragmentShader:`uniform vec3 haze;varying float fade;varying float distanceToEye;
        void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        vec3 color=mix(vec3(.62,.68,.68),haze,1.-exp(-distanceToEye*.0005));
        gl_FragColor=vec4(color,(1.-r*r)*fade*.4);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`});
    const spray=new THREE.Points(sprayGeometry,sprayMaterial);spray.frustumCulled=false;scene.add(spray);
    let sprayCursor=0,sprayBudget=0;
    const updateSpray=(dt:number,s:SimulationSettings)=>{
        spray.visible=isSea&&s.wind>8&&s.waveHeight>.2;
        for(let i=0;i<sprayCount;i++){
            if(sprayDuration[i]<=0)continue;
            sprayAge[i]+=dt;const remaining=1-sprayAge[i]/sprayDuration[i];
            if(remaining<=0){sprayLife[i]=0;sprayDuration[i]=0;continue;}
            sprayVelocity[i*3]+=Math.sin(s.direction*Math.PI/180)*s.wind*.12*dt;
            sprayVelocity[i*3+2]+=Math.cos(s.direction*Math.PI/180)*s.wind*.12*dt;
            sprayVelocity[i*3+1]-=9.81*dt;
            for(let j=0;j<3;j++)sprayPositions[i*3+j]+=sprayVelocity[i*3+j]*dt;
            sprayLife[i]=Math.sin(Math.PI*(1-remaining))*.8;
        }
        if(spray.visible){
            sprayBudget+=dt*180;
            while(sprayBudget>=1){
                sprayBudget--;
                const x=camera.position.x+(random()-.5)*180,z=camera.position.z-30-random()*180;
                const surface=spectral.sample(x,z,time,s);
                if(surface.jacobian>.87||surface.height<s.waveHeight*.15)continue;
                for(let n=0;n<5;n++){
                    const i=sprayCursor++%sprayCount;
                    sprayPositions.set([x+surface.dx+(random()-.5)*2,surface.height+.15,z+surface.dz+(random()-.5)*2],i*3);
                    const {vx,vz}=surface;
                    sprayVelocity.set([vx+(random()-.5)*2,Math.max(0,surface.vy)+2+random()*s.wind*.18,vz+(random()-.5)*2],i*3);
                    sprayAge[i]=0;sprayDuration[i]=.45+random()*.9;sprayLife[i]=.05;
                }
            }
        }
        sprayGeometry.attributes.position.needsUpdate=true;sprayGeometry.attributes.life.needsUpdate=true;
    };
    const arrows=new THREE.Group();
    for(let i=0;i<12;i++){
        const x=((i%4)-1.5)*(isSea?35:env.width*.17),z=(Math.floor(i/4)-1)*45;
        const dir=new THREE.Vector3(isRiver?0:Math.sin(initial.direction*Math.PI/180),0,isRiver?1:Math.cos(initial.direction*Math.PI/180));
        const arrow=new THREE.ArrowHelper(dir,new THREE.Vector3(x,1,z),12,'#d7e6c8',3,1.6);arrows.add(arrow);
    }scene.add(arrows);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);frameRead.setSize(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());frameWrite.setSize(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());waterUniforms.viewport.value.set(w,h);postMaterial.uniforms.resolution.value.set(w,h);sprayMaterial.uniforms.pixelHeight.value=h*renderer.getPixelRatio();camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let diagnosticsAt=0,diagnosticFrames=0;
    let time=0,previous=performance.now(),frame=0,disposed=false,ready=false,lastSun=-1,lastDepth=initial.depth;
    const raycaster=new THREE.Raycaster();let downX=0,downY=0;
    const down=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY;};
    const splashAt=(x:number,z:number)=>{uniforms.impulse.value.set(x,z,time,.4*Math.min(getSettings().depth,4));};
    const up=(e:PointerEvent)=>{
        if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)return;
        const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
        const hit=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
        if(hit){const inside=isSea||(isRiver?Math.abs(hit.x-Math.sin(hit.z*.004)*28)<env.width/2:Math.hypot(hit.x/(env.width/2),hit.z/(env.length/2))<1);if(inside)splashAt(hit.x,hit.z);}
    };renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    function render(now:number){
        if(disposed)return;frame=requestAnimationFrame(render);
        const delta=Math.min((now-previous)/1000,.05);previous=now;if(document.hidden)return;
        const s=getSettings();wind.time.value=time;wind.speed.value=s.wind;wind.direction.value.set(Math.sin(s.direction*Math.PI/180),Math.cos(s.direction*Math.PI/180));const windKey=`${s.wind}:${s.direction}`;if(windKey!==lastWindKey){lastWindKey=windKey;renderer.shadowMap.needsUpdate=true;}if(!isSea&&s.playing&&s.wind>.5&&now-lastWindShadow>250){lastWindShadow=now;renderer.shadowMap.needsUpdate=true;}if(s.depth!==lastDepth){lastDepth=s.depth;updateBed?.(s.depth);renderer.shadowMap.needsUpdate=true;}if(s.playing)time+=delta*s.timeScale;
        const key=[s.waveHeight,s.period,s.direction,s.choppiness,s.depth,s.wind,s.variability,s.realization].join(':');
        if(key!==spectrumKey){
            // No last-state foam, spray, impulses or reflection survives a sea-state change.
            sprayDuration.fill(0);sprayLife.fill(0);sprayGeometry.attributes.life.needsUpdate=true;uniforms.impulse.value.z=-100;
            const savedClear=renderer.getClearColor(new THREE.Color()),savedAlpha=renderer.getClearAlpha();renderer.setClearColor(0,0);
            for(const target of [frameRead,frameWrite]){renderer.setRenderTarget(target);renderer.clear();}
            renderer.setRenderTarget(null);renderer.setClearColor(savedClear,savedAlpha);
            spectrumKey=key;spectrum=buildSpectrum(s);spectrum.forEach((w,i)=>{uniforms.waveShape.value[i].set(w.dx,w.dz,w.k,w.amplitude);uniforms.waveMotion.value[i].set(w.omega,w.phase,w.horizontal,0);});}
        renderer.domElement.dataset.simulationTime=time.toFixed(4);uniforms.time.value=time;uniforms.current.value=currentSpeed(s);uniforms.depth.value=s.depth;
        uniforms.windDirection.value.set(Math.sin(s.direction*Math.PI/180),Math.cos(s.direction*Math.PI/180));uniforms.variability.value=s.variability;uniforms.realization.value=s.realization%10000;uniforms.heightScale.value=s.waveHeight;uniforms.wind.value=s.wind;uniforms.clarity.value=s.clarity;
        material.wireframe=s.wireframe;arrows.visible=s.vectors;
        arrows.children.forEach(arrow=>{(arrow as THREE.ArrowHelper).setDirection(new THREE.Vector3(isRiver?0:Math.sin(s.direction*Math.PI/180),0,isRiver?1:Math.cos(s.direction*Math.PI/180)));arrow.position.y=s.waveHeight*.6+1;});
        spectral.update(time,s.playing?delta*s.timeScale:0,s);spectral.readSurface(time);
        diagnosticFrames++;if(now-diagnosticsAt>1000){renderer.domElement.dataset.fps=String((diagnosticFrames*1000/(now-diagnosticsAt)).toFixed(1));diagnosticsAt=now;diagnosticFrames=0;renderer.domElement.dataset.spectral=JSON.stringify(spectral.statistics());}
        waterUniforms.band0.value=spectral.maps[0];waterUniforms.band1.value=spectral.maps[1];waterUniforms.band2.value=spectral.maps[2];
        const sample=spectral.sample(-18,35,time,s);
        buoy.position.set(-18+sample.dx,sample.height,35+sample.dz);
        const sx=spectral.sample(-17,35,time,s).height-sample.height;
        const sz=spectral.sample(-18,36,time,s).height-sample.height;
        buoy.rotation.set(Math.atan(sz),0,-Math.atan(sx));
        controls.update();
        const eyeHeight=spectral.sample(camera.position.x,camera.position.z,time,s).height;
        // Apply wave clearance only for rendering; restore the orbit eye afterwards.
        // Otherwise every crest permanently raises the camera and erases the sense of scale.
        const orbitEyeY=camera.position.y;
        camera.position.y=Math.max(orbitEyeY,eyeHeight+1.5);
        if(lastSun!==s.sun){
            lastSun=s.sun;renderer.shadowMap.needsUpdate=true;const angle=s.sun*Math.PI/180;
            uniforms.sunDirection.value.set(-Math.cos(angle)*.65,Math.sin(angle),-Math.cos(angle)*.76).normalize();
            stormSkyMaterial.uniforms.sun.value.copy(uniforms.sunDirection.value);
            sky.material.uniforms.sunPosition.value.copy(uniforms.sunDirection.value);light.position.copy(uniforms.sunDirection.value).multiplyScalar(1000);
            water.visible=false;if(farWater)farWater.visible=false;buoy.visible=false;arrows.visible=false;spray.visible=false;
            if(!waterUniforms.skyReady.value)cubeCamera.update(renderer,scene);water.visible=true;if(farWater)farWater.visible=true;buoy.visible=true;arrows.visible=s.vectors;
        }
        updateSpray(s.playing?delta*s.timeScale:0,s);
        if(!isSea){
            camera.updateMatrixWorld();camera.getWorldDirection(reflectedLook);
            landscapeCamera.position.copy(camera.position);landscapeCamera.position.y*=-1;
            reflectedTarget.copy(camera.position).add(reflectedLook);reflectedTarget.y*=-1;
            landscapeCamera.up.set(0,-1,0);landscapeCamera.lookAt(reflectedTarget);landscapeCamera.projectionMatrix.copy(camera.projectionMatrix);landscapeCamera.updateMatrixWorld();
            landscapeMatrix.multiplyMatrices(landscapeCamera.projectionMatrix,landscapeCamera.matrixWorldInverse);
            water.visible=false;buoy.visible=false;arrows.visible=false;renderer.clippingPlanes=landscapeClip;
            renderer.setRenderTarget(landscapeReflection);renderer.render(scene,landscapeCamera);renderer.clippingPlanes=[];
            water.visible=true;buoy.visible=true;arrows.visible=s.vectors;
        }
        waterUniforms.previousScene.value=frameRead.texture;
        camera.updateMatrixWorld();
        renderer.setRenderTarget(frameWrite);renderer.render(scene,camera);renderer.setRenderTarget(null);
        postMaterial.uniforms.frame.value=frameWrite.texture;postMaterial.uniforms.time.value=time;
        renderer.render(postScene,postCamera);
        waterUniforms.previousViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        [frameRead,frameWrite]=[frameWrite,frameRead];camera.position.y=orbitEyeY;if(!ready&&loadedAssets>=(isSea?1:5)){ready=true;onReady();}
    }frame=requestAnimationFrame(render);
    return {
        resetCamera,
        setView:(view)=>{resetCamera();if(view==='overview'){camera.position.y=isSea?350:240;camera.position.z=isSea?420:330;}else{camera.position.y=isStorm?2:isSea?2.5:1.5;}controls.update();},
        reset:()=>{time=0;sprayDuration.fill(0);sprayLife.fill(0);sprayGeometry.attributes.life.needsUpdate=true;uniforms.impulse.value.z=-100;spectral.reset();resetCamera();},
        disturb:()=>splashAt(0,0),
        screenshot:()=>downloadCanvas(renderer.domElement,`水流模拟-${env.name}.png`),
        dispose:()=>{
            disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
            renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);
            const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
            scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
            geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());stopForest?.();landTextures.forEach(t=>t.dispose());spectral.dispose();stopLight();frameRead.dispose();frameWrite.dispose();postQuad.geometry.dispose();postMaterial.dispose();cubeTarget.dispose();landscapeReflection.dispose();renderer.dispose();renderer.domElement.remove();
        },
    };
}
