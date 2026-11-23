"""Loopback-only YuNet + SFace service. No uploads or descriptors are persisted."""
from pathlib import Path
from threading import Lock
import io
import warnings

import cv2
import numpy as np
from PIL import Image, ImageOps
from fastapi import FastAPI, UploadFile, File, HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

MODELS = Path(__file__).resolve().parent / 'people_models'
MODEL_ID = 'opencv-yunet-2023mar-sface-2021dec-v1'
MAX_BYTES = 64 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 90_000_000
app = FastAPI(docs_url=None, redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['localhost', '127.0.0.1', 'testserver'])
_lock = Lock()
_detector = None
_recognizer = None


def models():
    global _detector, _recognizer
    if _detector is None:
        if not all((MODELS / name).is_file() for name in ('yunet.onnx', 'sface.onnx')):
            raise HTTPException(503, '本地模型未安装，请运行 npm run people:setup')
        _detector = cv2.FaceDetectorYN.create(str(MODELS / 'yunet.onnx'), '', (320, 320), 0.75, 0.3, 5000)
        _recognizer = cv2.FaceRecognizerSF.create(str(MODELS / 'sface.onnx'), '')
    return _detector, _recognizer


@app.get('/health')
def health():
    with _lock:
        models()
    return {'ready': True, 'model': MODEL_ID, 'engine': 'YuNet + SFace', 'opencv': cv2.__version__}


def detect(image, detector):
    found = []
    height, width = image.shape[:2]
    for size in (960, 1920):
        scale = min(1.0, size / max(width, height))
        reduced = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))))
        detector.setInputSize((reduced.shape[1], reduced.shape[0]))
        _, faces = detector.detect(reduced)
        if faces is not None:
            for row in faces:
                face = row.copy()
                face[:14] /= scale
                # Keep the strongest detection when the same face appears at both scales.
                overlaps = [i for i, other in enumerate(found) if overlap(face, other) > 0.5]
                if overlaps:
                    if face[-1] > found[overlaps[0]][-1]:
                        found[overlaps[0]] = face
                else:
                    found.append(face)
        if scale == 1:
            break
    return sorted(found, key=lambda face: float(face[2] * face[3]), reverse=True)


def overlap(a, b):
    width = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    height = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    return width * height / max(1, min(a[2] * a[3], b[2] * b[3]))


def recognize_image(image):
    with _lock:
        detector, recognizer = models()
        faces = detect(image, detector)
        if not faces:
            return {'reason': 'YuNet 未检出人脸（背影、遮挡或细节不足）', 'model': MODEL_ID}
        if len(faces) > 1 and faces[0][2] * faces[0][3] < 4 * faces[1][2] * faces[1][3]:
            return {'reason': '多张相近大小的人脸，无法确定主体', 'model': MODEL_ID}
        face = faces[0]
        if min(face[2], face[3]) < 24:
            return {'reason': '原图人脸细节不足（小于 24 像素）', 'model': MODEL_ID}
        # Refine landmarks in an original-resolution subject crop. Whole-image
        # landmark estimates for a distant face are too coarse for identity alignment.
        height, width = image.shape[:2]
        padding = max(float(face[2]), float(face[3])) * 0.5
        x = max(0, int(face[0] - padding))
        y = max(0, int(face[1] - padding))
        right = min(width, int(np.ceil(face[0] + face[2] + padding)))
        bottom = min(height, int(np.ceil(face[1] + face[3] + padding)))
        region = image[y:bottom, x:right]
        scale = min(2.0, 640 / max(region.shape[:2]))
        region = cv2.resize(region, (max(1, round(region.shape[1] * scale)), max(1, round(region.shape[0] * scale))))
        detector.setInputSize((region.shape[1], region.shape[0]))
        _, refined = detector.detect(region)
        if refined is not None and len(refined):
            # Choose the detection nearest the original subject, rather than a neighbor.
            expected = np.array([(face[0] + face[2] / 2 - x) * scale, (face[1] + face[3] / 2 - y) * scale])
            candidate = min(refined, key=lambda item: float(np.linalg.norm(item[:2] + item[2:4] / 2 - expected)))
            delta = np.linalg.norm(candidate[:2] + candidate[2:4] / 2 - expected)
            if delta <= max(face[2], face[3]) * scale * 0.35:
                aligned = recognizer.alignCrop(region, candidate)
            else:
                aligned = recognizer.alignCrop(image, face)
        else:
            aligned = recognizer.alignCrop(image, face)
        feature = recognizer.feature(aligned).reshape(-1)
        norm = float(np.linalg.norm(feature))
        if not np.isfinite(feature).all() or norm < 1e-8:
            raise HTTPException(422, '人脸特征无效')
        return {'descriptor': (feature / norm).tolist(), 'model': MODEL_ID,
                'confidence': float(face[-1]), 'faceCount': len(faces)}


@app.post('/recognize')
def recognize(file: UploadFile = File(...)):
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, '单张照片超过 64 MB，请分辨率适度缩小后重试')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValueError('Unsupported image format')
                rgb = ImageOps.exif_transpose(source).convert('RGB')
                image = cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(422, '图片无法解码或尺寸过大') from exc
    return recognize_image(image)
