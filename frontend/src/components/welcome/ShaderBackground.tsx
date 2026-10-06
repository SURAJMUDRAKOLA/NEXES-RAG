'use client';

import { useEffect, useRef } from 'react';

// ─── Shader Sources ────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  precision mediump float;
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec2  uResolution;

  // ─── Hash / FBM helpers ──────────────────────────────────────────────────────

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value     += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  // ─── Main ────────────────────────────────────────────────────────────────────

  void main() {
    // UV centred in [-1, 1] accounting for aspect ratio
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    // Mouse parallax offset (±2 %)
    vec2 mouseOffset = (uMouse - 0.5) * 0.04;
    uv += mouseOffset;

    // ── Slow violet layer ────────────────────────────────────────────────────
    // rgba(124, 58, 237, 0.18)
    float slowNoise = fbm(uv * 2.2 + vec2(uTime * 0.3, uTime * 0.15), 5);
    vec3  violetCol = vec3(0.486, 0.227, 0.929);   // #7C3AED
    float violetAlpha = smoothstep(0.35, 0.72, slowNoise) * 0.18;

    // ── Fast cyan layer ───────────────────────────────────────────────────────
    // rgba(6, 182, 212, 0.10)
    float fastNoise = fbm(uv * 3.5 + vec2(-uTime * 1.2, uTime * 0.6), 4);
    vec3  cyanCol   = vec3(0.024, 0.714, 0.831);   // #06B6D4
    float cyanAlpha = smoothstep(0.42, 0.78, fastNoise) * 0.10;

    // ── Compose over void black #030303 ───────────────────────────────────────
    vec3 base  = vec3(0.012, 0.012, 0.012);
    vec3 color = base;
    color = mix(color, violetCol, violetAlpha);
    color = mix(color, cyanCol,   cyanAlpha);

    // Very faint radial vignette to concentrate glow at centre
    float dist   = length(uv * 0.6);
    float vignette = 1.0 - smoothstep(0.5, 1.4, dist);
    color *= (0.85 + 0.15 * vignette);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vert);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${info}`);
  }
  return prog;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('ShaderBackground: WebGL not supported, falling back to CSS.');
      return;
    }

    // ── Build program ──────────────────────────────────────────────────────────
    let program: WebGLProgram;
    try {
      program = createProgram(gl, VERT, FRAG);
    } catch (e) {
      console.error(e);
      return;
    }

    gl.useProgram(program);

    // ── Full-screen quad ───────────────────────────────────────────────────────
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // ── Uniform locations ──────────────────────────────────────────────────────
    const uTimeLoc       = gl.getUniformLocation(program, 'uTime');
    const uMouseLoc      = gl.getUniformLocation(program, 'uMouse');
    const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');

    // ── State ──────────────────────────────────────────────────────────────────
    let mouse = { x: 0.5, y: 0.5 };
    let rafId: number;
    let startTime = performance.now();

    // ── Resize ────────────────────────────────────────────────────────────────
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Mouse ─────────────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouse = {
        x: e.clientX / window.innerWidth,
        y: 1.0 - e.clientY / window.innerHeight, // flip Y for GL coords
      };
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Render loop ───────────────────────────────────────────────────────────
    const render = () => {
      const elapsed = (performance.now() - startTime) * 0.001;

      gl.useProgram(program);
      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uMouseLoc, mouse.x, mouse.y);
      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafId = requestAnimationFrame(render);
    };

    render();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
