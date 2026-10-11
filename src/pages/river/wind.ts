import * as THREE from 'three';
export function windState(){return {time:{value:0},speed:{value:0},direction:{value:new THREE.Vector2(0,1)}};}
export type WindState=ReturnType<typeof windState>;
/** Root-anchored wind bending. Spatial gust phase prevents synchronous whole-forest sway. */
export function vegetationWind(material:THREE.Material,state:WindState,height:number,grass=false){
    material.onBeforeCompile=shader=>{
        shader.uniforms.vegetationTime=state.time;shader.uniforms.vegetationSpeed=state.speed;shader.uniforms.vegetationDirection=state.direction;
        shader.vertexShader=`uniform float vegetationTime;uniform float vegetationSpeed;uniform vec2 vegetationDirection;\n`+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
        #ifdef USE_INSTANCING
            mat3 vegetationFrame=mat3(modelMatrix*instanceMatrix);
            vec3 vegetationRoot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
            float tip=clamp(transformed.y/${Math.max(height,.001).toFixed(6)},0.,1.);
            float physicalHeight=length(vegetationFrame[1])*${Math.max(height,.001).toFixed(6)};
            float phase=dot(vegetationRoot.xz,vec2(.067,.039));
            float gust=.65+.23*sin(vegetationTime*.71-phase)+.12*sin(vegetationTime*1.43+phase*2.7);
            float pressure=pow(vegetationSpeed/20.,2.);pressure=pressure/(1.+pressure);
            float sway=.65+.35*sin(vegetationTime*${grass?'2.1':'.82'}+phase*1.6);
            float bend=physicalHeight*${grass?'.65':'.16'}*pressure*gust*sway*tip*tip;
            vec2 crosswind=vec2(vegetationDirection.y,-vegetationDirection.x);
            vec2 offset=vegetationDirection*bend+crosswind*bend*.18*sin(phase+vegetationTime*1.2);
            float flutter=sin(vegetationTime*${grass?'8.3':'5.4'}+position.x*12.+position.z*9.+phase)*physicalHeight*.012*sqrt(pressure)*tip*tip;
            offset+=crosswind*flutter;
            vec3 windOffset=vec3(offset.x,-physicalHeight*.015*pressure*tip*tip,offset.y);
            transformed+=vec3(dot(windOffset,vegetationFrame[0])/dot(vegetationFrame[0],vegetationFrame[0]),dot(windOffset,vegetationFrame[1])/dot(vegetationFrame[1],vegetationFrame[1]),dot(windOffset,vegetationFrame[2])/dot(vegetationFrame[2],vegetationFrame[2]));
        #endif
        #include <project_vertex>`);
    };
    material.customProgramCacheKey=()=>`river-wind-${height}-${grass}`;material.needsUpdate=true;
}
