import * as THREE from 'three';
import { center, breadth, LENGTH, NX, NZ, type RiverPhysics } from './physics';
import { currentSpeed, waveNumber, type SimulationSettings } from './system';
/** Separate floating debris; leaf patterns photographed into the bed material stay on the bed. */
export function floatingLeaves(scene:THREE.Scene,physics:RiverPhysics,scaleX:number,scaleZ:number){
    const count=60,geometry=new THREE.BufferGeometry();
    const vertices=[0,.007,0];for(let i=0;i<=14;i++){const a=i/14*Math.PI*2;vertices.push(Math.cos(a)*.045,0,Math.sin(a)*.085);}
    const ids:number[]=[];for(let i=1;i<=14;i++)ids.push(0,i,i+1);
    const uv:number[]=[];for(let i=0;i<vertices.length;i+=3)uv.push(vertices[i]/.09+.5,vertices[i+2]/.17+.5);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(ids);geometry.computeVertexNormals();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#80643b';ctx.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const grain=Math.sin(x*12.7+y*31.3)*43758.54;const shade=48+Math.floor((grain-Math.floor(grain))*48);ctx.fillStyle=`rgb(${shade+35},${shade+15},${shade})`;ctx.fillRect(x,y,2,2);}
    ctx.strokeStyle='#423c24';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,128);ctx.stroke();
    ctx.lineWidth=.7;for(let y=16;y<118;y+=13){ctx.beginPath();ctx.moveTo(64,y);ctx.lineTo(8,y-20);ctx.moveTo(64,y);ctx.lineTo(120,y-20);ctx.stroke();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.85,side:THREE.DoubleSide});
    const mesh=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D();mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);
    let seed=9192;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const sites=Array.from({length:count},()=>({side:(rand()-.5)*1.5,z:(rand()-.5)*LENGTH*.98,yaw:rand()*6.28,scale:.6+rand()*.9,phase:rand()*6.28}));
    sites.forEach((_,i)=>mesh.setColorAt(i,new THREE.Color().setHSL(.08+(i%6)*.013,.45,.25+(i%7)*.035)));
    function update(delta:number,time:number,s:SimulationSettings){
        const speed=currentSpeed(s),direction=s.direction*Math.PI/180,k0=waveNumber(s.period,s.depth);
        for(let i=0;i<count;i++){
            const leaf=sites[i];leaf.z+=delta*(speed+s.wind*.018*Math.cos(direction))/scaleZ;
            leaf.side+=delta*s.wind*.018*Math.sin(direction)/(breadth(leaf.z)*scaleX);leaf.side=Math.max(-.86,Math.min(.86,leaf.side));
            if(leaf.z>LENGTH*.49)leaf.z=-LENGTH*.49;if(leaf.z<-LENGTH*.49)leaf.z=LENGTH*.49;
            const x=(center(leaf.z)+leaf.side*breadth(leaf.z))*scaleX,z=leaf.z*scaleZ;
            const gx=Math.min(NX-1,Math.max(0,Math.floor((leaf.side*.5+.5)*NX))),gz=Math.min(NZ-1,Math.max(0,Math.floor((leaf.z/LENGTH+.5)*NZ)));
            let height=physics.height[gz*NX+gx],waves=0,energy=0;
            for(let j=0;j<8;j++){const w=Math.exp(-Math.pow((j-3)/2,2)),angle=direction+Math.sin(j*2.399+1.7+(s.realization%10000)*.037)*(.08+s.variability*.6),k=k0*(.55+j*.18),omega=Math.sqrt((9.81*k+.000074*k**3)*Math.tanh(k*s.depth));
                waves+=w*Math.sin((x*Math.sin(angle)+z*Math.cos(angle))*k-(omega+k*Math.cos(angle)*speed)*time+j*j*1.731+Math.sin((s.realization%10000)*.13+j*19.17)*3.14);energy+=w*w;}
            height+=waves*s.waveHeight*.5/Math.sqrt(2*energy);
            for(let j=0;j<6;j++){const k=5+j*4.8,dx=Math.sin(j*2.4+.5)*.65,den=Math.hypot(dx,1),omega=Math.sqrt((9.81*k+.000074*k**3)*Math.tanh(k*s.depth));height+=(.0015+s.wind*.0015)/(1+j*.7)*Math.sin((x*dx/den+z/den)*k-(omega+k/den*speed)*time+j*4);}
            dummy.position.set(x,height+.017,z);dummy.rotation.set(Math.sin(time*2+leaf.phase)*.07,leaf.yaw+time*speed*.1,Math.sin(time*1.4+leaf.phase)*.1);dummy.scale.setScalar(leaf.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        }mesh.instanceMatrix.needsUpdate=true;
    }
    return {update,dispose(){scene.remove(mesh);geometry.dispose();material.dispose();texture.dispose();}};
}
