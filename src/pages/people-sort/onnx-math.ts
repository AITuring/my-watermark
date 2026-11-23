// YuNet output decoding and SFace alignment follow OpenCV's model conventions.
// Sources and licenses: public/models/people-sort/onnx and docs/people-sort-local.md.
export interface OnnxFace { x: number; y: number; width: number; height: number; points: number[]; score: number }
type Outputs = Record<string, { data: ArrayLike<number> }>;
export function intersection(a: OnnxFace, b: OnnxFace) {
    const area = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
        Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return area / Math.max(1, a.width * a.height + b.width * b.height - area);
}
export function suppress(faces: OnnxFace[], threshold = 0.3) {
    const result: OnnxFace[] = [];
    for (const face of [...faces].sort((a, b) => b.score - a.score).slice(0, 5000)) {
        if (result.every(other => intersection(face, other) <= threshold)) result.push(face);
    }
    return result;
}
export function decodeYuNet(outputs: Outputs, size = 640): OnnxFace[] {
    const faces: OnnxFace[] = [];
    for (const stride of [8, 16, 32]) {
        const cls = outputs[`cls_${stride}`]?.data, obj = outputs[`obj_${stride}`]?.data;
        const boxes = outputs[`bbox_${stride}`]?.data, points = outputs[`kps_${stride}`]?.data;
        if (!cls || !obj || !boxes || !points) throw new Error('YuNet 模型输出格式不匹配');
        const cols = size / stride;
        for (let i = 0; i < cls.length; i++) {
            const score = Math.sqrt(Math.min(1, Math.max(0, cls[i])) * Math.min(1, Math.max(0, obj[i])));
            if (score < 0.75) continue;
            const col = i % cols, row = Math.floor(i / cols);
            const width = Math.exp(boxes[i * 4 + 2]) * stride, height = Math.exp(boxes[i * 4 + 3]) * stride;
            const x = (col + boxes[i * 4]) * stride - width / 2, y = (row + boxes[i * 4 + 1]) * stride - height / 2;
            const landmarks = Array.from({ length: 10 }, (_, n) => (points[i * 10 + n] + (n % 2 ? row : col)) * stride);
            if ([x,y,width,height, ...landmarks].every(Number.isFinite)) faces.push({ x,y,width,height,points:landmarks,score });
        }
    }
    return suppress(faces);
}
export const FACE_TEMPLATE = [38.2946,51.6963,73.5318,51.5014,56.0252,71.7366,41.5493,92.3655,70.7299,92.2041];
// Least-squares orientation-preserving similarity transform: x'=a*x-b*y+tx.
export function similarity(points: number[]) {
    if (points.length !== 10 || !points.every(Number.isFinite)) throw new Error('人脸关键点无效');
    let sx=0,sy=0,dx=0,dy=0;
    for(let i=0;i<10;i+=2){sx+=points[i]/5;sy+=points[i+1]/5;dx+=FACE_TEMPLATE[i]/5;dy+=FACE_TEMPLATE[i+1]/5;}
    let dot=0,cross=0,variance=0;
    for(let i=0;i<10;i+=2){const x=points[i]-sx,y=points[i+1]-sy,u=FACE_TEMPLATE[i]-dx,v=FACE_TEMPLATE[i+1]-dy;dot+=x*u+y*v;cross+=x*v-y*u;variance+=x*x+y*y;}
    if(variance<1e-8) throw new Error('人脸关键点退化');
    const a=dot/variance,b=cross/variance;
    if(a*a+b*b<1e-10) throw new Error('无法对齐人脸');
    return {a,b,tx:dx-a*sx+b*sy,ty:dy-b*sx-a*sy};
}
export function planarRGB(data: Uint8ClampedArray, bgr = false) {
    const count = data.length / 4; const result = new Float32Array(count * 3);
    for(let i=0;i<count;i++){result[i]=data[i*4+(bgr?2:0)];result[i+count]=data[i*4+1];result[i+count*2]=data[i*4+(bgr?0:2)];}
    return result;
}
export function normalizeFeature(data: ArrayLike<number>) {
    const values = Array.from(data);
    const norm = Math.sqrt(values.reduce((sum,v)=>sum+v*v,0));
    if(values.length !== 128 || !values.every(Number.isFinite) || norm<1e-8) throw new Error('SFace 返回无效特征');
    return values.map(v=>v/norm);
}
