import { constrainSettings, type SimulationSettings } from './system';

export interface SpectralBand { length:number; size:number; seed:Float32Array; variance:number }
/** Disjoint wavenumber bands; S(omega) d omega d theta is transformed to Cartesian k-space. */
export function createSpectralBands(settings:SimulationSettings,size=256):SpectralBand[]{
    const s=constrainSettings(settings),base=s.kind==='lake'?1024:s.kind==='great-river'?2048:3072;
    const lengths=[base,base/8,base/64],wp=2*Math.PI/s.period,gamma=1+2.3*Math.min(s.wind/12,1);
    const variation=Math.max(0,Math.min(1,s.variability??.7));
    let seed=(s.realization??731942)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
    const gaussian=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
    const direction=s.direction*Math.PI/180;
    const crossing=(random()>.5?1:-1)*(.65+random()*.45);
    // Independent wind sea, short wind sea, oblique swell and cross sea. Normalize each
    // lobe before combining so random realization never changes specified Hs.
    const lobes=[{share:1-.384*variation,peak:wp,angle:direction,spread:4,gamma},
        {share:.06*variation,peak:wp*(1.65+random()*.25),angle:direction-crossing*.45,spread:1.8,gamma:1.4},
        {share:.22*variation,peak:wp*(.60+random()*.12),angle:direction+crossing,spread:10,gamma:3.3},
        {share:.10*variation,peak:wp*(1.08+random()*.18),angle:direction-crossing*1.25,spread:3,gamma:1.6},
        {share:.004*variation,peak:wp*2.6,angle:direction+crossing*.7,spread:1.2,gamma:1}];
    const bands=lengths.map(length=>({length,size,seed:new Float32Array(size*size*4),variance:0}));
    for(const lobe of lobes){
        if(lobe.share===0)continue;
        const temporary=bands.map((band,index)=>{
            const data=new Float32Array(size*size*4),dk=2*Math.PI/band.length;
            const lower=index===0?0:2*Math.PI*size/(lengths[index-1]*8),upper=2*Math.PI*size/(band.length*8);
            let variance=0;
            for(let y=0;y<size;y++)for(let x=0;x<size;x++){
                const kx=(x<size/2?x:x-size)*dk,kz=(y<size/2?y:y-size)*dk,k=Math.hypot(kx,kz),i=(y*size+x)*4;
                if(k<Math.max(dk*.5,lower)||k>=upper)continue;
                const kh=k*s.depth,tanh=Math.tanh(kh),omega=Math.sqrt((9.81*k+.000074*k*k*k)*tanh);
                const group=(9.81*(tanh+kh*(1-tanh*tanh))+.000074*k*k*(3*tanh+kh*(1-tanh*tanh)))/(2*omega);
                const sigma=omega<=lobe.peak?.07:.09,r=Math.exp(-.5*((omega-lobe.peak)/(sigma*lobe.peak))**2);
                const spectrum=omega**-5*Math.exp(-1.25*(lobe.peak/omega)**4)*lobe.gamma**r;
                const angular=Math.max(0,(kx*Math.sin(lobe.angle)+kz*Math.cos(lobe.angle))/k)**(omega<lobe.peak?lobe.spread:lobe.spread*.45);
                // This height-field renderer cannot resolve breaking of steep short waves.
                // Regularize its high-frequency geometric tail; centimetre-scale
                // wind ripples are shaded separately, rather than metre-high spikes.
                const resolvedTail=Math.exp(-Math.pow(omega/(wp*4.),4));
                const weight=spectrum*angular*group/k*dk*dk*resolvedTail;
                data[i]=gaussian()*Math.sqrt(weight*.5);data[i+1]=gaussian()*Math.sqrt(weight*.5);
                variance+=2*(data[i]**2+data[i+1]**2);
            }return {data,variance};
        });
        const total=temporary.reduce((sum,b)=>sum+b.variance,0),gain=total>0?Math.sqrt(lobe.share/total):0;
        temporary.forEach((part,b)=>{for(let i=0;i<part.data.length;i+=4){bands[b].seed[i]+=part.data[i]*gain;bands[b].seed[i+1]+=part.data[i+1]*gain;}});
    }
    bands.forEach(b=>{for(let i=0;i<b.seed.length;i+=4)b.variance+=2*(b.seed[i]**2+b.seed[i+1]**2);});
    const total=bands.reduce((sum,b)=>sum+b.variance,0),scale=total>0?s.waveHeight/(4*Math.sqrt(total)):0;
    for(const band of bands){
        const data=band.seed;
        for(let i=0;i<data.length;i+=4){data[i]*=scale;data[i+1]*=scale;}
        band.variance*=scale*scale;
        // Pack h0(k), conjugate h0(-k). Hermitian evolution guarantees a real water surface.
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
            const i=(y*size+x)*4,j=(((size-y)%size)*size+(size-x)%size)*4;
            data[i+2]=data[j];data[i+3]=-data[j+1];
        }
    }
    return bands;
}
/** Unnormalized inverse transform: inputs already encode physical Fourier amplitudes in metres. */
export function inverseFFT(real:Float64Array,imag:Float64Array){
    const n=real.length;
    if(n!==imag.length||(n&(n-1))!==0)throw new Error('FFT size must be a power of two');
    for(let i=1,j=0;i<n;i++){
        let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
        if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}
    }
    for(let length=2;length<=n;length*=2){
        const half=length/2;
        for(let base=0;base<n;base+=length)for(let j=0;j<half;j++){
            const angle=2*Math.PI*j/length,c=Math.cos(angle),s=Math.sin(angle),a=base+j,b=a+half;
            const tr=real[b]*c-imag[b]*s,ti=real[b]*s+imag[b]*c;
            real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
        }
    }
}
