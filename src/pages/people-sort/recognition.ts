import { primaryFace, faceCrop } from './detection';
let loading: Promise<typeof import('@vladmandic/face-api')> | undefined;
export function loadRecognition() {
    if (!loading) loading = (async () => {
        const api = await import('@vladmandic/face-api');
        const tf = api.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
        if (!await tf.setBackend('webgl')) throw new Error('WebGL 初始化失败');
        await tf.ready();
        const base = `${import.meta.env.BASE_URL}models/people-sort`;
        await Promise.all([
            api.nets.ssdMobilenetv1.loadFromUri(base),
            api.nets.faceLandmark68Net.loadFromUri(base),
            api.nets.faceRecognitionNet.loadFromUri(base),
        ]);
        return api;
    })().catch(error => { loading = undefined; throw error; });
    return loading;
}
export async function recognize(url: string, api: Awaited<ReturnType<typeof loadRecognition>>) {
    const image = new Image();
    const canvas = document.createElement('canvas');
    const crop = document.createElement('canvas');
    image.src = url;
    try {
        await image.decode();
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
        const options = new api.SsdMobilenetv1Options({ minConfidence: 0.5 });
        let faces: { score: number; box: { x: number; y: number; width: number; height: number; right: number; bottom: number } }[] = await api.detectAllFaces(canvas, options);
        // SSD resizes its input internally. Overlapping tiles increase the relative
        // size of a distant face without allocating the entire original at full size.
        if (!faces.length) {
            const tileWidth = Math.ceil(canvas.width * 0.4);
            const tileHeight = Math.ceil(canvas.height * 0.4);
            const found: typeof faces = [];
            for (const x of [0, Math.round((canvas.width - tileWidth) / 2), canvas.width - tileWidth]) {
                for (const y of [0, Math.round((canvas.height - tileHeight) / 2), canvas.height - tileHeight]) {
                    crop.width = tileWidth; crop.height = tileHeight;
                    crop.getContext('2d')!.drawImage(canvas, x, y, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
                    const local = await api.detectAllFaces(crop, options);
                    for (const face of local) {
                        const box = new api.Rect(face.box.x + x, face.box.y + y, face.box.width, face.box.height);
                        const duplicate = found.some(other => {
                            const overlapWidth = Math.max(0, Math.min(box.right, other.box.right) - Math.max(box.x, other.box.x));
                            const overlapHeight = Math.max(0, Math.min(box.bottom, other.box.bottom) - Math.max(box.y, other.box.y));
                            return overlapWidth * overlapHeight / Math.min(box.width * box.height, other.box.width * other.box.height) > 0.5;
                        });
                        if (!duplicate) found.push({ score: face.score, box });
                    }
                }
            }
            faces = found;
        }
        if (!faces.length) return { reason: '未检测到人脸（可能是背影、遮挡或过小）' };
        const subject = primaryFace(faces);
        if (!subject) return { reason: '多张相近大小的人脸，无法确定主体' };
        // Judge detail in the original, not the downscaled full-photo preview.
        const originalBox = { x: subject.box.x / scale, y: subject.box.y / scale,
            width: subject.box.width / scale, height: subject.box.height / scale };
        if (Math.min(originalBox.width, originalBox.height) < 32) return { reason: '原图人脸细节不足（小于 32 像素）' };
        const region = faceCrop(originalBox, image.naturalWidth, image.naturalHeight);
        const cropScale = Math.min(2, 640 / Math.max(region.width, region.height));
        crop.width = Math.max(1, Math.round(region.width * cropScale));
        crop.height = Math.max(1, Math.round(region.height * cropScale));
        crop.getContext('2d')!.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, crop.width, crop.height);
        const result = await api.detectSingleFace(crop, options).withFaceLandmarks().withFaceDescriptor();
        if (!result) return { reason: '主体人脸精细识别失败' };
        return { descriptor: Array.from(result.descriptor) };
    } finally { canvas.width = 0; canvas.height = 0; crop.width = 0; crop.height = 0; image.src = ''; }
}
