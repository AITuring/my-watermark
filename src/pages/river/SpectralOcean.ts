import * as THREE from 'three';
import { createSpectralBands, type SpectralBand } from './spectralMath';
import { currentSpeed, type SimulationSettings } from './system';
const vertex=`precision highp float;in vec3 position;in vec2 uv;out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0,1);}`;
const declarations=`precision highp float;precision highp sampler2D;in vec2 vUv;layout(location=0)out vec4 field0;layout(location=1)out vec4 field1;`;
const evolve=`${declarations}
uniform sampler2D seed;uniform float size;uniform float lengthScale;uniform float time;uniform float depth;uniform float current;
vec2 cm(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
void main(){vec2 index=floor(vUv*size);vec2 k=(index-step(vec2(size*.5),index)*size)*6.28318530718/lengthScale;
float kl=length(k);if(kl<.00001){field0=vec4(0);field1=vec4(0);return;}
vec4 h0=texture(seed,vUv);float omega=sqrt((9.81*kl+.000074*kl*kl*kl)*tanh(kl*depth));
vec2 h=cm(h0.xy,vec2(cos(omega*time),-sin(omega*time)))+cm(h0.zw,vec2(cos(omega*time),sin(omega*time)));
h=cm(h,vec2(cos(k.y*current*time),-sin(k.y*current*time)));
vec2 lateral=vec2(-h.y,h.x);field0=vec4(h,lateral*k.x/kl);field1=vec4(lateral*k.y/kl,0,0);}`;
const transform=`${declarations}
uniform sampler2D source0;uniform sampler2D source1;uniform float size;uniform float halfSize;uniform float axis;
float reverseIndex(float index){float result=0.;for(int i=0;i<8;i++){result=result*2.+mod(index,2.);index=floor(index*.5);}return result;}
vec2 cm(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
void main(){vec2 index=floor(vUv*size);float coordinate=axis<.5?index.x:index.y;
float j=mod(coordinate,halfSize),base=floor(coordinate/(halfSize*2.))*halfSize*2.;
float a=base+j,b=a+halfSize;if(halfSize<1.5){a=reverseIndex(a);b=reverseIndex(b);}
vec2 uvA=(index+.5)/size,uvB=uvA;
if(axis<.5){uvA.x=(a+.5)/size;uvB.x=(b+.5)/size;}else{uvA.y=(a+.5)/size;uvB.y=(b+.5)/size;}
float angle=6.28318530718*j/(halfSize*2.);vec2 twiddle=vec2(cos(angle),sin(angle));
float signValue=mod(coordinate,halfSize*2.)<halfSize?1.:-1.;
vec4 a0=texture(source0,uvA),b0=texture(source0,uvB),a1=texture(source1,uvA),b1=texture(source1,uvB);
field0=a0+signValue*vec4(cm(b0.xy,twiddle),cm(b0.zw,twiddle));
field1=a1+signValue*vec4(cm(b1.xy,twiddle),cm(b1.zw,twiddle));}`;
const assemble=`precision highp float;precision highp sampler2D;in vec2 vUv;out vec4 outputField;
uniform sampler2D source0;uniform sampler2D source1;uniform sampler2D previous;
uniform float cell;uniform float size;uniform float delta;uniform float chop;uniform float wind;uniform float heightScale;uniform float current;uniform float lengthScale;uniform float sourceScale;uniform vec2 windDirection;uniform float time;
vec2 lateral(vec2 uv){return vec2(texture(source0,uv).z,texture(source1,uv).x)*chop;}
void main(){vec2 pixel=vec2(1./size,0.);vec2 dx=(lateral(vUv+pixel)-lateral(vUv-pixel))/(2.*cell);
vec2 dz=(lateral(vUv+pixel.yx)-lateral(vUv-pixel.yx))/(2.*cell);
float jacobian=(1.+dx.x)*(1.+dz.y)-dx.y*dz.x;
float height=texture(source0,vUv).x;
float source=(1.-smoothstep(.18,.55,jacobian))*smoothstep(max(.01,heightScale*.10),max(.02,heightScale*.32),height)*smoothstep(3.,18.,wind)*sourceScale;
vec2 orbit=(lateral(vUv)-texture(previous,vUv).yz)/max(delta,.001);
vec2 world=vUv*lengthScale;
float eddy=sin(world.x*.013+time*.11)*cos(world.y*.017-time*.09);
vec2 drift=windDirection+vec2(windDirection.y,-windDirection.x)*eddy*.45;
vec2 velocity=clamp(orbit,vec2(-25),vec2(25))+vec2(0,current)+drift*wind*.025;
float old=texture(previous,vUv-velocity*delta/lengthScale).a*exp(-delta/3.0);
float foam=1.-(1.-old)*exp(-delta*source*.85);
outputField=vec4(height,lateral(vUv),foam);}`;
interface Cascade { band:SpectralBand; seed:THREE.DataTexture; a:THREE.WebGLRenderTarget; b:THREE.WebGLRenderTarget; output:THREE.WebGLRenderTarget; history:THREE.WebGLRenderTarget }
export class SpectralOcean {
    readonly lengths=new THREE.Vector3();
    readonly maps:THREE.Texture[]=[];
    private cascades:Cascade[]=[];
    private scene=new THREE.Scene();private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    private quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));
    private evolveMaterial:THREE.RawShaderMaterial;private fftMaterial:THREE.RawShaderMaterial;private assembleMaterial:THREE.RawShaderMaterial;
    private key='';
    constructor(private renderer:THREE.WebGLRenderer,s:SimulationSettings){
        const common={glslVersion:THREE.GLSL3,vertexShader:vertex,depthTest:false,depthWrite:false};
        this.evolveMaterial=new THREE.RawShaderMaterial({...common,fragmentShader:evolve,uniforms:{seed:{value:null},size:{value:256},lengthScale:{value:1024},time:{value:0},depth:{value:s.depth},current:{value:0}}});
        this.fftMaterial=new THREE.RawShaderMaterial({...common,fragmentShader:transform,uniforms:{source0:{value:null},source1:{value:null},size:{value:256},halfSize:{value:1},axis:{value:0}}});
        this.assembleMaterial=new THREE.RawShaderMaterial({...common,fragmentShader:assemble,uniforms:{source0:{value:null},source1:{value:null},previous:{value:null},size:{value:256},cell:{value:4},lengthScale:{value:1024},delta:{value:0},chop:{value:1},wind:{value:9},heightScale:{value:1},current:{value:0},time:{value:0},sourceScale:{value:1},windDirection:{value:new THREE.Vector2()}}});
        this.scene.add(this.quad);this.configure(s);
    }
    configure(s:SimulationSettings){
        const key=[s.kind,s.waveHeight,s.period,s.depth,s.direction,s.wind,s.choppiness,s.variability,s.realization].join(':');if(key===this.key)return;this.key=key;
        const bands=createSpectralBands(s);this.lengths.set(...bands.map(b=>b.length) as [number,number,number]);
        if(!this.cascades.length){
            const clearColor=this.renderer.getClearColor(new THREE.Color()),clearAlpha=this.renderer.getClearAlpha();
            this.renderer.setClearColor(0,0);
            this.cascades=bands.map(band=>{
                const seed=new THREE.DataTexture(band.seed,256,256,THREE.RGBAFormat,THREE.FloatType);seed.needsUpdate=true;
                const options={type:THREE.FloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,count:2};
                const a=new THREE.WebGLRenderTarget(256,256,options),b=new THREE.WebGLRenderTarget(256,256,options);
                const output=new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType,depthBuffer:false,wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
                const history=output.clone();for(const rt of [a,b,output,history]){this.renderer.setRenderTarget(rt);this.renderer.clear();}
                return {band,seed,a,b,output,history};
            });this.renderer.setRenderTarget(null);this.renderer.setClearColor(clearColor,clearAlpha);
        }else bands.forEach((band,i)=>{const c=this.cascades[i];c.band=band;c.seed.image.data=band.seed;c.seed.needsUpdate=true;});
        this.reset();
    }
    update(time:number,delta:number,s:SimulationSettings){
        this.configure(s);const renderer=this.renderer;
        for(let c=0;c<this.cascades.length;c++){
            const cascade=this.cascades[c];let read=cascade.a,write=cascade.b;
            const e=this.evolveMaterial.uniforms;e.seed.value=cascade.seed;e.lengthScale.value=cascade.band.length;e.time.value=time;e.depth.value=s.depth;e.current.value=currentSpeed(s);
            this.quad.material=this.evolveMaterial;renderer.setRenderTarget(read);renderer.render(this.scene,this.camera);
            this.quad.material=this.fftMaterial;const f=this.fftMaterial.uniforms;
            for(let axis=0;axis<2;axis++)for(let stage=0;stage<8;stage++){
                f.source0.value=read.textures[0];f.source1.value=read.textures[1];f.axis.value=axis;f.halfSize.value=2**stage;
                renderer.setRenderTarget(write);renderer.render(this.scene,this.camera);[read,write]=[write,read];
            }
            const a=this.assembleMaterial.uniforms;a.source0.value=read.textures[0];a.source1.value=read.textures[1];a.previous.value=cascade.history.texture;
            a.cell.value=cascade.band.length/256;a.lengthScale.value=cascade.band.length;a.delta.value=delta;a.chop.value=s.choppiness*(c===0?1.25:c===1?.65:.2);
            a.time.value=time;a.sourceScale.value=c===0?1:c===1?.25:0;a.windDirection.value.set(Math.sin(s.direction*Math.PI/180),Math.cos(s.direction*Math.PI/180));a.wind.value=s.wind;a.heightScale.value=4*Math.sqrt(cascade.band.variance);a.current.value=currentSpeed(s);
            this.quad.material=this.assembleMaterial;renderer.setRenderTarget(cascade.output);renderer.render(this.scene,this.camera);
            this.maps[c]=cascade.output.texture;[cascade.output,cascade.history]=[cascade.history,cascade.output];
        }renderer.setRenderTarget(null);
    }
    /** A sparse CPU query matches the GPU Fourier field; used for buoyancy and camera clearance. */
    sample(x:number,z:number,_time:number,_s:SimulationSettings){
        let height=0,dx=0,dz=0,dxx=0,dzz=0,dxz=0,dzx=0,vx=0,vz=0,vy=0;
        // Keep queries bounded: cache a coarse physical field from GPU at 5 Hz, then bilinear sample it.
        for(const c of this.cascades){
            const data=this.readbacks.get(c);if(!data)continue;
            const u=((x/c.band.length)%1+1)%1*256,v=((z/c.band.length)%1+1)%1*256;
            const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
            const at=(xx:number,zz:number,k:number)=>data[(((zz+256)%256)*256+(xx+256)%256)*4+k];
            const sample=(k:number)=>(at(ix,iz,k)*(1-fx)+at(ix+1,iz,k)*fx)*(1-fz)+(at(ix,iz+1,k)*(1-fx)+at(ix+1,iz+1,k)*fx)*fz;
            height+=sample(0);dx+=sample(1);dz+=sample(2);
            const cell=c.band.length/256;
            const ddx=(at(ix+1,iz,1)-at(ix-1,iz,1))/(2*cell),ddz=(at(ix,iz+1,2)-at(ix,iz-1,2))/(2*cell);
            dxx+=ddx;dzz+=ddz;dxz+=(at(ix,iz+1,1)-at(ix,iz-1,1))/(2*cell);dzx+=(at(ix+1,iz,2)-at(ix-1,iz,2))/(2*cell);
            const prior=this.priorReadbacks.get(c);if(prior&&this.readDelta>0){const priorAt=(k:number)=>(prior[((iz*256+ix)*4)+k]*(1-fx)+prior[((iz*256+(ix+1)%256)*4)+k]*fx)*(1-fz)+(prior[((((iz+1)%256)*256+ix)*4)+k]*(1-fx)+prior[((((iz+1)%256)*256+(ix+1)%256)*4)+k]*fx)*fz;const ux=(sample(1)-priorAt(1))/this.readDelta,uz=(sample(2)-priorAt(2))/this.readDelta,uy=(sample(0)-priorAt(0))/this.readDelta;vx+=ux;vz+=uz;vy+=uy;const age=Math.max(0,Math.min(.2,_time-this.readTime));height+=uy*age;dx+=ux*age;dz+=uz*age;}
        }return {height,dx,dz,jacobian:(1+dxx)*(1+dzz)-dxz*dzx,vx,vz,vy};
    }
    private readbacks=new Map<Cascade,Float32Array>();private priorReadbacks=new Map<Cascade,Float32Array>();private readDelta=0;private readTime=-1;
    readSurface(time:number){
        if(time-this.readTime<.2&&time>=this.readTime)return;this.readDelta=this.readTime>=0?time-this.readTime:0;this.readTime=time;
        for(const c of this.cascades){let buffer=this.readbacks.get(c);if(!buffer){buffer=new Float32Array(256*256*4);this.readbacks.set(c,buffer);}
            let prior=this.priorReadbacks.get(c);if(!prior){prior=new Float32Array(buffer.length);this.priorReadbacks.set(c,prior);}prior.set(buffer);
            this.renderer.readRenderTargetPixels(c.history,0,0,256,256,buffer);}
    }
    verify(time:number,s:SimulationSettings){
        let error=0;
        for(const c of this.cascades){const actual=this.readbacks.get(c);if(!actual)return false;
            const seed=c.band.seed,dk=2*Math.PI/c.band.length;
            for(const [gx,gz] of [[0,0],[17,29],[123,51]]){
                let expected=0;
                for(let y=0;y<256;y++)for(let x=0;x<256;x++){
                    const i=(y*256+x)*4;if(seed[i]===0&&seed[i+1]===0&&seed[i+2]===0&&seed[i+3]===0)continue;
                    const kx=(x<128?x:x-256)*dk,kz=(y<128?y:y-256)*dk,k=Math.hypot(kx,kz);
                    if(k===0)continue;
                    const phase=Math.sqrt((9.81*k+.000074*k*k*k)*Math.tanh(k*s.depth))*time,co=Math.cos(phase),si=Math.sin(phase);
                    const re=(seed[i]+seed[i+2])*co+(seed[i+1]-seed[i+3])*si;
                    const im=(seed[i+1]+seed[i+3])*co+(seed[i+2]-seed[i])*si;
                    const spatial=(kx*gx+kz*gz)*c.band.length/256-kz*currentSpeed(s)*time;
                    expected+=re*Math.cos(spatial)-im*Math.sin(spatial);
                }
                error=Math.max(error,Math.abs(expected-actual[(gz*256+gx)*4]));
            }
        }
        return Number.isFinite(error)&&error<.001;
    }
    statistics(){return this.cascades.map(c=>{const data=this.readbacks.get(c);if(!data)return null;
        let energy=0,foam=0,max=0;for(let i=0;i<data.length;i+=4){energy+=data[i]*data[i];foam+=data[i+3];max=Math.max(max,Math.abs(data[i]));}
        return {length:c.band.length,rms:Math.sqrt(energy/(data.length/4)),foam:foam/(data.length/4),max};});}
    reset(){this.readTime=-1;this.readDelta=0;this.readbacks.clear();this.priorReadbacks.clear();const clearColor=this.renderer.getClearColor(new THREE.Color()),clearAlpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);for(const c of this.cascades)for(const rt of [c.output,c.history]){this.renderer.setRenderTarget(rt);this.renderer.clear();}this.renderer.setRenderTarget(null);this.renderer.setClearColor(clearColor,clearAlpha);}
    dispose(){this.cascades.forEach(c=>{c.seed.dispose();c.a.dispose();c.b.dispose();c.output.dispose();c.history.dispose();});this.evolveMaterial.dispose();this.fftMaterial.dispose();this.assembleMaterial.dispose();this.quad.geometry.dispose();}
}
