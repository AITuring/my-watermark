"""Download pinned OpenCV Zoo models; photographs are never used in setup."""
from pathlib import Path
import hashlib
import json
import urllib.request
import subprocess
import shutil

ROOT = Path(__file__).resolve().parent / 'people_models'
# Versioned filenames; git-lfs pointer supplies the expected content SHA-256.
FILES = {
    'yunet.onnx': ('face_detection_yunet', 'face_detection_yunet_2023mar.onnx', '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'),
    'sface.onnx': ('face_recognition_sface', 'face_recognition_sface_2021dec.onnx', '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79'),
}

def download():
    ROOT.mkdir(exist_ok=True)
    provenance = {}
    for name, (directory, filename, expected_digest) in FILES.items():
        relative = f'models/{directory}/{filename}'
        pointer_url = f'https://raw.githubusercontent.com/opencv/opencv_zoo/main/{relative}'
        pointer = urllib.request.urlopen(pointer_url, timeout=60).read().decode()
        digest = next(line.split('sha256:')[1] for line in pointer.splitlines() if line.startswith('oid sha256:'))
        if digest != expected_digest:
            raise RuntimeError(f'Upstream model changed: {name}; review before updating pinned hash')
        size = int(next(line.split()[1] for line in pointer.splitlines() if line.startswith('size ')))
        target = ROOT / name
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            print(f'Downloading {name} ({size / 1024 / 1024:.1f} MB)…', flush=True)
            temp = target.with_suffix('.part')
            try:
                url = f'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/{relative}'
                if shutil.which('curl'):
                    subprocess.run(['curl', '--fail', '--location', '--retry', '3', '--retry-all-errors', '--max-time', '300', '--output', str(temp), url], check=True)
                else:
                    with urllib.request.urlopen(url, timeout=120) as response:
                        temp.write_bytes(response.read())
                if temp.stat().st_size != size or hashlib.sha256(temp.read_bytes()).hexdigest() != digest:
                    raise RuntimeError(f'Model integrity check failed: {name}; bytes={temp.stat().st_size}/{size}; sha256={hashlib.sha256(temp.read_bytes()).hexdigest()}/{digest}')
                temp.replace(target)
            finally:
                temp.unlink(missing_ok=True)
        license_url = f'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/{directory}/LICENSE'
        (ROOT / f'{name}.LICENSE').write_bytes(urllib.request.urlopen(license_url, timeout=60).read())
        provenance[name] = {'sha256': digest, 'bytes': size, 'source': pointer_url}
    (ROOT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print('People recognition models verified.', flush=True)

if __name__ == '__main__':
    download()
