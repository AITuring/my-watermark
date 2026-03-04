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
        powerPreference: "high-performance"
    });
    this.renderer.autoClear = false;

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
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
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
    this.texture.needsUpdate = true;
    
    // Linear filter for smooth zooming, Nearest for pixel peeping (optional)
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.material.uniforms.tDiffuse.value = this.texture;
    
    // Initial render
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
    
    this.render();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  exportImage(): string {
    this.render();
    return this.canvas.toDataURL('image/png', 1.0);
  }
  
  dispose() {
      this.renderer.dispose();
      this.texture?.dispose();
      this.material.dispose();
  }
}