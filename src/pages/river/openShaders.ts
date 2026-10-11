import { WAVE_COUNT } from './system';
const waves = `
uniform vec4 waveShape[${WAVE_COUNT}];
uniform vec4 waveMotion[${WAVE_COUNT}];
uniform float time;
uniform float current;
uniform float depth;
uniform float kind;
uniform vec2 domain;
uniform vec4 impulse;
float channelCenter(float z){return kind==1.0?sin(z*.004)*28.0:0.0;}
`;
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;
export const openVertex = /* glsl */`
${waves}
varying vec3 world;
varying vec3 normalWater;
varying vec2 materialPoint;
void main(){
    vec3 p=position;p.x+=channelCenter(p.z);
    vec3 tx=vec3(1.0,0.0,0.0),tz=vec3(0.0,0.0,1.0);
    vec2 original=p.xz;materialPoint=original;
    for(int i=0;i<${WAVE_COUNT};i++){
        vec4 w=waveShape[i],m=waveMotion[i];
        float phase=w.z*dot(w.xy,original)-(m.x+w.z*w.y*current)*time+m.y;
        float si=sin(phase),co=cos(phase),a=w.w,k=w.z,q=m.z;
        p.xz+=q*a*w.xy*co;p.y+=a*si;
        tx+=vec3(-q*a*k*w.x*w.x*si,a*k*w.x*co,-q*a*k*w.x*w.y*si);
        tz+=vec3(-q*a*k*w.x*w.y*si,a*k*w.y*co,-q*a*k*w.y*w.y*si);
    }
    float age=time-impulse.z;
    if(age>0.0 && age<12.0){
        float scale=max(.5,domain.x*.001),frequency=3.0/scale;
        float c=sqrt(9.81*tanh(frequency*depth)/frequency);
        float r=length(original-impulse.xy),front=r-c*age;
        float envelope=impulse.w*exp(-front*front/(scale*scale*5.0))*exp(-age*.5)/sqrt(1.0+r);
        float slope=envelope*(frequency*cos(front*frequency)+sin(front*frequency)*(-2.0*front/(scale*scale*5.0)-.5/(1.0+r)));
        vec2 radial=(original-impulse.xy)/max(r,.01);
        p.y+=envelope*sin(front*frequency);tx.y+=slope*radial.x;tz.y+=slope*radial.y;
    }
    normalWater=normalize(cross(tz,tx));world=p;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`;

// Eulerian whitecap history: generation from compressed crests, transport, exponential decay.
// This is a surface coverage model, not a volume-breaking solver.
export const foamFragment = /* glsl */`
${waves}
uniform sampler2D previousFoam;
uniform float delta;
uniform float wind;
uniform float heightScale;
uniform vec2 foamDomain;
varying vec2 vUv;
void main(){
    vec2 p=(vUv-.5)*foamDomain;
    float xx=1.0,zz=1.0,xz=0.0,h=0.0;
    for(int i=0;i<${WAVE_COUNT};i++){
        vec4 w=waveShape[i],m=waveMotion[i];
        float si=sin(w.z*dot(w.xy,p)-(m.x+w.z*w.y*current)*time+m.y);
        float c=m.z*w.w*w.z*si;
        xx-=c*w.x*w.x;zz-=c*w.y*w.y;xz-=c*w.x*w.y;h+=w.w*si;
    }
    float compression=1.0-(xx*zz-xz*xz);
    float source=smoothstep(.075,.2,compression)*smoothstep(0.0,max(.05,heightScale*.12),h);
    source*=smoothstep(4.0,22.0,wind)*step(.01,heightScale);
    vec2 oldUv=vUv-vec2(0.0,current)*delta/foamDomain;
    float old=texture2D(previousFoam,oldUv).r*exp(-delta/4.0);
    float coverage=1.0-(1.0-old)*exp(-source*delta*.9);
    gl_FragColor=vec4(coverage,0.0,0.0,1.0);
}`;
export const openFragment = /* glsl */`
uniform samplerCube environmentMap;
uniform sampler2D foamMap;
uniform vec2 foamDomain;
uniform vec3 sunDirection;
uniform vec3 waterColor;
uniform vec3 haze;
uniform float roughness;
uniform float heightScale;
uniform float clarity;
uniform float wind;
${waves}
${noise}
varying vec3 world;
varying vec3 normalWater;
varying vec2 materialPoint;
void main(){
    float edge=0.0;
    if(kind==0.0)edge=length(materialPoint/(domain*.5));
    if(kind==1.0)edge=abs(materialPoint.x-channelCenter(materialPoint.y))/(domain.x*.5);
    if(kind<2.0 && edge>.997)discard;
    vec2 p=materialPoint;
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    // Analytic per-pixel wave tangents avoid flattening short waves between mesh vertices.
    vec3 tx=vec3(1,0,0),tz=vec3(0,0,1);
    for(int i=0;i<${WAVE_COUNT};i++){
        vec4 w=waveShape[i],m=waveMotion[i];
        float phase=w.z*dot(w.xy,p)-(m.x+w.z*w.y*current)*time+m.y;
        float si=sin(phase),co=cos(phase),ak=w.w*w.z*exp(-footprint*w.z*.6),q=m.z;
        tx+=vec3(-q*ak*w.x*w.x*si,ak*w.x*co,-q*ak*w.x*w.y*si);
        tz+=vec3(-q*ak*w.x*w.y*si,ak*w.y*co,-q*ak*w.y*w.y*si);
    }
    vec3 n=normalize(cross(tz,tx));
    // Wind-driven gravity/capillary ripples in metre units, filtered at a pixel footprint.
    vec2 detail=vec2(0);
    for(int i=0;i<12;i++){
        float f=float(i),angle=.4+f*2.399963;
        vec2 dir=vec2(sin(angle),cos(angle));float k=1.7*pow(1.43,f);
        float omega=sqrt((9.81*k+.000074*k*k*k)*tanh(k*depth));
        float slope=min(.035,wind*.003)/(1.0+f*.12)*exp(-footprint*k*.8);
        detail+=dir*slope*cos(dot(p,dir)*k-(omega+k*dir.y*current)*time+f*f*1.37);
    }
    n=normalize(n+vec3(-detail.x,0,-detail.y));
    vec3 eye=normalize(cameraPosition-world);
    float facing=max(dot(n,eye),.001);
    float fresnel=.02037+.97963*pow(1.0-facing,5.0);
    vec3 reflected=textureCube(environmentMap,reflect(-eye,n)).rgb;
    float opticalDepth=depth*(kind<2.0?max(.02,1.0-edge*edge):1.0);
    vec3 absorption=exp(-vec3(.2,.045,.025)*opticalDepth/max(facing,.2));
    vec3 transmitted=mix(waterColor*.18,vec3(.29,.31,.22),absorption*clarity*.6);
    // Backlit wave crests scatter green-blue light; troughs keep depth and contrast.
    float back=pow(max(dot(eye,-sunDirection),0.0),3.0);
    float crestLight=smoothstep(0.0,max(heightScale*.4,.01),world.y)*back;
    transmitted+=waterColor*(.12+.75*crestLight)*max(.2,sunDirection.y);
    vec3 color=mix(transmitted,reflected,fresnel);
    // Energy-conserving GGX / Smith dielectric sun glints, rather than a broad Phong stripe.
    vec3 halfVector=normalize(eye+sunDirection);
    float nl=max(dot(n,sunDirection),.001),nh=max(dot(n,halfVector),0.0),vh=max(dot(eye,halfVector),0.0);
    float alpha=.025+min(wind/35.0,1.0)*.055,a2=alpha*alpha;
    float d=a2/(3.14159265*pow(nh*nh*(a2-1.0)+1.0,2.0));
    float gv=2.0*facing/(facing+sqrt(a2+(1.0-a2)*facing*facing));
    float gl=2.0*nl/(nl+sqrt(a2+(1.0-a2)*nl*nl));
    float f=.02037+.97963*pow(1.0-vh,5.0);
    color+=vec3(1.0,.88,.72)*min(8.0,d*gv*gl*f/(4.0*facing))*(roughness>.5?.22:1.0);
    vec2 fuv=p/foamDomain+.5;
    float coverage=texture2D(foamMap,clamp(fuv,.001,.999)).r;
    coverage*=step(0.0,fuv.x)*step(fuv.x,1.0)*step(0.0,fuv.y)*step(fuv.y,1.0);
    vec2 drift=p-vec2(.12,current)*time;
    float grain=noise(drift*.45)*.5+noise(drift*1.8)*.3+noise(drift*7.0)*.2;
    float foam=smoothstep(.06,.45,coverage)*smoothstep(.28,.65,grain);
    vec3 foamColor=vec3(.62,.69,.68)*(.7+.3*max(dot(n,sunDirection),0.0));
    color=mix(color,foamColor,foam*.94);
    float distanceToEye=length(cameraPosition-world);
    float fog=1.0-exp(-distanceToEye*(roughness>.5?.0005:.00022));
    color=mix(color,haze,min(fog,.97));
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
