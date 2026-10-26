import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
/** Local CC0 HDR captures are decoded into linear radiance, with PMREM for PBR objects. */
export function photographicLight(scene:THREE.Scene,renderer:THREE.WebGLRenderer,forest:boolean,onLoad?:(texture:THREE.DataTexture)=>void,skyBackground=false){
    let background:THREE.DataTexture|null=null;
    let disposed=false,hdr:THREE.DataTexture|null=null,environment:THREE.WebGLRenderTarget|null=null;
    const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
    new RGBELoader().load(forest?'/river/forest.hdr':'/river/overcast.hdr',texture=>{
        if(disposed){texture.dispose();return;}
        hdr=texture;texture.mapping=THREE.EquirectangularReflectionMapping;
        environment=pmrem.fromEquirectangular(texture);scene.environment=environment.texture;
        if(skyBackground)new RGBELoader().load('/river/overcast.hdr',sky=>{if(disposed){sky.dispose();return;}sky.mapping=THREE.EquirectangularReflectionMapping;background=sky;scene.background=sky;});
        else scene.background=texture;
        scene.environmentIntensity=forest?1.8:1;scene.backgroundIntensity=forest?.75:.8;
        onLoad?.(texture);
    },undefined,error=>console.error('HDR environment unavailable',error));
    return()=>{disposed=true;hdr?.dispose();background?.dispose();environment?.dispose();pmrem.dispose();};
}
