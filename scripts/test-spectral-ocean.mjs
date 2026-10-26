import assert from 'node:assert/strict';import {build} from 'esbuild';
const r=await build({entryPoints:['src/pages/river/spectralMath.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {inverseFFT,createSpectralBands}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const sr=await build({entryPoints:['src/pages/river/system.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {settingsFor}=await import('data:text/javascript;base64,'+Buffer.from(sr.outputFiles[0].text).toString('base64'));
for(const n of [8,32,256]){
 const re=Float64Array.from({length:n},(_,i)=>Math.sin(i*1.31)),im=Float64Array.from({length:n},(_,i)=>Math.cos(i*.7)),a=re.slice(),b=im.slice();inverseFFT(re,im);
 for(const j of [0,1,n/2,n-1]){let rr=0,ii=0;for(let k=0;k<n;k++){const p=2*Math.PI*j*k/n;rr+=a[k]*Math.cos(p)-b[k]*Math.sin(p);ii+=a[k]*Math.sin(p)+b[k]*Math.cos(p);}assert.ok(Math.abs(rr-re[j])<1e-9&&Math.abs(ii-im[j])<1e-9,'Inverse FFT agrees with direct Fourier sum');}
}
for(const kind of ['lake','great-river','ocean','storm']){
 const s=settingsFor(kind),bands=createSpectralBands(s,32);assert.equal(bands.length,3);
 assert.ok(Math.abs(bands.reduce((a,b)=>a+b.variance,0)-s.waveHeight**2/16)<1e-10,'Physical Hs variance across cascades');
 for(const b of bands){const n=b.size;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,j=(((n-y)%n)*n+(n-x)%n)*4;
  assert.equal(b.seed[i+2],b.seed[j]);assert.equal(b.seed[i+3],-b.seed[j+1]);assert.ok(Array.from(b.seed.subarray(i,i+4)).every(Number.isFinite));}
 // Hermitian time evolution must yield a real-valued spatial surface, at both initial and later times.
 for(const time of [0,9.7]){const re=new Float64Array(n*n),im=new Float64Array(n*n),dk=2*Math.PI/b.length;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,k=Math.hypot((x<n/2?x:x-n)*dk,(y<n/2?y:y-n)*dk),p=Math.sqrt((9.81*k+.000074*k**3)*Math.tanh(k*s.depth))*time,c=Math.cos(p),sn=Math.sin(p);
   re[y*n+x]=(b.seed[i]+b.seed[i+2])*c+(b.seed[i+1]-b.seed[i+3])*sn;im[y*n+x]=(b.seed[i+1]+b.seed[i+3])*c+(b.seed[i+2]-b.seed[i])*sn;}
  for(let y=0;y<n;y++)inverseFFT(re.subarray(y*n,(y+1)*n),im.subarray(y*n,(y+1)*n));
  for(let x=0;x<n;x++){const a=Float64Array.from({length:n},(_,y)=>re[y*n+x]),c=Float64Array.from({length:n},(_,y)=>im[y*n+x]);inverseFFT(a,c);assert.ok(c.every(v=>Math.abs(v)<1e-8),'Spatial field imaginary residual vanishes');}
 }
 }
 console.log(`PASS ${kind}: normalized three-band spectrum, conjugate pairs and real inverse transforms`);
}
const calm=createSpectralBands({...settingsFor('ocean'),waveHeight:0});assert.ok(calm.every(b=>b.seed.every(v=>v===0)));
console.log('PASS direct DFT equivalence at 8/32/256 samples, calm water');

const example={...settingsFor('storm'),waveHeight:18,period:11.5};
const realizations=[731942,1928301,48201823];
for(const variability of [0,.7,1]){
 const fields=realizations.map(realization=>createSpectralBands({...example,variability,realization}));
 for(const bands of fields)assert.ok(Math.abs(bands.reduce((sum,b)=>sum+b.variance,0)-18**2/16)<1e-8,'Hs preserved across crossing-wave mixtures and random seeds');
 assert.ok(fields[0][0].seed.some((v,i)=>Math.abs(v-fields[1][0].seed[i])>1e-5),'Distinct seed gives a genuinely different wave field');
 const repeated=createSpectralBands({...example,variability,realization:realizations[0]});assert.deepEqual(repeated[0].seed,fields[0][0].seed,'Fixed seed reproduces wave field');
}
console.log('PASS seeded repeatability, distinct realizations, mixed-spectrum energy normalization');
// The old 1024 m domain repeated inside the 2600 m sea. Check physical
// translation correlation, rather than merely counting different seeds.
const oceanBands=createSpectralBands({...example,variability:1});
function spatialCorrelation(bands,shift){let covariance=0,energy=0;for(const b of bands){const n=b.size,dk=2*Math.PI/b.length;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,w=2*(b.seed[i]**2+b.seed[i+1]**2);energy+=w;covariance+=w*Math.cos((x<n/2?x:x-n)*dk*shift);}}return covariance/energy;}
assert.ok(oceanBands[0].length>2600,'Longest sea period exceeds visible sea extent');
for(const shift of [1024,2048])assert.ok(Math.abs(spatialCorrelation(oceanBands,shift))<.25,'No strong correlation at former texture tile offsets');
console.log('PASS former 1024/2048 m tile offsets have low spatial correlation');
// Short waves must not dominate the resolved surface slope, even though their
// contribution to height variance is small. This previously produced spikes.
const resolvedStorm=createSpectralBands({...example,wind:30});
const slopeMoments=resolvedStorm.map(b=>{let m2=0;for(let y=0;y<b.size;y++)for(let x=0;x<b.size;x++){const i=(y*b.size+x)*4,k2=((x<b.size/2?x:x-b.size)**2+(y<b.size/2?y:y-b.size)**2)*(2*Math.PI/b.length)**2;m2+=2*(b.seed[i]**2+b.seed[i+1]**2)*k2;}return m2;});
assert.ok(Math.sqrt(slopeMoments.reduce((a,b)=>a+b,0))<.35,'Resolved storm RMS slope stays bounded');
assert.ok(slopeMoments[2]<slopeMoments[0]*.5,'Finest geometric cascade cannot dominate long-wave slope');
console.log(`PASS resolved storm RMS slope ${Math.sqrt(slopeMoments.reduce((a,b)=>a+b,0)).toFixed(3)}, short-wave spike suppression`);
