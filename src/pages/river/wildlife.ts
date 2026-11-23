import * as THREE from 'three';

export type WildlifeKind = 'creek'|'river'|'lake'|'great-river'|'ocean'|'storm';

/** Small, deliberately low-poly wildlife silhouettes to keep large waterscapes alive. */
export function wildlife(scene: THREE.Scene, kind: WildlifeKind, width: number, length: number) {
    const count = kind === 'storm' ? 4 : kind === 'ocean' ? 10 : kind === 'lake' ? 16 : 12;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -.65, 0, 0, 0, .08, .12, .65, 0, 0,
        -.65, 0, 0, 0, .08, -.12, .65, 0, 0,
    ], 3));
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({color: kind === 'storm' ? '#d7ddd6' : '#25433e', transparent: true, opacity: .78, side: THREE.DoubleSide, depthWrite: false});
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const dummy = new THREE.Object3D();
    const seed = Array.from({length: count}, (_, i) => ({
        x: (Math.sin(i * 9.17 + 1.2) * .5 + .5) * Math.min(width * .9, 1000) - Math.min(width * .9, 1000) * .5,
        z: (Math.sin(i * 5.31 + 2.4) * .5 + .5) * Math.min(length * .65, 1400) - Math.min(length * .65, 1400) * .5,
        y: kind === 'ocean' || kind === 'storm' ? 18 + (i % 4) * 7 : 5 + (i % 5) * 2.5,
        phase: i * 1.73,
        radius: kind === 'great-river' ? 1.8 : 1.2,
    }));
    const update = (time: number) => {
        seed.forEach((bird, i) => {
            const x = bird.x + Math.sin(time * .08 + bird.phase) * bird.radius * 18;
            const z = bird.z + Math.cos(time * .065 + bird.phase) * bird.radius * 24;
            const y = bird.y + Math.sin(time * .9 + bird.phase) * 1.4;
            dummy.position.set(x, y, z);
            dummy.rotation.set(Math.sin(time * 4 + bird.phase) * .06, Math.atan2(Math.cos(time * .065 + bird.phase), Math.cos(time * .08 + bird.phase)), Math.sin(time * 4 + bird.phase) * .14);
            const scale = .6 + (i % 4) * .12;
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    };
    update(0);
    return {
        update,
        dispose() { scene.remove(mesh); geometry.dispose(); material.dispose(); },
    };
}
