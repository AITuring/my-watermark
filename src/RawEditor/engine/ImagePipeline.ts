import * as THREE from 'three';
import { ImageState, RawImage } from '../types';

export class ImagePipeline {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private texture: THREE.DataTexture | null = null;
  private canvas: HTMLCanvasElement;

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
      uniform float highlights;
      uniform float shadows;
      uniform float sharpness;
      uniform vec2 resolution;
      uniform float aspectRatio;
      uniform float containerAspectRatio;
      uniform float zoom;
      uniform vec2 pan;

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

      // Tonal Adjustments
      vec3 applyTone(vec3 color, float exp, float con, float high, float shad) {
        // Exposure
        color *= pow(2.0, exp);

        // Contrast (S-Curve approximation)
        color = (color - 0.5) * (1.0 + con) + 0.5;

        // Highlights & Shadows (Simplified)
        // In a real pipeline, we'd use luminance masks
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

        // Highlights compression
        if (high != 0.0) {
            float hFactor = smoothstep(0.5, 1.0, luma);
            color = mix(color, color * (1.0 - high * 0.5), hFactor);
        }

        // Shadows boost
        if (shad != 0.0) {
            float sFactor = 1.0 - smoothstep(0.0, 0.5, luma);
            color = mix(color, color * (1.0 + shad * 0.5), sFactor);
        }

        return max(vec3(0.0), color);
      }

      // Saturation & Vibrance
      vec3 applySaturation(vec3 color, float sat, float vib) {
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

        // Standard Saturation
        vec3 saturated = mix(vec3(luma), color, 1.0 + sat);

        // Vibrance (saturates less saturated colors more)
        float maxComp = max(color.r, max(color.g, color.b));
        float minComp = min(color.r, min(color.g, color.b));
        float satMask = (maxComp - minComp) / (maxComp + 0.001);

        vec3 vibranced = mix(vec3(luma), color, 1.0 + vib * (1.0 - satMask));

        // Combine (simplified)
        return mix(saturated, vibranced, 0.5);
      }

      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec3 color = texel.rgb;

        // 0. Sharpening (Laplacian Filter) - Applied before other adjustments
        if (sharpness > 0.0) {
            vec2 step = 1.0 / resolution;
            vec3 neighbor = texture2D(tDiffuse, vUv + vec2(0, step.y)).rgb;
            neighbor += texture2D(tDiffuse, vUv - vec2(0, step.y)).rgb;
            neighbor += texture2D(tDiffuse, vUv + vec2(step.x, 0)).rgb;
            neighbor += texture2D(tDiffuse, vUv - vec2(step.x, 0)).rgb;

            // Boost center pixel contrast against neighbors
            color = color + sharpness * (4.0 * color - neighbor);
        }

        // 1. White Balance
        color = applyWhiteBalance(color, temperature, tint);

        // 2. Tonal Mapping
        color = applyTone(color, exposure, contrast, highlights, shadows);

        // 3. Saturation / Vibrance
        color = applySaturation(color, saturation, vibrance);

        // 4. Output Transform (Linear to sRGB Gamma)
        // Gamma 2.2 approximation
        color = pow(color, vec3(1.0/2.2));

        gl_FragColor = vec4(color, texel.a);
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
        highlights: { value: 0.0 },
        shadows: { value: 0.0 },
        aspectRatio: { value: 1.0 },
        containerAspectRatio: { value: 1.0 },
        zoom: { value: 1.0 },
        pan: { value: new THREE.Vector2(0, 0) },
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
    this.material.uniforms.aspectRatio.value = image.width / image.height;
    this.material.uniforms.resolution.value.set(image.width, image.height);

    // Initial render
    this.render();
  }

  updateTransform(zoom: number, pan: { x: number, y: number }) {
      this.material.uniforms.zoom.value = zoom;
      this.material.uniforms.pan.value.set(pan.x, pan.y);
      this.render();
  }

  updateState(state: ImageState) {
    this.material.uniforms.exposure.value = state.exposure;
    this.material.uniforms.contrast.value = state.contrast;
    this.material.uniforms.highlights.value = state.highlights;
    this.material.uniforms.shadows.value = state.shadows;

    // Normalize temperature (assume 2000K to 10000K range mapped to -1 to 1)
    // 5500K is neutral (0.0)
    this.material.uniforms.temperature.value = (state.temperature - 5500.0) / 4500.0;

    this.material.uniforms.tint.value = state.tint / 100.0;
    this.material.uniforms.saturation.value = state.saturation;
    this.material.uniforms.vibrance.value = state.vibrance;
    this.material.uniforms.sharpness.value = state.sharpness;

    this.render();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.material.uniforms.containerAspectRatio.value = width / height;
    this.render();
  }

  getHistogramData(): { r: number[]; g: number[]; b: number[] } {
    if (!this.texture) return { r: [], g: [], b: [] };

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
    return {
        r: r.map(v => v / max),
        g: g.map(v => v / max),
        b: b.map(v => v / max)
    };
  }



  render() {
    this.renderer.render(this.scene, this.camera);
  }

  exportFullRes(type: 'image/png' | 'image/jpeg' = 'image/png', quality: number = 1.0): string {
    if (!this.texture) return '';

    // Save current size
    const currentSize = new THREE.Vector2();
    this.renderer.getSize(currentSize);

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
    this.renderer.setSize(width, height);

    // Update aspect ratio for full res (should be same as image aspect)
    // Actually, containerAspectRatio needs to match image aspect to avoid letterboxing on export
    const originalContainerAspect = this.material.uniforms.containerAspectRatio.value;
    const originalZoom = this.material.uniforms.zoom.value;
    const originalPan = this.material.uniforms.pan.value.clone();

    this.material.uniforms.containerAspectRatio.value = width / height;
    this.material.uniforms.zoom.value = 1.0;
    this.material.uniforms.pan.value.set(0, 0);

    this.render();

    // Get data URL
    // Note: toDataURL is synchronous and can be slow for large images
    const dataUrl = this.canvas.toDataURL(type, quality);

    // Restore size and state
    this.renderer.setSize(currentSize.x, currentSize.y);
    this.material.uniforms.containerAspectRatio.value = originalContainerAspect;
    this.material.uniforms.zoom.value = originalZoom;
    this.material.uniforms.pan.value.copy(originalPan);

    this.render(); // Re-render at screen size

    return dataUrl;
  }

  dispose() {
      this.renderer.dispose();
      this.texture?.dispose();
      this.material.dispose();
  }
}
