import { CRTShader } from './CRTShader.js';

const CANVAS_ID = 'crt-canvas';
const PANE_OFFSET = 16;
const PIXEL_RATIO_CAP = 2;
const BASE_SCENE_SIZE = 1024;
const INITIAL_SCENE_SIZE = BASE_SCENE_SIZE;
const BG_GRADIENT_INNER = '#0b1f3a';
const BG_GRADIENT_OUTER = '#050a14';
const CRT_DEFAULTS = {
  enabled: true,
  smoothing: true,
  scanlineIntensity: 0.5,
  scanlineCount: 270,
  adaptiveIntensity: 0.3,
  brightness: 1.5,
  contrast: 1.05,
  saturation: 1.1,
  bloomIntensity: 0.5,
  bloomThreshold: 0.5,
  rgbShift: 1.0,
  vignetteStrength: 0.3,
  curvature: 0.5,
  flickerStrength: 0.01
};

const canvas = document.getElementById(CANVAS_ID);
const gl = canvas.getContext('webgl2', { alpha: false });
if (!gl) {
  throw new Error('WebGL2 not supported');
}

const sceneCanvas = document.createElement('canvas');
sceneCanvas.width = INITIAL_SCENE_SIZE;
sceneCanvas.height = INITIAL_SCENE_SIZE;
const sceneCtx = sceneCanvas.getContext('2d');

const state = {
  time: 0,
  params: { ...CRT_DEFAULTS },
  rotation: 0
};

const program = createProgram(gl, buildVertexSource(), buildFragmentSource());
const vao = createQuad(gl);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
const uniforms = getUniformLocations(gl, program, [
  'uTexture',
  'uEnabled',
  'scanlineIntensity',
  'scanlineCount',
  'time',
  'yOffset',
  'brightness',
  'contrast',
  'saturation',
  'bloomIntensity',
  'bloomThreshold',
  'rgbShift',
  'adaptiveIntensity',
  'vignetteStrength',
  'curvature',
  'flickerStrength',
  'glitch'
]);

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
applySmoothing(state.params.smoothing);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sceneCanvas.width, sceneCanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

resize();
window.addEventListener('resize', resize, { passive: true });

requestAnimationFrame(render);

function render(ts) {
  state.time = ts * 0.001;
  drawScene2D(state.time);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(uniforms.uTexture, 0);
  gl.uniform1i(uniforms.uEnabled, state.params.enabled ? 1 : 0);
  gl.uniform1f(uniforms.scanlineIntensity, state.params.scanlineIntensity);
  gl.uniform1f(uniforms.scanlineCount, state.params.scanlineCount);
  gl.uniform1f(uniforms.time, state.time);
  gl.uniform1f(uniforms.yOffset, 0.0);
  gl.uniform1f(uniforms.brightness, state.params.brightness);
  gl.uniform1f(uniforms.contrast, state.params.contrast);
  gl.uniform1f(uniforms.saturation, state.params.saturation);
  gl.uniform1f(uniforms.bloomIntensity, state.params.bloomIntensity);
  gl.uniform1f(uniforms.bloomThreshold, state.params.bloomThreshold);
  gl.uniform1f(uniforms.rgbShift, state.params.rgbShift);
  gl.uniform1f(uniforms.adaptiveIntensity, state.params.adaptiveIntensity);
  gl.uniform1f(uniforms.vignetteStrength, state.params.vignetteStrength);
  gl.uniform1f(uniforms.curvature, state.params.curvature);
  gl.uniform1f(uniforms.flickerStrength, state.params.flickerStrength);
  gl.uniform1f(uniforms.glitch, glitchAmount(state.time));

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}

// ---- Menu content: edit this part ----
const W = 480, H = 270;                       // virtual screen grid; everything is placed on it
const FONT = '"Press Start 2P", monospace';
const COL = { cy: '#22d3ee', pk: '#f472b6', ye: '#facc15', tx: '#e2e8f0', dim: '#64748b' };
const NAME = 'PickledMango';
const TAGLINE = 'Member of Mango Studio.';
const PROJECTS = [
  { n: 'About Me', t: 'JavaScript / Canvas', d: 'A short line about what it does and why you made it.', l: 'https://github.com/MostlyManganese/Portfolio', img: 'project1.png' },
  { n: 'Project one', t: 'Game / Renpy', d: 'A visual novel submission for Comfy Autumn Jam 2026.', l: 'https://pickledmango.itch.io/the-choice-i-made-in-autumn', img: 'project2.png' },
  { n: 'Project three', t: 'Python / Data', d: 'Mention the problem it solves and what you learned.', l: '', img: 'project3.png' },
  { n: 'Project four', t: 'Game / Pixel art', d: 'Each project gets a title, its tech, and two lines of text.', l: '', img: 'project4.png' }
];
const LINKS = [
  { n: 'GitHub', x: 372, u: 'https://github.com/MostlyManganese' },
  { n: 'Email', x: 436, u: 'mailto:you@example.com' }
];
// ---- end of content ----

let sel = 0;
let glitchStart = -9;   // time of the last project switch
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLITCH_SECONDS = 0.35;
PROJECTS.forEach(p => { if (p.img) { p.im = new Image(); p.im.src = p.img; } });
document.fonts.load('8px "Press Start 2P"').catch(() => {});

function wrap(ctx, s, maxW) {
  const out = []; let line = '';
  for (const word of s.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  out.push(line);
  return out;
}

function drawScene2D(time) {
  const ctx = sceneCtx, w = sceneCanvas.width, h = sceneCanvas.height;
  const s = Math.min(w / W, h / H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const grad = ctx.createRadialGradient(w * 0.3, h * 0.3, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  grad.addColorStop(0, BG_GRADIENT_INNER);
  grad.addColorStop(1, BG_GRADIENT_OUTER);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(s, 0, 0, s, (w - W * s) / 2, (h - H * s) / 2);   // from here on, draw in 480x270 units
  ctx.textBaseline = 'top';

  ctx.font = '16px ' + FONT; ctx.fillStyle = COL.tx; ctx.fillText(NAME, 12, 10);
  ctx.font = '8px ' + FONT; ctx.fillStyle = COL.dim; ctx.fillText(TAGLINE, 12, 28);
  ctx.fillStyle = '#1e3a5f'; ctx.fillRect(12, 42, W - 24, 1);

  PROJECTS.forEach((p, i) => {
    const y = 52 + i * 24;
    if (i === sel) {
      ctx.fillStyle = 'rgba(34,211,238,.16)'; ctx.fillRect(8, y - 5, 158, 20);
      ctx.fillStyle = COL.ye;
      if (Math.floor(time * 2) % 2 === 0) ctx.fillText('>', 12, y);
    }
    ctx.fillStyle = i === sel ? COL.ye : COL.dim;
    ctx.fillText(p.n, 26, y);
  });

  const px = 176, py = 50, pw = 292, ph = 122, p = PROJECTS[sel], im = p.im;
  ctx.fillStyle = '#07142a'; ctx.fillRect(px, py, pw, ph);
  if (im && im.complete && im.naturalWidth) {
    const k = Math.min(pw / im.naturalWidth, ph / im.naturalHeight);
    const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    ctx.drawImage(im, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  }
  ctx.strokeStyle = COL.cy; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  ctx.font = '16px ' + FONT; ctx.fillStyle = COL.pk; ctx.fillText(p.n, px, 182);
  ctx.font = '8px ' + FONT; ctx.fillStyle = COL.cy; ctx.fillText(p.t, px, 204);
  ctx.fillStyle = COL.tx;
  wrap(ctx, p.d, pw).slice(0, 3).forEach((line, i) => ctx.fillText(line, px, 218 + i * 12));
  if (p.l) { ctx.fillStyle = COL.ye; ctx.fillText('Enter: open project', px, 246); }
  ctx.fillStyle = COL.dim; ctx.fillText('Arrows choose, C toggles CRT', 12, 258);
  LINKS.forEach(k => { ctx.fillStyle = COL.cy; ctx.fillText(k.n, k.x, 258); });
}

function openLink(u) { if (u) window.open(u, '_blank', 'noopener'); }
function glitchAmount(t) { return reduceMotion ? 0 : Math.max(0, 1 - (t - glitchStart) / GLITCH_SECONDS); }
function choose(i) { sel = (i + PROJECTS.length) % PROJECTS.length; glitchStart = state.time; }

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') choose(sel + 1);
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') choose(sel - 1);
  else if (e.key === 'Enter') openLink(PROJECTS[sel].l);
  else if (e.key === 'c' || e.key === 'C') state.params.enabled = !state.params.enabled;
});

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  let u = (e.clientX - r.left) / r.width, v = 1 - (e.clientY - r.top) / r.height;
  if (state.params.enabled && state.params.curvature > 0.001) {   // undo the shader's screen curve
    const cx = u * 2 - 1, cy = v * 2 - 1, k = 1 + (cx * cx + cy * cy) * state.params.curvature * 0.25;
    u = cx * k * 0.5 + 0.5; v = cy * k * 0.5 + 0.5;
  }
  const w = sceneCanvas.width, h = sceneCanvas.height, s = Math.min(w / W, h / H);
  const x = (u * w - (w - W * s) / 2) / s, y = ((1 - v) * h - (h - H * s) / 2) / s;
  if (x < 170 && y >= 47 && y < 52 + PROJECTS.length * 24 - 5) { choose(Math.floor((y - 47) / 24)); return; }
  if (y >= 254) {
    sceneCtx.font = '8px ' + FONT;
    const k = LINKS.find(k => x >= k.x && x < k.x + sceneCtx.measureText(k.n).width);
    if (k) openLink(k.u);
    return;
  }
  if (x >= 176 && y >= 46 && y < 260) openLink(PROJECTS[sel].l);
});

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  sceneCanvas.width = width;
  sceneCanvas.height = height;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sceneCanvas.width, sceneCanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  applySmoothing(state.params.smoothing);
}

function buildVertexSource() {
  return `#version 300 es
    precision highp float;
    const vec2 pos[4] = vec2[4](
      vec2(-1.0, -1.0),
      vec2(1.0, -1.0),
      vec2(-1.0, 1.0),
      vec2(1.0, 1.0)
    );
    const vec2 uvData[4] = vec2[4](
      vec2(0.0, 0.0),
      vec2(1.0, 0.0),
      vec2(0.0, 1.0),
      vec2(1.0, 1.0)
    );
    out vec2 vUv;
    void main() {
      vUv = uvData[gl_VertexID];
      gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
    }
  `;
}

function buildFragmentSource() {
  let body = CRTShader.fragmentShader;
  // Strip existing uniform/varying declarations and swap legacy helpers
  body = body.replace(/uniform\s+[^;]+;\s*/g, '');
  body = body.replace(/varying\s+[^;]+;\s*/g, '');
  body = body.replace(/\btDiffuse\b/g, 'uTexture');
  body = body.replace(/texture2D\s*\(/g, 'texture(');
  body = body.replace(/gl_FragColor/g, 'fragColor');
  body = body.replace(/void main\s*\(/, 'void mainImage(');
  return `#version 300 es
    precision highp float;
    uniform sampler2D uTexture;
    uniform bool uEnabled;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    uniform float time;
    uniform float yOffset;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float bloomIntensity;
    uniform float bloomThreshold;
    uniform float rgbShift;
    uniform float adaptiveIntensity;
    uniform float vignetteStrength;
    uniform float curvature;
    uniform float flickerStrength;
    uniform float glitch;
    in vec2 vUv;
    out vec4 fragColor;
    // Early exit for bypass
    void bypass() {
      fragColor = texture(uTexture, vUv);
    }
    // --- Original shader logic ---
    ${body}
    void main() {
      if (!uEnabled) {
        bypass();
        return;
      }
      mainImage();
    }
  `;
}

function createProgram(glContext, vsSource, fsSource) {
  const vs = compileShader(glContext, glContext.VERTEX_SHADER, vsSource);
  const fs = compileShader(glContext, glContext.FRAGMENT_SHADER, fsSource);
  const program = glContext.createProgram();
  glContext.attachShader(program, vs);
  glContext.attachShader(program, fs);
  glContext.linkProgram(program);
  if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
    throw new Error(glContext.getProgramInfoLog(program) || 'Program link error');
  }
  return program;
}

function compileShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);
  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    throw new Error(glContext.getShaderInfoLog(shader) || 'Shader compile error');
  }
  return shader;
}

function createQuad(glContext) {
  const vaoHandle = glContext.createVertexArray();
  glContext.bindVertexArray(vaoHandle);
  return vaoHandle;
}

function getUniformLocations(glContext, programHandle, names) {
  const map = {};
  for (let i = 0; i < names.length; i += 1) {
    map[names[i]] = glContext.getUniformLocation(programHandle, names[i]);
  }
  return map;
}

function applySmoothing(enabled) {
  sceneCtx.imageSmoothingEnabled = enabled;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = enabled ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
}
