export const vertexShader = /* glsl */`
uniform sampler2D heights;
uniform float time;
uniform float wind;
uniform float speed;
uniform float depth;
uniform vec4 longWave;
uniform float variability;uniform float realization;
uniform vec2 domainScale;
uniform mat4 reflectionMatrix;
varying vec3 world;
varying vec3 waterNormal;
varying vec4 reflected;
varying vec4 projected;
varying vec2 riverUv;
float micro(vec2 p) {
    p*=domainScale;
    vec2 direction=vec2(sin(longWave.w),cos(longWave.w));
    float h=0.0,energy=0.0;
    // Eight irregular directional components; variance remains Hs^2 / 16.
    for(int j=0;j<8;j++){
        float f=float(j),weight=exp(-pow((f-3.0)/2.0,2.0));
        float angle=longWave.w+sin(f*2.399+1.7+realization*.037)*(.08+variability*.6);
        vec2 d=vec2(sin(angle),cos(angle));float k=longWave.x*(.55+f*.18);
        float omega=sqrt((9.81*k+.000074*k*k*k)*tanh(k*depth));
        h+=weight*sin(dot(p,d)*k-(omega+k*d.y*speed)*time+f*f*1.731+sin(realization*.13+f*19.17)*3.14);
        energy+=weight*weight;
    }
    h*=longWave.z/sqrt(2.0*energy);
    for (int i=0; i<6; i++) {
        float f=float(i);
        float k=5.0+f*4.8;
        vec2 dir=normalize(vec2(sin(f*2.4+0.5)*0.65, 1.0));
        // Finite-depth gravity/capillary dispersion, carried by the current.
        float omega=sqrt((9.81*k+0.000074*k*k*k)*tanh(k*depth));
        h += (0.0015+wind*0.0015)/(1.0+f*.7)*sin(dot(p,dir)*k-(omega+k*dir.y*speed)*time+f*4.0);
    }
    return h;
}
float elevation(vec2 uv, vec2 p) {
    vec2 texel=vec2(1.0/72.0,1.0/216.0);
    vec2 grid=uv/texel-.5, base=(floor(grid)+.5)*texel, f=fract(grid);
    float a=texture2D(heights,base).r, b=texture2D(heights,base+vec2(texel.x,0.0)).r;
    float c=texture2D(heights,base+vec2(0.0,texel.y)).r, d=texture2D(heights,base+texel).r;
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y)+micro(p);
}
void main() {
    riverUv=uv;
    vec3 p=position;
    p.y=elevation(uv,p.xz);
    float e=.04;
    float hx=(elevation(uv+vec2(e/(9.0*domainScale.x),0.0),p.xz+vec2(e/domainScale.x,0.0))-elevation(uv-vec2(e/(9.0*domainScale.x),0.0),p.xz-vec2(e/domainScale.x,0.0)))/(2.0*e);
    float hz=(elevation(uv+vec2(0.0,e/(48.0*domainScale.y)),p.xz+vec2(0.0,e/domainScale.y))-elevation(uv-vec2(0.0,e/(48.0*domainScale.y)),p.xz-vec2(0.0,e/domainScale.y)))/(2.0*e);
    waterNormal=normalize(vec3(-hx,1.0,-hz));
    world=(modelMatrix*vec4(p,1.0)).xyz;
    reflected=reflectionMatrix*vec4(world,1.0);
    projected=projectionMatrix*viewMatrix*vec4(world,1.0);
    gl_Position=projected;
}`;
export const fragmentShader = /* glsl */`
uniform sampler2D reflection;
uniform sampler2D refraction;
uniform sampler2D bedDepth;uniform mat4 viewProjection;uniform mat4 inverseViewProjection;
uniform float clarity;
uniform vec2 domainScale;
uniform float depth;
uniform float time;
uniform float speed;
uniform vec3 sunDirection;
uniform mat4 reflectionMatrix;
varying vec3 world;
varying vec3 waterNormal;
varying vec4 reflected;
varying vec4 projected;
varying vec2 riverUv;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main() {
    vec2 fineSlope=vec2(0.0);
    float footprint=max(length(dFdx(world.xz)),length(dFdy(world.xz)));
    for(int i=0;i<9;i++){
        float f=float(i),k=24.0*pow(1.32,f);
        vec2 d=normalize(vec2(sin(f*2.399+.4),1.0));
        float omega=sqrt((9.81*k+.000074*k*k*k)*tanh(k*depth));
        fineSlope+=d*.012/(1.0+f*.25)*exp(-footprint*k)*cos(dot(world.xz,d)*k-(omega+k*d.y*speed)*time+f*f);
    }
    vec3 n=normalize(waterNormal+vec3(-fineSlope.x,0.0,-fineSlope.y));
    vec3 view=normalize(cameraPosition-world);
    float cosTheta=max(dot(n,view),0.0);
    // Exact unpolarized Fresnel and Snell refraction for air/water IOR 1.333.
    float cost=sqrt(1.-(1.-cosTheta*cosTheta)/(1.333*1.333));
    float rs=(cosTheta-1.333*cost)/(cosTheta+1.333*cost),rp=(1.333*cosTheta-cost)/(1.333*cosTheta+cost);
    float fresnel=.5*(rs*rs+rp*rp);
    vec2 screen=projected.xy/projected.w*.5+.5;
    vec3 ray=reflect(-view,n);
    vec4 reflectedRay=reflectionMatrix*vec4(world+ray*60.,1.);
    vec2 ruv=reflectedRay.xy/reflectedRay.w*.5+.5;
    vec2 bend=n.xz*.026;
    vec3 mirror=texture2D(reflection,clamp(ruv,0.002,.998)).rgb;

    float side=abs(riverUv.x*2.0-1.0);
    float waterDepth=depth*(.35+.65*(1.0-side*side));
    vec3 transmitted=refract(-view,n,1./1.333);float vertical=max(.15,-transmitted.y);
    float path=waterDepth/vertical;vec2 bedUv=screen;float confidence=1.;
    // Iterate the refracted ray against actual rendered scene depth, including submerged rocks.
    for(int i=0;i<3;i++){
        vec3 point=world+transmitted*path;vec4 clip=viewProjection*vec4(point,1.);
        vec2 rayUv=clip.xy/clip.w*.5+.5;
        confidence*=smoothstep(0.,.035,rayUv.x)*smoothstep(0.,.035,rayUv.y)*smoothstep(0.,.035,1.-rayUv.x)*smoothstep(0.,.035,1.-rayUv.y)*step(.001,clip.w);
        bedUv=clamp(rayUv,.002,.998);
        float bottom=texture2D(bedDepth,bedUv).r;
        vec4 bedPoint=inverseViewProjection*vec4(bedUv*2.-1.,bottom*2.-1.,1.);
        float column=max(0.,world.y-bedPoint.y/bedPoint.w);
        path=clamp(column/vertical,0.,20.);
    }
    vec3 bed=mix(texture2D(refraction,clamp(screen,.002,.998)).rgb,texture2D(refraction,bedUv).rgb,confidence);
    path=mix(waterDepth/vertical,path,confidence);
    vec3 trans=exp(-vec3(.48,.14,.085)*path*(2.0-clarity*1.65));
    vec3 scattering=vec3(.045,.16,.135);
    vec3 color=mix(bed*trans+scattering*(1.0-trans),mirror,fresnel);
    vec3 halfVector=normalize(sunDirection+view);
    float nl=max(dot(n,sunDirection),.001),nh=max(dot(n,halfVector),0.0),vh=max(dot(view,halfVector),0.0);
    float a2=.0016,denom=nh*nh*(a2-1.0)+1.0;
    float d=a2/(3.14159265*denom*denom);
    float gv=2.0*cosTheta/(cosTheta+sqrt(a2+(1.0-a2)*cosTheta*cosTheta));
    float gl=2.0*nl/(nl+sqrt(a2+(1.0-a2)*nl*nl));
    float f=.02037+.97963*pow(1.0-vh,5.0);
    color+=vec3(1.0,.91,.75)*min(3.0,d*gv*gl*f/(4.0*max(cosTheta,.001)))*.12;
    // Sparse foam in the downstream wakes, stretched and advected.
    float foam=0.0;
    for (int i=0; i<3; i++) {
        vec2 rock=i==0?vec2(-1.65,3.0):(i==1?vec2(1.25,-8.0):vec2(-.55,14.0));
        float localX=(riverUv.x-.5)*9.0-rock.x;
        float dz=world.z/domainScale.y-rock.y;
        float wake=exp(-abs(localX)/(0.12+max(dz,0.0)*.11))*exp(-max(dz,0.0)*.65)*step(.3,dz);
        float grain=foamNoise(vec2(localX*20.0,(dz-time*speed/domainScale.y)*18.0));
        foam+=wake*smoothstep(.5,.78,grain)*min(speed*.4,.7);
    }
    color=mix(color,vec3(.76,.83,.76),min(foam,.45));
    float fog=1.0-exp(-.00014*length(cameraPosition-world)*length(cameraPosition-world));
    color=mix(color,vec3(.63,.73,.69),fog);
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
