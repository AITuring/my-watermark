import * as THREE from 'three';
import { ImageState, RawImage } from '../types';

export class ImagePipeline {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private texture: THREE.DataTexture | null = null;
  private canvas: HTMLCanvasElement;
  private sourceAspectRatio = 1;
  private cropRectState = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private cropEnabledState = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Initialize Renderer with high precision and float support
    this.renderer = new THREE.WebGLRenderer({
        canvas,
        preserveDrawingBuffer: true,
        antialias: false,
        powerPreference: "high-performance",
        alpha: true
    });
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 0); // Transparent clear color
    this.renderer.setPixelRatio(window.devicePixelRatio); // Handle HiDPI/Retina screens

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);

    // Professional Grade Image Processing Shader
    const fragmentShader = `
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform float exposure;
      uniform float contrast;
      uniform float temperature;
      uniform float tint;
      uniform float saturation;
      uniform float vibrance;
      uniform float clarity;
      uniform float dehaze;
      uniform float highlights;
      uniform float shadows;
      uniform float whites;
      uniform float blacks;
      uniform vec3 curveCtrl;
      uniform float sharpness;
      uniform vec2 resolution;
      uniform float aspectRatio;
      uniform float sourceAspectRatio;
      uniform float containerAspectRatio;
      uniform float zoom;
      uniform vec2 pan;
      uniform float compareMode;
      uniform float splitX;
      uniform float heatOverlay;
      uniform float cropEnabled;
      uniform vec4 cropRect;
      uniform vec2 cropCenter;
      uniform float cropAngle;
      uniform float cropFlipX;
      uniform float cropFlipY;
      uniform float cropGeomVertical;
      uniform float cropGeomHorizontal;
      uniform float cropGeomRotate;
      uniform float cropGeomAspect;
      uniform float cropGeomScale;
      uniform float cropGeomOffsetX;
      uniform float cropGeomOffsetY;

      varying vec2 vUv;

      // Color Space Conversion Utilities
      const mat3 sRGBToXYZ = mat3(
        0.4124564, 0.3575761, 0.1804375,
        0.2126729, 0.7151522, 0.0721750,
        0.0193339, 0.1191920, 0.9503041
      );

      const mat3 XYZTosRGB = mat3(
        3.2404542, -1.5371385, -0.4985314,
        -0.9692660, 1.8760108, 0.0415560,
        0.0556434, -0.2040259, 1.0572252
      );

      // White Balance
      vec3 applyWhiteBalance(vec3 color, float temp, float tintVal) {
        // Temperature (Blue-Amber axis)
        float t = temp;
        vec3 wb = vec3(
            1.0 + max(t, 0.0) * 0.2,
            1.0,
            1.0 + max(-t, 0.0) * 0.2
        );
        // Tint (Green-Magenta axis)
        wb.g += tintVal * 0.1;

        // Normalize to preserve luminance
        return color * wb;
      }

      vec3 applyTone(vec3 color, float exp, float con, float high, float shad, float whitePt, float blackPt) {
        color *= pow(2.0, exp);

        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float shadowMask = 1.0 - smoothstep(0.08, 0.58, luma);
        float highlightMask = smoothstep(0.42, 0.95, luma);

        if (shad > 0.0) {
          vec3 lifted = color + (pow(max(color, vec3(0.0)), vec3(0.75)) - color) * (0.9 * shad);
          color = mix(color, lifted, shadowMask);
        } else if (shad < 0.0) {
          vec3 deepened = color * (1.0 + shad * shadowMask * 0.75);
          color = mix(color, deepened, shadowMask);
        }

        if (high > 0.0) {
          vec3 compressed = color / (1.0 + color * (0.55 + 1.25 * high));
          color = mix(color, compressed, highlightMask);
        } else if (high < 0.0) {
          vec3 expanded = color * (1.0 - high * 0.35);
          color = mix(color, expanded, highlightMask);
        }

        float pivot = 0.18;
        color = (color - pivot) * (1.0 + con * 1.15) + pivot;

        float whiteGain = 1.0 + whitePt * 0.35;
        float blackLift = blackPt * 0.08;
        color = (color + vec3(blackLift)) * whiteGain;

        return max(vec3(0.0), color);
      }

      vec3 applySharpen(vec2 uv, vec3 color, float amount) {
        if (amount <= 0.0) return color;

        vec2 step = 1.0 / resolution;
        vec3 b = texture2D(tDiffuse, uv + vec2(-step.x, -step.y)).rgb * 0.0625;
        b += texture2D(tDiffuse, uv + vec2(0.0, -step.y)).rgb * 0.125;
        b += texture2D(tDiffuse, uv + vec2(step.x, -step.y)).rgb * 0.0625;
        b += texture2D(tDiffuse, uv + vec2(-step.x, 0.0)).rgb * 0.125;
        b += texture2D(tDiffuse, uv).rgb * 0.25;
        b += texture2D(tDiffuse, uv + vec2(step.x, 0.0)).rgb * 0.125;
        b += texture2D(tDiffuse, uv + vec2(-step.x, step.y)).rgb * 0.0625;
        b += texture2D(tDiffuse, uv + vec2(0.0, step.y)).rgb * 0.125;
        b += texture2D(tDiffuse, uv + vec2(step.x, step.y)).rgb * 0.0625;

        vec3 detail = color - b;
        float edge = smoothstep(0.01, 0.08, abs(dot(detail, vec3(0.2126, 0.7152, 0.0722))));
        return color + detail * amount * (0.55 + 1.15 * edge);
      }

      float applyCurveChannel(float v, vec3 c) {
        float x = clamp(v, 0.0, 1.0);
        float y1 = clamp(c.x, 0.0, 1.0);
        float y2 = clamp(c.y, 0.0, 1.0);
        float y3 = clamp(c.z, 0.0, 1.0);

        if (x < 0.25) return mix(0.0, y1, x / 0.25);
        if (x < 0.5) return mix(y1, y2, (x - 0.25) / 0.25);
        if (x < 0.75) return mix(y2, y3, (x - 0.5) / 0.25);
        return mix(y3, 1.0, (x - 0.75) / 0.25);
      }

      vec3 applyCurve(vec3 color, vec3 c) {
        return vec3(
          applyCurveChannel(color.r, c),
          applyCurveChannel(color.g, c),
          applyCurveChannel(color.b, c)
        );
      }

      vec3 applySaturation(vec3 color, float sat, float vib) {
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        vec3 saturated = mix(vec3(luma), color, 1.0 + sat);
        float maxComp = max(color.r, max(color.g, color.b));
        float minComp = min(color.r, min(color.g, color.b));
        float satMask = (maxComp - minComp) / (maxComp + 0.001);
        vec3 vibranced = mix(vec3(luma), color, 1.0 + vib * (1.0 - satMask));
        return mix(saturated, vibranced, 0.5);
      }

      vec3 applyClarity(vec2 uv, vec3 color, float amount) {
        if (abs(amount) < 0.001) return color;
        vec2 step = 1.0 / resolution;
        vec3 blur = texture2D(tDiffuse, uv + vec2(-step.x, 0.0)).rgb * 0.25;
        blur += texture2D(tDiffuse, uv + vec2(step.x, 0.0)).rgb * 0.25;
        blur += texture2D(tDiffuse, uv + vec2(0.0, -step.y)).rgb * 0.25;
        blur += texture2D(tDiffuse, uv + vec2(0.0, step.y)).rgb * 0.25;
        vec3 detail = color - blur;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float midMask = smoothstep(0.15, 0.45, luma) * (1.0 - smoothstep(0.55, 0.9, luma));
        return color + detail * amount * 1.35 * midMask;
      }

      vec3 applyDehaze(vec3 color, float amount) {
        if (abs(amount) < 0.001) return color;
        float minC = min(color.r, min(color.g, color.b));
        float maxC = max(color.r, max(color.g, color.b));
        float sat = maxC - minC;
        float haze = smoothstep(0.03, 0.35, minC) * (1.0 - smoothstep(0.25, 0.9, sat));
        float k = amount * haze;
        vec3 neutral = vec3(dot(color, vec3(0.3333)));
        vec3 outColor = mix(color, color + (color - neutral) * 1.6, max(k, 0.0));
        outColor = mix(outColor, mix(outColor, neutral, 0.25), max(-k, 0.0));
        return max(vec3(0.0), outColor);
      }

      void main() {
        vec2 sampleUv = vUv;
        if (cropEnabled > 0.5) {
          sampleUv = vec2(
            mix(cropRect.x, cropRect.z, vUv.x),
            mix(cropRect.y, cropRect.w, vUv.y)
          );
        }

        vec2 centered = sampleUv - cropCenter;
        float safeAspect = max(sourceAspectRatio, 1e-6);
        centered.x *= safeAspect;

        if (cropFlipX > 0.5) centered.x = -centered.x;
        if (cropFlipY > 0.5) centered.y = -centered.y;

        float c = cos(cropAngle);
        float s = sin(cropAngle);
        centered = mat2(c, -s, s, c) * centered;

        float px = centered.x;
        float py = centered.y;
        float denomV = max(0.35, 1.0 + cropGeomVertical * py);
        float denomH = max(0.35, 1.0 + cropGeomHorizontal * px);
        px /= denomV;
        py /= denomH;
        centered = vec2(px, py);

        float c2 = cos(cropGeomRotate);
        float s2 = sin(cropGeomRotate);
        centered = mat2(c2, -s2, s2, c2) * centered;

        centered.x /= max(cropGeomAspect, 1e-4);
        centered /= max(cropGeomScale, 1e-4);
        centered += vec2(cropGeomOffsetX * safeAspect, cropGeomOffsetY);

        centered.x /= safeAspect;
        sampleUv = centered + cropCenter;

        bool inBounds = sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0;
        vec4 texel = inBounds ? texture2D(tDiffuse, sampleUv) : vec4(0.0, 0.0, 0.0, 1.0);
        vec3 color = texel.rgb;

        color = applyWhiteBalance(color, temperature, tint);
        color = applyTone(color, exposure, contrast, highlights, shadows, whites, blacks);
        color = applyCurve(color, curveCtrl);
        color = applySaturation(color, saturation, vibrance);
        color = applyClarity(sampleUv, color, clarity);
        color = applyDehaze(color, dehaze);
        color = applySharpen(sampleUv, color, sharpness);

        vec3 edited = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
        vec3 original = pow(max(texel.rgb, vec3(0.0)), vec3(1.0 / 2.2));
        vec3 outColor = edited;

        if (compareMode > 1.5) {
          outColor = vUv.x < splitX ? original : edited;
        } else if (compareMode > 0.5) {
          outColor = original;
        }

        if (heatOverlay > 0.5) {
          vec3 delta = edited - original;
          float lumaDelta = abs(dot(delta, vec3(0.2126, 0.7152, 0.0722)));
          vec3 chromaDeltaVec = delta - vec3(dot(delta, vec3(0.2126, 0.7152, 0.0722)));
          float chromaDelta = length(chromaDeltaVec);
          float score = max(chromaDelta * 2.1, lumaDelta * 0.6);
          float d = smoothstep(0.10, 0.42, score);
          vec3 heatColor = mix(vec3(0.0, 0.20, 1.0), vec3(1.0, 0.15, 0.0), d);
          outColor = mix(outColor, heatColor, d * 0.38);
        }

        gl_FragColor = vec4(outColor, texel.a);
      }
    `;

    const vertexShader = `
      varying vec2 vUv;
      uniform float aspectRatio;
      uniform float containerAspectRatio;
      uniform float zoom;
      uniform vec2 pan;

      void main() {
        vUv = vec2(uv.x, 1.0 - uv.y);

        vec3 pos = position;

        // 1. Aspect Ratio Correction ("Contain" mode)
        // This makes the quad match the image aspect ratio inside the container
        if (containerAspectRatio > aspectRatio) {
            // Container wider: fit height
            pos.x *= aspectRatio / containerAspectRatio;
        } else {
            // Container taller: fit width
            pos.y *= containerAspectRatio / aspectRatio;
        }

        // 2. Apply Zoom
        pos.xy *= zoom;

        // 3. Apply Pan
        // Pan is in NDC space (-1 to 1).
        // We add it directly to position.
        pos.x += pan.x;
        pos.y += pan.y;

        gl_Position = vec4(pos, 1.0);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        exposure: { value: 0.0 },
        contrast: { value: 0.0 },
        temperature: { value: 0.0 },
        tint: { value: 0.0 },
        saturation: { value: 0.0 },
        vibrance: { value: 0.0 },
        clarity: { value: 0.0 },
        dehaze: { value: 0.0 },
        highlights: { value: 0.0 },
        shadows: { value: 0.0 },
        whites: { value: 0.0 },
        blacks: { value: 0.0 },
        curveCtrl: { value: new THREE.Vector3(0.25, 0.5, 0.75) },
        aspectRatio: { value: 1.0 },
        sourceAspectRatio: { value: 1.0 },
        containerAspectRatio: { value: 1.0 },
        zoom: { value: 1.0 },
        pan: { value: new THREE.Vector2(0, 0) },
        compareMode: { value: 0.0 },
        splitX: { value: 0.5 },
        heatOverlay: { value: 0.0 },
        cropEnabled: { value: 0.0 },
        cropRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        cropCenter: { value: new THREE.Vector2(0.5, 0.5) },
        cropAngle: { value: 0.0 },
        cropFlipX: { value: 0.0 },
        cropFlipY: { value: 0.0 },
        cropGeomVertical: { value: 0.0 },
        cropGeomHorizontal: { value: 0.0 },
        cropGeomRotate: { value: 0.0 },
        cropGeomAspect: { value: 1.0 },
        cropGeomScale: { value: 1.0 },
        cropGeomOffsetX: { value: 0.0 },
        cropGeomOffsetY: { value: 0.0 },
        sharpness: { value: 0.0 },
        resolution: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader,
      fragmentShader,
      glslVersion: THREE.GLSL1
    });

    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);
  }

  loadImage(image: RawImage) {
    if (this.texture) {
      this.texture.dispose();
    }

    // Create Float DataTexture
    this.texture = new THREE.DataTexture(
      image.data,
      image.width,
      image.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    // this.texture.flipY = true; // Handled in shader now
    this.texture.needsUpdate = true;

    // Use LinearMipmapLinearFilter for high quality downscaling (reduces moire)
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;

    // Enable Anisotropy if available
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.texture.anisotropy = maxAnisotropy;

    this.material.uniforms.tDiffuse.value = this.texture;
    this.sourceAspectRatio = image.width / image.height;
    this.material.uniforms.aspectRatio.value = this.sourceAspectRatio;
    this.material.uniforms.sourceAspectRatio.value = this.sourceAspectRatio;
    this.material.uniforms.resolution.value.set(image.width, image.height);

    // Initial render
    this.render();
  }

  updateTransform(zoom: number, pan: { x: number, y: number }) {
      this.material.uniforms.zoom.value = zoom;
      this.material.uniforms.pan.value.set(pan.x, pan.y);
      this.render();
  }

  private updateDisplayAspectFromCropState() {
    if (!this.cropEnabledState) {
      this.material.uniforms.aspectRatio.value = this.sourceAspectRatio;
      return;
    }
    const w = Math.max(1e-6, this.cropRectState.x1 - this.cropRectState.x0);
    const h = Math.max(1e-6, this.cropRectState.y1 - this.cropRectState.y0);
    this.material.uniforms.aspectRatio.value = this.sourceAspectRatio * (w / h);
  }

  setCompareOptions(mode: 'off' | 'before' | 'split', splitX: number, heatOverlay: boolean) {
    this.material.uniforms.compareMode.value = mode === 'before' ? 1.0 : mode === 'split' ? 2.0 : 0.0;
    this.material.uniforms.splitX.value = Math.min(Math.max(splitX, 0), 1);
    this.material.uniforms.heatOverlay.value = heatOverlay ? 1.0 : 0.0;
    this.render();
  }

  setCropRect(enabled: boolean, rect: { x0: number; y0: number; x1: number; y1: number }) {
    const x0 = Math.min(Math.max(Math.min(rect.x0, rect.x1), 0), 1);
    const y0 = Math.min(Math.max(Math.min(rect.y0, rect.y1), 0), 1);
    const x1 = Math.min(Math.max(Math.max(rect.x0, rect.x1), 0), 1);
    const y1 = Math.min(Math.max(Math.max(rect.y0, rect.y1), 0), 1);
    this.cropEnabledState = enabled;
    this.cropRectState = { x0, y0, x1, y1 };
    this.material.uniforms.cropEnabled.value = enabled ? 1.0 : 0.0;
    this.material.uniforms.cropRect.value.set(x0, y0, x1, y1);
    this.material.uniforms.cropCenter.value.set((x0 + x1) * 0.5, (y0 + y1) * 0.5);
    this.updateDisplayAspectFromCropState();
    this.render();
  }

  setCropTransform(angleDeg: number, flipX: boolean, flipY: boolean) {
    this.material.uniforms.cropAngle.value = THREE.MathUtils.degToRad(angleDeg);
    this.material.uniforms.cropFlipX.value = flipX ? 1.0 : 0.0;
    this.material.uniforms.cropFlipY.value = flipY ? 1.0 : 0.0;
    this.render();
  }

  setCropGeometry(params: { vertical: number; horizontal: number; rotate: number; aspect: number; scale: number; offsetX: number; offsetY: number; }) {
    this.material.uniforms.cropGeomVertical.value = params.vertical;
    this.material.uniforms.cropGeomHorizontal.value = params.horizontal;
    this.material.uniforms.cropGeomRotate.value = THREE.MathUtils.degToRad(params.rotate);
    this.material.uniforms.cropGeomAspect.value = Math.max(params.aspect, 0.1);
    this.material.uniforms.cropGeomScale.value = Math.max(params.scale, 0.1);
    this.material.uniforms.cropGeomOffsetX.value = params.offsetX;
    this.material.uniforms.cropGeomOffsetY.value = params.offsetY;
    this.render();
  }

  updateState(state: ImageState) {
    this.material.uniforms.exposure.value = state.exposure;
    this.material.uniforms.contrast.value = state.contrast;
    this.material.uniforms.highlights.value = state.highlights;
    this.material.uniforms.shadows.value = state.shadows;
    this.material.uniforms.whites.value = state.whites;
    this.material.uniforms.blacks.value = state.blacks;

    this.material.uniforms.temperature.value = (state.temperature - 5500.0) / 4500.0;

    this.material.uniforms.tint.value = state.tint / 100.0;
    this.material.uniforms.saturation.value = state.saturation;
    this.material.uniforms.vibrance.value = state.vibrance;
    this.material.uniforms.clarity.value = state.clarity;
    this.material.uniforms.dehaze.value = state.dehaze;
    this.material.uniforms.sharpness.value = state.sharpness;

    const c1 = this.sampleCurve(state.curve, 0.25);
    const c2 = this.sampleCurve(state.curve, 0.5);
    const c3 = this.sampleCurve(state.curve, 0.75);
    this.material.uniforms.curveCtrl.value.set(c1, c2, c3);

    this.render();
  }

  private sampleCurve(points: { x: number; y: number }[], x: number): number {
    if (!points || points.length === 0) return x;
    const sorted = [...points].sort((a, b) => a.x - b.x);
    if (x <= sorted[0].x) return sorted[0].y;
    if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x || 1);
        return p1.y + (p2.y - p1.y) * t;
      }
    }
    return x;
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.material.uniforms.containerAspectRatio.value = width / height;
    this.render();
  }

  getHistogramData(): { r: number[]; g: number[]; b: number[] } {
    if (!this.texture) return { r: [], g: [], b: [] };

    const savedCompareMode = this.material.uniforms.compareMode.value;
    const savedHeatOverlay = this.material.uniforms.heatOverlay.value;
    this.material.uniforms.compareMode.value = 0;
    this.material.uniforms.heatOverlay.value = 0;

    // Create a temporary WebGLRenderTarget to read pixels from
    const width = 256;
    const height = 256;
    const renderTarget = new THREE.WebGLRenderTarget(width, height); // Downsample for performance

    // Save current state
    const currentRenderTarget = this.renderer.getRenderTarget();
    const currentSize = new THREE.Vector2();
    this.renderer.getSize(currentSize);

    // Render to target
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);

    // Read pixels
    const pixelCount = width * height;
    const pixels = new Uint8Array(pixelCount * 4);
    this.renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

    // Restore state
    this.renderer.setRenderTarget(currentRenderTarget);
    // this.renderer.setSize(currentSize.x, currentSize.y); // Restore size just in case
    renderTarget.dispose();

    // Calculate Histogram
    const r = new Array(256).fill(0);
    const g = new Array(256).fill(0);
    const b = new Array(256).fill(0);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        r[pixels[idx]]++;
        g[pixels[idx + 1]]++;
        b[pixels[idx + 2]]++;
    }

    // Normalize (optional, depends on visualization)
    const max = Math.max(...r, ...g, ...b);
    const result = {
        r: r.map(v => v / max),
        g: g.map(v => v / max),
        b: b.map(v => v / max)
    };
    this.material.uniforms.compareMode.value = savedCompareMode;
    this.material.uniforms.heatOverlay.value = savedHeatOverlay;
    this.render();
    return result;
  }



  render() {
    this.renderer.render(this.scene, this.camera);
  }

  exportMinimapPreview(maxWidth: number = 320, maxHeight: number = 200): string | null {
    if (!this.texture) return null;

    const savedCompareMode = this.material.uniforms.compareMode.value;
    const savedHeatOverlay = this.material.uniforms.heatOverlay.value;
    this.material.uniforms.compareMode.value = 0;
    this.material.uniforms.heatOverlay.value = 0;

    const currentSize = new THREE.Vector2();
    this.renderer.getSize(currentSize);
    const currentPixelRatio = this.renderer.getPixelRatio();
    const originalContainerAspect = this.material.uniforms.containerAspectRatio.value;
    const savedZoom = this.material.uniforms.zoom.value;
    const savedPan = this.material.uniforms.pan.value.clone();

    const imageWidth = this.texture.image.width;
    const imageHeight = this.texture.image.height;
    const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
    const width = Math.max(1, Math.round(imageWidth * scale));
    const height = Math.max(1, Math.round(imageHeight * scale));

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.material.uniforms.containerAspectRatio.value = imageWidth / imageHeight;
    this.material.uniforms.zoom.value = 1;
    this.material.uniforms.pan.value.set(0, 0);

    this.render();
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.78);

    this.renderer.setPixelRatio(currentPixelRatio);
    this.renderer.setSize(currentSize.x, currentSize.y, false);
    this.material.uniforms.containerAspectRatio.value = originalContainerAspect;
    this.material.uniforms.zoom.value = savedZoom;
    this.material.uniforms.pan.value.copy(savedPan);
    this.material.uniforms.compareMode.value = savedCompareMode;
    this.material.uniforms.heatOverlay.value = savedHeatOverlay;
    this.render();

    return dataUrl;
  }

  exportFullRes(type: 'image/png' | 'image/jpeg' = 'image/png', quality: number = 1.0): string {
    if (!this.texture) return '';

    const savedCompareMode = this.material.uniforms.compareMode.value;
    const savedHeatOverlay = this.material.uniforms.heatOverlay.value;
    this.material.uniforms.compareMode.value = 0;
    this.material.uniforms.heatOverlay.value = 0;

    // Save current size
    const currentSize = new THREE.Vector2();
    this.renderer.getSize(currentSize);
    const currentPixelRatio = this.renderer.getPixelRatio();

    // Get full image size
    const width = this.texture.image.width;
    const height = this.texture.image.height;

    // Check max texture size
    const maxTextureSize = this.renderer.capabilities.maxTextureSize;
    if (width > maxTextureSize || height > maxTextureSize) {
        console.warn(`Image size (${width}x${height}) exceeds WebGL limits (${maxTextureSize}). Export might be downscaled.`);
        // In a real app, we'd use tiling or CPU fallback here.
    }

    // Resize renderer to full image size
    // IMPORTANT: Set pixel ratio to 1.0 for export to ensure 1:1 pixel mapping
    // Otherwise, on Retina screens, a 4000px image becomes 8000px canvas, potentially crashing or glitching.
    this.renderer.setPixelRatio(1.0);
    this.renderer.setSize(width, height);

    // Update aspect ratio for full res (should be same as image aspect)
    // Actually, containerAspectRatio needs to match image aspect to avoid letterboxing on export
    const originalContainerAspect = this.material.uniforms.containerAspectRatio.value;
    const savedZoom = this.material.uniforms.zoom.value;
    const savedPan = this.material.uniforms.pan.value.clone();

    this.material.uniforms.containerAspectRatio.value = width / height;
    // FORCE reset for export to ensure full image is captured without borders/cropping
    this.material.uniforms.zoom.value = 1.0;
    this.material.uniforms.pan.value.set(0, 0);

    this.render();

    // Get data URL
    // Note: toDataURL is synchronous and can be slow for large images
    const dataUrl = this.canvas.toDataURL(type, quality);

    // Restore size and state
    this.renderer.setPixelRatio(currentPixelRatio);
    this.renderer.setSize(currentSize.x, currentSize.y);
    this.material.uniforms.containerAspectRatio.value = originalContainerAspect;
    this.material.uniforms.zoom.value = savedZoom;
    this.material.uniforms.pan.value.copy(savedPan);
    this.material.uniforms.compareMode.value = savedCompareMode;
    this.material.uniforms.heatOverlay.value = savedHeatOverlay;

    this.render(); // Re-render at screen size

    return dataUrl;
  }

  dispose() {
      this.renderer.dispose();
      this.texture?.dispose();
      this.material.dispose();
  }
}
