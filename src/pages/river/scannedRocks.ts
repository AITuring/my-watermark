import * as THREE from 'three';
import { vegetationWind, type WindState } from './wind';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export interface RockPlacement {x:number;y:number;z:number;size:number;yaw:number}
export function scannedRocks(parent:THREE.Object3D,placements:RockPlacement[],onReady:()=>void,assetUrl='/river/rock/rock.gltf',normalization:'diameter'|'natural'='diameter',alphaUrl?:string,wind?:WindState){
    let disposed=false;const owned:THREE.Object3D[]=[],textures=new Set<THREE.Texture>(),geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],refreshers:(()=>void)[]=[];
    let modelReady=false,maskReady=!alphaUrl,notified=false,alpha:THREE.Texture|null=null;
    const notify=()=>{if(!disposed&&modelReady&&maskReady&&!notified){notified=true;owned.forEach(o=>o.visible=true);onReady();}};
    if(alphaUrl)new THREE.TextureLoader().load(alphaUrl,t=>{if(disposed){t.dispose();return;}alpha=t;t.flipY=false;t.needsUpdate=true;textures.add(t);t.anisotropy=8;for(const m of materials){const mat=m as THREE.MeshStandardMaterial;mat.alphaMap=t;mat.alphaTest=.4;mat.alphaToCoverage=true;mat.needsUpdate=true;}maskReady=true;notify();},undefined,error=>console.error('Plant mask unavailable',error));
    new GLTFLoader().load(assetUrl,gltf=>{
        gltf.scene.updateMatrixWorld(true);const originals:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)originals.push(o);});
        for(const mesh of originals){
            (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>{for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);});
        }
        if(disposed){originals.forEach(m=>{m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());});textures.forEach(t=>t.dispose());return;}
        const dummy=new THREE.Object3D();
        originals.forEach((source,variant)=>{
            const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();
            const box=geometry.boundingBox!,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
            geometry.translate(-center.x,-box.min.y,-center.z);const factor=normalization==='natural'?1:2/Math.max(size.x,size.z);geometry.scale(factor,factor,factor);
            const material=(Array.isArray(source.material)?source.material[0]:source.material).clone() as THREE.MeshStandardMaterial;
            if(wind)vegetationWind(material,wind,size.y*factor,true);material.envMapIntensity=.8;material.roughness=.85;if(alphaUrl){material.alphaMap=alpha;material.alphaTest=.4;material.alphaToCoverage=true;}
            const sites=placements.filter((_,i)=>i%originals.length===variant),instances=new THREE.InstancedMesh(geometry,material,sites.length);
            const refresh=()=>{sites.forEach((site,i)=>{dummy.position.set(site.x,site.y,site.z);dummy.rotation.set(0,site.yaw,0);dummy.scale.setScalar(site.size);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);
                instances.setColorAt(i,new THREE.Color().setHSL(.1,.03,.82+(i%7)*.03));});instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();};refresh();refreshers.push(refresh);
            instances.visible=maskReady;instances.castShadow=!wind;instances.receiveShadow=true;parent.add(instances);owned.push(instances);geometries.push(geometry);materials.push(material);
            source.geometry.dispose();(Array.isArray(source.material)?source.material:[source.material]).forEach(m=>m.dispose());
        });modelReady=true;notify();
    },undefined,error=>console.error('Scanned asset unavailable',assetUrl,error));
    const dispose=()=>{disposed=true;owned.forEach(o=>parent.remove(o));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
    return Object.assign(dispose,{update:()=>refreshers.forEach(fn=>fn())});
}
