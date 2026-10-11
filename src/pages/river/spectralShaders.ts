const fields=`
uniform sampler2D band0;uniform sampler2D band1;uniform sampler2D band2;
uniform vec3 bandLengths;uniform float time;uniform float current;uniform float depth;
uniform float kind;uniform vec2 domain;uniform vec4 impulse;
float channelCenter(float z){return kind==1.0?sin(z*.004)*28.0:0.0;}
// Cubic B-spline reconstruction prevents enlarged long-wave texels from
// becoming flat, visibly faceted wave faces. Four bilinear taps per lookup.
vec4 longBand(vec2 p){
    vec2 pixel=p/bandLengths.x*256.,base=floor(pixel),f=fract(pixel),f2=f*f,f3=f2*f;
    vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.;
    vec2 w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.,g0=w0+w1,g1=w2+w3;
    vec2 lo=(base-1.+w1/g0+.5)/256.,hi=(base+1.+w3/g1+.5)/256.;
    return mix(mix(texture2D(band0,lo),texture2D(band0,vec2(hi.x,lo.y)),g1.x),mix(texture2D(band0,vec2(lo.x,hi.y)),texture2D(band0,hi),g1.x),g1.y);
}
vec4 band(vec2 p,int i){if(i==0)return longBand(p);if(i==1)return texture2D(band1,p/bandLengths.y+vec2(.5/256.));return texture2D(band2,p/bandLengths.z+vec2(.5/256.));}
vec4 field(vec2 p){vec4 a=band(p,0),b=band(p,1),c=band(p,2);return vec4(a.xyz+b.xyz+c.xyz,1.-(1.-a.a)*(1.-b.a));}
float drop(vec2 p){float age=time-impulse.z;if(age<=0.||age>=12.)return 0.;float scale=max(.5,domain.x*.001),k=3./scale;
float r=length(p-impulse.xy),front=r-sqrt(9.81*tanh(k*depth)/k)*age;
return impulse.w*exp(-front*front/(scale*scale*5.))*exp(-age*.5)*sin(front*k)/sqrt(1.+r);}
`;
export const spectralVertex=`${fields}
varying vec3 world;varying vec2 materialPoint;
void main(){vec3 p=position;p.x+=channelCenter(p.z);materialPoint=p.xz;
vec4 f=field(materialPoint);p+=vec3(f.y,f.x+drop(materialPoint),f.z);
world=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;
export const spectralFragment=`${fields}
uniform sampler2D landscapeReflection;uniform mat4 landscapeMatrix;uniform float hasLandscape;
uniform sampler2D skyMap;uniform float skyReady;uniform sampler2D previousScene;
uniform mat4 previousViewProjection;uniform vec2 viewport;
uniform vec3 sunDirection;uniform vec3 waterColor;uniform vec3 haze;
uniform float heightScale;uniform float clarity;uniform float wind;uniform float storm;uniform vec2 windDirection;uniform float variability;uniform float realization;
varying vec3 world;varying vec2 materialPoint;
const float PI=3.14159265359;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec3 sky(vec3 ray){
    vec2 uv=vec2(atan(ray.z,ray.x)/(2.*PI)+.5,asin(clamp(ray.y,-1.,1.))/PI+.5);
    vec3 hdri=texture2D(skyMap,uv).rgb*.8;
    return mix(mix(vec3(.16,.24,.32),vec3(.5,.62,.72),pow(1.-max(ray.y,0.),3.)),hdri,skyReady);
}
void main(){
    float edge=kind==0.?length(materialPoint/(domain*.5)):abs(materialPoint.x-channelCenter(materialPoint.y))/(domain.x*.5);
    if(kind<2.&&edge>.999)discard;
    float footprint=max(length(dFdx(materialPoint)),length(dFdy(materialPoint)));
    vec3 tx=vec3(1,0,0),tz=vec3(0,0,1);vec2 gravityDx=vec2(0),gravityDz=vec2(0);float primaryJacobian=1.;
    for(int i=0;i<3;i++){
        float lengthScale=i==0?bandLengths.x:(i==1?bandLengths.y:bandLengths.z),cell=lengthScale/256.;
        vec3 a=(band(materialPoint+vec2(cell,0),i).xyz-band(materialPoint-vec2(cell,0),i).xyz)/(2.*cell);
        vec3 b=(band(materialPoint+vec2(0,cell),i).xyz-band(materialPoint-vec2(0,cell),i).xyz)/(2.*cell);
        if(i<2){gravityDx+=a.yz;gravityDz+=b.yz;}
        float bandFilter=exp(-footprint/(cell*8.));
        tx+=vec3(a.y,a.x,a.z)*bandFilter;tz+=vec3(b.y,b.x,b.z)*bandFilter;
    }
    primaryJacobian=(1.+gravityDx.x)*(1.+gravityDz.y)-gravityDx.y*gravityDz.x;
    float e=.15;tx.y+=(drop(materialPoint+vec2(e,0))-drop(materialPoint-vec2(e,0)))/(2.*e);
    tz.y+=(drop(materialPoint+vec2(0,e))-drop(materialPoint-vec2(0,e)))/(2.*e);
    vec2 capillary=vec2(0);
    for(int i=0;i<16;i++){float f=float(i),angle=atan(windDirection.x,windDirection.y)+(hash(vec2(f+1.,realization))-.5)*2.4,k=12.*pow(1.3,f);vec2 d=vec2(sin(angle),cos(angle));
        float omega=sqrt((9.81*k+.000074*k*k*k)*tanh(k*depth));
        capillary+=d*min(.05,wind*.0016)/(1.+f*.2)*exp(-footprint*k*.8)*cos(dot(materialPoint,d)*k-(omega+k*d.y*current)*time+hash(vec2(f,realization+11.))*6.2831853);}
    vec3 n=normalize(cross(tz,tx)+vec3(-capillary.x,0,-capillary.y));
    vec3 view=normalize(cameraPosition-world);float nv=max(dot(n,view),.001);
    // Exact unpolarized Fresnel for air/water (n = 1.333).
    float cost=sqrt(1.-(1.-nv*nv)/(1.333*1.333));
    float rs=(nv-1.333*cost)/(nv+1.333*cost),rp=(1.333*nv-cost)/(1.333*nv+cost);
    float fresnel=.5*(rs*rs+rp*rp);
    vec3 ray=reflect(-view,n),reflected=sky(ray);
    if(hasLandscape>.5){vec4 projected=landscapeMatrix*vec4(world+ray*max(350.,domain.y*.6),1.);vec2 uv=projected.xy/projected.w*.5+.5;
        reflected=texture2D(landscapeReflection,clamp(uv,.002,.998)).rgb;}
    // Trace the reflected ray against the actual wave height field. A nearby opposing face
    // blocks the sky and samples last frame's HDR scene radiance, including wave faces.
    float stepLength=mix(1.5,7.,clamp(heightScale/12.,0.,1.));float hit=0.,hitWeight=0.;vec3 hitPoint=world;
    if(ray.y<.26){
        for(int i=0;i<12;i++){
            float distance=(float(i)+1.)*stepLength;
            vec3 q=world+ray*distance+vec3(0,.12,0);
            float h=field(q.xz).x;
            if(q.y<h && hit<.5){hit=1.;hitPoint=q;hitWeight=smoothstep(0.,1.5,h-q.y);}
        }
    }
    if(hit>.5){vec4 clip=previousViewProjection*vec4(hitPoint,1.);vec2 uv=clip.xy/clip.w*.5+.5;
        float valid=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.)*step(.001,clip.w);
        vec3 surfaceRadiance=mix(waterColor*.1,texture2D(previousScene,clamp(uv,.001,.999)).rgb,valid*.85);
        reflected=mix(reflected,surfaceRadiance,.35*hitWeight);}
    float waterDepth=depth*(kind<2.?max(.01,1.-edge*edge):1.);
    vec3 attenuation=exp(-vec3(.28,.07,.035)*waterDepth/max(nv,.25));
    vec3 transmission=waterColor*(.12+.08*max(n.y,0.));
    if(kind<2.)transmission=mix(transmission,vec3(.19,.2,.12),attenuation*clarity*.65);
    // Forward-scattered light illuminates thin crests, rather than lighting the whole sea.
    float forward=pow(max(dot(view,-sunDirection),0.),5.);
    float crest=smoothstep(.0,max(.1,heightScale*.42),world.y);
    transmission+=vec3(.018,.16,.13)*crest*forward*(storm>.5?.35:.7);
    vec3 color=mix(transmission,reflected,fresnel);
    vec3 halfVector=normalize(view+sunDirection);float nl=max(dot(n,sunDirection),.001),nh=max(dot(n,halfVector),0.),vh=max(dot(view,halfVector),0.);
    float alpha=.018+wind*.0013,a2=alpha*alpha,denom=nh*nh*(a2-1.)+1.;
    float d=a2/(PI*denom*denom),gv=2.*nv/(nv+sqrt(a2+(1.-a2)*nv*nv)),gl=2.*nl/(nl+sqrt(a2+(1.-a2)*nl*nl));
    float f=.02037+.97963*pow(1.-vh,5.);
    color+=vec3(1.,.92,.8)*min(10.,d*gv*gl*f/(4.*nv))*(storm>.5?.07:.55);
    vec4 fdata=field(materialPoint);
    // Coherent metre-scale foam patches and elongated downwind trails, never
    // independent white dots seeded by every capillary wave.
    vec2 foamPosition=materialPoint-windDirection*wind*time*.025+vec2(realization*.019);
    // Wind gives a preferred drift, while local wave gradients and coherent eddies
    // rotate and curl individual patches. Multiple scales prevent parallel stamps.
    float localAngle=atan(tx.y,tz.y);
    float windAngle=atan(windDirection.y,windDirection.x);
    float eddy=noise(foamPosition*.008+vec2(time*.008,-time*.006))*2.-1.;
    float angle=windAngle+eddy*1.55+sin(localAngle-windAngle)*.75;
    vec2 localDirection=vec2(cos(angle),sin(angle));
    vec2 streak=vec2(dot(foamPosition,vec2(localDirection.y,-localDirection.x))*.13,dot(foamPosition,localDirection)*.045);
    streak+=vec2(noise(foamPosition*.031),noise(foamPosition*.024+13.))*1.1;
    float patches=noise(streak)*.42+noise(foamPosition*.09)*.38+noise(foamPosition*.8)*.20;
    float fresh=(1.-smoothstep(.18,.55,primaryJacobian))*smoothstep(max(.01,heightScale*.10),max(.02,heightScale*.32),world.y);
    float coverage=clamp(smoothstep(.04,.40,fdata.a)*.62+fresh*.18,0.,.8);
    float foam=smoothstep(1.-coverage-.08,1.-coverage+.08,smoothstep(.20,.80,patches))*smoothstep(0.,.05,coverage);
    float bubbleDetail=mix(.5,noise(materialPoint*90.),exp(-footprint*90.));
    vec3 foamColor=(sky(vec3(0,1,0))*.50+vec3(.15,.16,.15))*(.62+.38*max(n.y,0.))*(.92+.16*bubbleDetail);
    foamColor+=vec3(1.,.94,.85)*nl*.08;
    color=mix(color,foamColor,foam*.95);
    float fog=1.-exp(-length(cameraPosition-world)*(storm>.5?.0008:.0003));
    color=mix(color,haze,min(fog,.98));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;
