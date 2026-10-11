import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['src/pages/river/physics.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { RiverPhysics, defaults, meanSpeed, WIDTH, DX, DZ } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
for (const settings of [defaults, { ...defaults, depth: .3, discharge: 10 }, { ...defaults, depth: 1.2, discharge: 1 }]) {
    const solver = new RiverPhysics();
    solver.splash(0, 0);
    const initialMass = solver.height.reduce((sum, height) => sum + height, 0) * DX * DZ;
    assert.ok(Math.abs(initialMass) < 1e-5, 'A drop must displace water without adding net volume');
    let peak = 0;
    for (let frame = 0; frame < 1200; frame++) {
        solver.advance(1 / 60, settings);
        for (let i = 0; i < solver.height.length; i++) {
            const height = solver.height[i];
            assert.ok(Number.isFinite(height), 'Height must remain finite');
            if (solver.solid[i]) assert.equal(height, 0, 'Water cannot enter solid cells');
            peak = Math.max(peak, Math.abs(height));
        }
    }
    assert.ok(peak < .09, 'Unforced wave amplitude must remain bounded');
    assert.ok(Math.max(...solver.height.map(Math.abs)) < .001, 'Friction and open ends must dissipate the disturbance');
    solver.reset();
    assert.ok(solver.height.every(h => h === 0));
    assert.equal(solver.time, 0);
    console.log(`PASS 20 seconds: depth ${settings.depth} m, discharge ${settings.discharge} m³/s, peak ${peak.toFixed(4)} m`);
}
assert.ok(Math.abs(meanSpeed(defaults) * WIDTH * defaults.depth * (0.35 + 0.65 * 2 / 3) - defaults.discharge) < 1e-10, 'Mean velocity must satisfy Q = UA');
for(const [width,length,depth,discharge] of [[3,36,.2,5],[12,64,2,14]]){
    const solver=new RiverPhysics(width,length),settings={...defaults,depth,discharge};
    solver.splash(width*.45,length*.48,.025);
    const volume=solver.height.reduce((a,h)=>a+h,0)*solver.dx*solver.dz;
    assert.ok(Math.abs(volume)<1e-7,'Mapped-grid drop near banks must have zero net volume');
    for(let frame=0;frame<300;frame++)solver.advance(1/60,settings);
    assert.ok(solver.height.every(h=>Number.isFinite(h)&&Math.abs(h)<.03),'Physical-size extreme flow remains stable');
    console.log(`PASS mapped ${width} × ${length} m grid: bounded extreme flow, near-bank volume`);
}
console.log('PASS zero-volume disturbance, solid boundary, discharge-area relation, reset');
