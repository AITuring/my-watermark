import * as THREE from 'three';
import { vegetationWind, type WindState } from './wind';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export interface TreeSite {x:number;y:number;z:number;height:number}
/** Instanced photographic pine meshes; each variant keeps its original branch topology and PBR UVs. */
export function forest(parent:THREE.Object3D,sites:TreeSite[],onReady?:()=>void,wind?:WindState){
    let disposed=false;const group=new THREE.Group();parent.add(group);
    const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures=new Set<THREE.Texture>();
    new GLTFLoader().load('/river/tree/tree.gltf',gltf=>{
        gltf.scene.updateMatrixWorld(true);
        const sourceMeshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){sourceMeshes.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}});
        if(!disposed){
            const variants=gltf.scene.children;
            // Spatial batches let the renderer reject whole woodland tiles outside the view.
            const chosen=sites;
            let seed=4181;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
            const placements=chosen.map(site=>({site,yaw:rand()*Math.PI*2,aspect:.7+rand()*.35}));
            variants.forEach((variant,vi)=>{
                const box=new THREE.Box3().setFromObject(variant),height=box.max.y-box.min.y,center=box.getCenter(new THREE.Vector3());
                const variantSites=placements.filter((_,i)=>i%variants.length===vi),dummy=new THREE.Object3D();
                for(const distant of [false,true]){
                const selected=variantSites.filter(({site})=>(Math.hypot(site.x,site.z)>130)===distant);if(!selected.length)continue;
                const tiles=new Map<string,typeof selected>();
                for(const place of selected){const key=`${Math.floor(place.site.x/80)}:${Math.floor(place.site.z/80)}`;const tile=tiles.get(key)||[];tile.push(place);tiles.set(key,tile);}
                variant.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
                    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1/height,1/height,1/height);
                    if(distant&&geometry.attributes.position.count>1000)sparseNeedles(geometry);
                    const material=(Array.isArray(o.material)?o.material[0]:o.material).clone() as THREE.MeshStandardMaterial;
                    if(wind)vegetationWind(material,wind,1);material.envMapIntensity=1;geometries.push(geometry);materials.push(material);
                    for(const batch of tiles.values()){const instances=new THREE.InstancedMesh(geometry,material,batch.length);
                    batch.forEach(({site,yaw,aspect},i)=>{dummy.position.set(site.x,site.y,site.z);dummy.rotation.set(0,yaw,0);dummy.scale.set(site.height*aspect,site.height,site.height*aspect);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);});
                    if(wind){const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});vegetationWind(depthMaterial,wind,1);instances.customDepthMaterial=depthMaterial;materials.push(depthMaterial);}
                    instances.castShadow=true;instances.receiveShadow=true;instances.computeBoundingSphere();group.add(instances);}
                });
                }
            });
        }
        if(!disposed)onReady?.();
        sourceMeshes.forEach(m=>{m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());});
        if(disposed)textures.forEach(t=>t.dispose());
    },undefined,error=>console.error('Scanned trees unavailable',error));
    return()=>{disposed=true;parent.remove(group);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
}

/** Keep complete needle islands for distant LOD, retaining all connected woody branches. */
function sparseNeedles(geometry:THREE.BufferGeometry){
    const ids=geometry.index;if(!ids)return;const n=geometry.attributes.position.count,parent=new Int32Array(n),counts=new Int32Array(n),sums=new Float64Array(n*3);
    for(let i=0;i<n;i++)parent[i]=i;
    const root=(value:number)=>{while(parent[value]!==value){parent[value]=parent[parent[value]];value=parent[value];}return value;};
    for(let i=0;i<ids.count;i+=3){const r=root(ids.getX(i));parent[root(ids.getX(i+1))]=r;parent[root(ids.getX(i+2))]=r;}
    for(let i=0;i<n;i++){const r=root(i);counts[r]++;sums[r*3]+=geometry.attributes.position.getX(i);sums[r*3+1]+=geometry.attributes.position.getY(i);sums[r*3+2]+=geometry.attributes.position.getZ(i);}
    const position=geometry.attributes.position;for(let i=0;i<n;i++){const r=root(i);if(counts[r]>35)continue;const x=sums[r*3]/counts[r],y=sums[r*3+1]/counts[r],z=sums[r*3+2]/counts[r];position.setXYZ(i,x+(position.getX(i)-x)*1.8,y+(position.getY(i)-y)*1.8,z+(position.getZ(i)-z)*1.8);}
    const indices:number[]=[];
    for(let i=0;i<ids.count;i+=3){const r=root(ids.getX(i));if(counts[r]>35||((Math.imul(r,2654435761)>>>0)%6===0))indices.push(ids.getX(i),ids.getX(i+1),ids.getX(i+2));}
    geometry.setIndex(indices);
}
