import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({entryPoints:['src/pages/river/system.ts'],bundle:true,format:'esm',platform:'node',write:false});
const { environments,settingsFor,buildSpectrum,sampleSurface,waveNumber,constrainSettings,waveLimit,currentSpeed,seaStateSettings,seaStates }=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
for(const env of environments){
    const s=settingsFor(env.id),waves=buildSpectrum(s);
    const variance=waves.reduce((sum,w)=>sum+w.amplitude*w.amplitude/2,0);
    assert.ok(Math.abs(4*Math.sqrt(variance)-constrainSettings(s).waveHeight)<1e-9,'Spectrum must satisfy Hs = 4 sqrt(m0)');
    for(const wave of waves){
        assert.ok(Math.abs(9.81*wave.k*Math.tanh(wave.k*s.depth)-wave.omega**2)<1e-8,'Finite-depth dispersion');
        assert.ok(Math.abs(Math.hypot(wave.dx,wave.dz)-1)<1e-10,'Unit propagation vector');
    }
    const slope=waves.reduce((sum,w)=>sum+w.horizontal*w.amplitude*w.k,0);
    assert.ok(slope<=.720000001,'Gerstner displacement must not fold the surface');
    for(let t=0;t<60;t+=.2){
        const sample=sampleSurface(waves,Math.sin(t)*env.width*.1,Math.cos(t)*env.length*.1,t,currentSpeed(s));
        assert.ok(Object.values(sample).every(Number.isFinite),'All wave samples finite');
        assert.ok(sample.jacobian>0,'Conservative horizontal Jacobian bound positive');
    }
    const constrained=constrainSettings({...s,waveHeight:100,period:env.periodRange[0],depth:env.depthRange[0]});
    assert.ok(constrained.waveHeight<=waveLimit(constrained)+1e-9,'Impossible wave steepness/depth must be constrained');
    console.log(`PASS ${env.id}: Hs=${(4*Math.sqrt(variance)).toFixed(3)} m, ${waves.length} directions, stable 60 s sampling`);
}
const period=10,deep=waveNumber(period,5000),expected=(2*Math.PI/period)**2/9.81;
assert.ok(Math.abs(deep/expected-1)<1e-8,'Deep-water limit');
const shallow=waveNumber(period,.1),speed=(2*Math.PI/period)/shallow;
assert.ok(Math.abs(speed/Math.sqrt(9.81*.1)-1)<.001,'Shallow-water limit');
const calm=buildSpectrum({...settingsFor('ocean'),waveHeight:0});assert.ok(calm.every(w=>w.amplitude===0),'Zero wave height means a level spectral surface');
console.log('PASS dispersion limits, calm water, steepness coupling, variance normalization');

for(const env of environments){
 const base=settingsFor(env.id),calm=seaStateSettings({...base,playing:false},'平静');
 assert.equal(calm.waveHeight,0);assert.equal(calm.wind,0);assert.equal(calm.choppiness,0);assert.equal(calm.playing,false);
 let previous=-1;
 for(const state of seaStates){const preset=seaStateSettings(base,state);assert.ok(preset.waveHeight>previous);previous=preset.waveHeight;assert.ok(preset.waveHeight<=waveLimit(preset)+1e-8);assert.ok(preset.period>=env.periodRange[0]&&preset.period<=env.periodRange[1]);}
}
const storm=seaStateSettings(settingsFor('storm'),'风暴'),lambda=2*Math.PI/waveNumber(storm.period,storm.depth);
assert.ok(storm.waveHeight/lambda>.08,'Storm preset must be a steep wind sea, not a gentle long swell');
console.log('PASS ordered physical sea states, flat calm water, paused-state preservation and storm steepness');
