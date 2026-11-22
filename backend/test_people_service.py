import io
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from people_service import app, MODELS, recognize_image, overlap

ROOT = Path(__file__).resolve().parents[1]

class PeopleServiceTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_invalid_image(self):
        response = self.client.post('/recognize', files={'file': ('bad.jpg', b'not-an-image', 'image/jpeg')})
        self.assertEqual(response.status_code, 422)

    def test_overlapping_boxes(self):
        self.assertEqual(overlap([0,0,20,20], [0,0,20,20]), 1)
        self.assertEqual(overlap([0,0,20,20], [30,30,20,20]), 0)

    @unittest.skipUnless((MODELS / 'sface.onnx').exists(), 'run npm run people:setup for real model tests')
    def test_real_model_identity_and_background(self):
        import cv2
        fixture = ROOT / 'node_modules/@vladmandic/face-api/demo/sample1.jpg'
        self.assertTrue(fixture.exists(), 'install npm dependencies first')
        image = cv2.imread(str(fixture))
        first = image[180:900, 300:730]
        second = image[110:960, 1280:1830]
        changed = np.minimum(first.astype(np.float32) * 1.1, 255).astype(np.uint8)
        results = [recognize_image(item) for item in (first, changed, second)]
        self.assertTrue(all('descriptor' in result for result in results), results)
        vectors = [np.array(result['descriptor']) for result in results]
        same = np.linalg.norm(vectors[0] - vectors[1])
        different = np.linalg.norm(vectors[0] - vectors[2])
        print(f'SFace: same-person distance={same:.4f}; different-person distance={different:.4f}')
        self.assertLess(same, 0.95)
        self.assertGreater(different, 0.95)
        for item in vectors:
            self.assertAlmostEqual(float(np.linalg.norm(item)), 1, places=5)
        # Simulate a distant face in a large original and compare to its close-up.
        canvas = np.full((3000, 4000, 3), 165, dtype=np.uint8)
        small = cv2.resize(second, (260, round(second.shape[0] * 260 / second.shape[1])))
        canvas[1000:1000 + small.shape[0], 1850:2110] = small
        distant = recognize_image(canvas)
        self.assertIn('descriptor', distant)
        distant_distance = np.linalg.norm(np.array(distant['descriptor']) - vectors[2])
        self.assertLess(distant_distance, 0.95, 'original-crop landmark refinement must keep the same identity')
        print(f'SFace distant vs portrait distance={distant_distance:.4f}')
        self.assertIn('reason', recognize_image(image), 'similarly sized faces must remain manual')
        blank = np.full((600,800,3), 128, dtype=np.uint8)
        self.assertIn('reason', recognize_image(blank))
        output = io.BytesIO()
        Image.fromarray(cv2.cvtColor(first, cv2.COLOR_BGR2RGB)).save(output, format='JPEG')
        response = self.client.post('/recognize', files={'file': ('portrait.jpg', output.getvalue(), 'image/jpeg')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['descriptor']), 128)
        self.assertTrue(self.client.get('/health').json()['ready'])

if __name__ == '__main__':
    unittest.main()
