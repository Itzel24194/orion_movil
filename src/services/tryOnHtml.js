// Página HTML del probador automático. Corre dentro de un WebView (funciona en Expo Go):
//  - cámara con getUserMedia
//  - detección de pose en tiempo real con MediaPipe PoseLandmarker (se descarga de internet la primera vez)
//  - quita el fondo de la imagen del producto (relleno desde los bordes)
//  - dibuja la prenda sobre hombros / cadera / cabeza / muñecas / pies según el tipo de producto
// IMPORTANTE: este texto no debe contener acentos graves (backticks) ni signos de dolar con llave.
export const TRYON_HTML = String.raw`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;background:#0B1020;overflow:hidden}
canvas{width:100%;height:100%;display:block;object-fit:cover}
video{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
</style></head>
<body>
<video id="v" playsinline muted autoplay></video>
<canvas id="c"></canvas>
<script type="module">
const post = (type, data) => { try { window.ReactNativeWebView.postMessage(JSON.stringify({ type, data })); } catch (e) {} };
const video = document.getElementById('v');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const cfg = { kind: 'top', tint: null, sizeFactor: 1, facing: 'user', garmentSrc: null };
let garment = null;      // canvas con la prenda sin fondo y recortada
let garmentTinted = null;
let aspect = 1;
let landmarker = null;
let stream = null;
let lastT = -1;
let poseOk = false;
let lastSeen = 0;
let sm = {};             // parametros suavizados
let started = false;

// ---------- Quitar fondo ----------
function removeBackground(img) {
  const MAX = 640;
  const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * sc)), h = Math.max(2, Math.round(img.naturalHeight * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  let id; try { id = x.getImageData(0, 0, w, h); } catch (e) { return { canvas: c, removed: false }; }
  const d = id.data;
  const corners = [0, (w - 1), (h - 1) * w, h * w - 1];
  const transparent = corners.some(i => d[i * 4 + 3] < 200);
  if (!transparent) {
    // color de fondo = promedio de los pixeles del borde
    let r = 0, g = 0, b = 0, n = 0;
    const add = i => { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; };
    for (let i = 0; i < w; i++) { add(i); add((h - 1) * w + i); }
    for (let j = 0; j < h; j++) { add(j * w); add(j * w + w - 1); }
    r /= n; g /= n; b /= n;
    const dist = i => { const dr = d[i * 4] - r, dg = d[i * 4 + 1] - g, db = d[i * 4 + 2] - b; return Math.sqrt(dr * dr + dg * dg + db * db); };
    const run = tol => {
      const seen = new Uint8Array(w * h); const q = new Int32Array(w * h); let qs = 0, qe = 0, cnt = 0;
      const push = i => { if (!seen[i] && dist(i) <= tol) { seen[i] = 1; q[qe++] = i; } };
      for (let i = 0; i < w; i++) { push(i); push((h - 1) * w + i); }
      for (let j = 0; j < h; j++) { push(j * w); push(j * w + w - 1); }
      while (qs < qe) {
        const i = q[qs++]; cnt++;
        const px = i % w, py = (i / w) | 0;
        if (px > 0) push(i - 1); if (px < w - 1) push(i + 1);
        if (py > 0) push(i - w); if (py < h - 1) push(i + w);
      }
      return { seen, ratio: cnt / (w * h) };
    };
    let res = run(40), tol = 40;
    if (res.ratio > 0.72) { res = run(14); tol = 14; }
    if (res.ratio > 0.72 || res.ratio < 0.01) return { canvas: c, removed: false };
    const seen = res.seen;
    for (let i = 0; i < w * h; i++) {
      if (seen[i]) { d[i * 4 + 3] = 0; continue; }
      // suavizar el borde: pixeles junto al fondo se vuelven semi-transparentes
      const px = i % w, py = (i / w) | 0;
      const near = (px > 0 && seen[i - 1]) || (px < w - 1 && seen[i + 1]) || (py > 0 && seen[i - w]) || (py < h - 1 && seen[i + w]);
      if (near) { const k = Math.min(1, Math.max(0.15, (dist(i) - tol) / (tol * 1.2))); d[i * 4 + 3] = Math.round(d[i * 4 + 3] * k); }
    }
    x.putImageData(id, 0, 0);
  }
  // recortar al contenido
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (d[(j * w + i) * 4 + 3] > 12) { if (i < minX) minX = i; if (i > maxX) maxX = i; if (j < minY) minY = j; if (j > maxY) maxY = j; }
  }
  if (maxX <= minX || maxY <= minY) return { canvas: c, removed: false };
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = document.createElement('canvas'); out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return { canvas: out, removed: !transparent };
}

function applyTint() {
  if (!garment) return;
  if (!cfg.tint) { garmentTinted = garment; return; }
  const t = document.createElement('canvas'); t.width = garment.width; t.height = garment.height;
  const x = t.getContext('2d');
  x.drawImage(garment, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = 0.55; x.fillStyle = cfg.tint; x.fillRect(0, 0, t.width, t.height);
  garmentTinted = t;
}

function loadGarment(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const r = removeBackground(img);
      garment = r.canvas; aspect = garment.height / garment.width; applyTint();
      post('garment', { removedBackground: r.removed });
      resolve();
    };
    img.onerror = () => { post('error', 'garment'); resolve(); };
    img.src = src;
  });
}

// ---------- Camara ----------
async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: cfg.facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

async function loadDetector() {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const vision = await import(base + '/vision_bundle.mjs');
  const fileset = await vision.FilesetResolver.forVisionTasks(base + '/wasm');
  const model = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const make = delegate => vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await make('GPU'); } catch (e) { landmarker = await make('CPU'); }
}

// ---------- Geometria ----------
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x); // de a hacia b
function smooth(key, p, a) {
  const o = sm[key];
  if (!o) { sm[key] = Object.assign({}, p); return sm[key]; }
  for (const k in p) o[k] = o[k] + (p[k] - o[k]) * a;
  return o;
}
const vis = (lm, i, min) => (lm[i].visibility === undefined || lm[i].visibility >= (min || 0.45));

// Devuelve lista de {key, ax, ay, w, h, rot, ox, oy}: ancla (ax, ay), tamano y desplazamiento relativo del dibujo.
function fit(lm, W, H) {
  const P = i => ({ x: lm[i].x * W, y: lm[i].y * H });
  const sf = cfg.sizeFactor || 1;
  const k = cfg.kind;
  const out = [];
  const shouldersOk = vis(lm, 11) && vis(lm, 12);
  if (k === 'top' || k === 'top-wide' || k === 'back') {
    if (!shouldersOk) return out;
    const L = P(11), R = P(12), sw = dist(L, R), m = mid(L, R), rot = ang(R, L);
    const hipsOk = vis(lm, 23, 0.3) && vis(lm, 24, 0.3);
    const torso = hipsOk ? dist(m, mid(P(23), P(24))) : sw * 1.45;
    if (k === 'back') {
      const w = sw * 1.2 * sf, h = w * aspect;
      out.push({ key: 'back', ax: m.x, ay: m.y + torso * 0.45, w, h, rot, ox: -0.5, oy: -0.5 });
    } else {
      const w = sw * (k === 'top-wide' ? 2.0 : 1.75) * sf;
      const h = w * aspect * 0.6 + torso * (k === 'top-wide' ? 1.35 : 1.2) * sf * 0.4;
      out.push({ key: 'top', ax: m.x, ay: m.y, w, h, rot, ox: -0.5, oy: -0.08 });
    }
  } else if (k === 'bottom' || k === 'shorts') {
    if (!(vis(lm, 23, 0.35) && vis(lm, 24, 0.35))) return out;
    const L = P(23), R = P(24), hw = dist(L, R), m = mid(L, R), rot = ang(R, L);
    let len;
    if (k === 'shorts') {
      len = vis(lm, 25, 0.3) && vis(lm, 26, 0.3) ? dist(m, mid(P(25), P(26))) * 0.95 : hw * 1.7;
    } else if (vis(lm, 27, 0.3) && vis(lm, 28, 0.3)) len = dist(m, mid(P(27), P(28))) * 1.06;
    else if (vis(lm, 25, 0.3) && vis(lm, 26, 0.3)) len = dist(m, mid(P(25), P(26))) * 2.0;
    else len = hw * 4.6;
    const w = hw * 2.35 * sf;
    out.push({ key: 'bottom', ax: m.x, ay: m.y, w, h: len, rot, ox: -0.5, oy: -0.07 });
  } else if (k === 'feet') {
    const sw = shouldersOk ? dist(P(11), P(12)) : W * 0.3;
    [27, 28].forEach((i, n) => {
      if (!vis(lm, i, 0.35)) return;
      const a = P(i), t = P(i + 4);
      const c = vis(lm, i + 4, 0.3) ? mid(a, t) : { x: a.x, y: a.y + sw * 0.15 };
      const w = sw * 0.62, h = w * aspect;
      out.push({ key: 'foot' + n, ax: c.x, ay: c.y, w, h, rot: 0, ox: -0.5, oy: -0.5 });
    });
  } else if (k === 'head' || k === 'glasses' || k === 'headphones') {
    if (!(vis(lm, 7, 0.3) && vis(lm, 8, 0.3))) return out;
    const eL = P(7), eR = P(8), ed = dist(eL, eR), m = mid(eL, eR), rot = ang(eR, eL);
    const eyes = mid(P(2), P(5));
    if (k === 'head') {
      const w = ed * 1.7, h = w * aspect;
      out.push({ key: 'head', ax: m.x, ay: eyes.y - ed * 0.32, w, h, rot, ox: -0.5, oy: -1 });
    } else if (k === 'glasses') {
      const w = dist(P(2), P(5)) * 2.5, h = w * aspect;
      out.push({ key: 'glasses', ax: eyes.x, ay: eyes.y, w, h, rot: ang(P(5), P(2)), ox: -0.5, oy: -0.5 });
    } else {
      const w = ed * 1.85, h = w * aspect;
      out.push({ key: 'phones', ax: m.x, ay: m.y - ed * 0.18, w, h, rot, ox: -0.5, oy: -0.5 });
    }
  } else if (k === 'wrist') {
    const sw = shouldersOk ? dist(P(11), P(12)) : W * 0.3;
    const i = vis(lm, 15, 0.4) ? 15 : (vis(lm, 16, 0.4) ? 16 : -1);
    if (i < 0) return out;
    const wr = P(i), w = sw * 0.34, h = w * aspect;
    out.push({ key: 'wrist', ax: wr.x, ay: wr.y, w, h, rot: 0, ox: -0.5, oy: -0.5 });
  }
  return out;
}

function drawGarment(shapes) {
  const img = garmentTinted || garment;
  if (!img) return;
  shapes.forEach(s => {
    const p = smooth(s.key, { ax: s.ax, ay: s.ay, w: s.w, h: s.h, rot: s.rot }, 0.4);
    ctx.save();
    ctx.translate(p.ax, p.ay);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 0.97;
    ctx.drawImage(img, s.ox * p.w, s.oy * p.h, p.w, p.h);
    ctx.restore();
  });
}

function setPose(ok) { if (ok !== poseOk) { poseOk = ok; post('pose', ok); } }

function frame() {
  requestAnimationFrame(frame);
  if (video.readyState < 2 || !video.videoWidth) return;
  const W = video.videoWidth, H = video.videoHeight;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const mirror = cfg.facing === 'user';
  ctx.save();
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, W, H);
  let shapes = [];
  if (landmarker && garment) {
    if (video.currentTime !== lastT) {
      lastT = video.currentTime;
      try {
        const r = landmarker.detectForVideo(video, performance.now());
        const lm = r && r.landmarks && r.landmarks[0];
        if (lm) { shapes = fit(lm, W, H); window.__last = shapes; }
        else window.__last = [];
      } catch (e) { window.__last = []; }
    } else shapes = window.__last || [];
    if (shapes.length) { lastSeen = performance.now(); setPose(true); }
    else if (performance.now() - lastSeen > 700) { setPose(false); sm = {}; }
    else shapes = window.__lastDrawn || [];
    if (shapes.length) window.__lastDrawn = shapes;
    drawGarment(shapes);
  }
  ctx.restore();
}

// ---------- Mensajes desde React Native ----------
async function onMsg(ev) {
  let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.type === 'init') {
    Object.assign(cfg, { kind: m.kind, tint: m.tint || null, sizeFactor: m.sizeFactor || 1, facing: m.facing || 'user' });
    if (started) return; started = true;
    try { await startCamera(); post('camera', true); } catch (e) { post('error', 'camera'); return; }
    requestAnimationFrame(frame);
    const timeout = setTimeout(() => post('error', 'detector'), 40000);
    try { await Promise.all([loadGarment(m.garment), loadDetector()]); clearTimeout(timeout); post('ready', true); }
    catch (e) { clearTimeout(timeout); post('error', 'detector'); }
  } else if (m.type === 'config') {
    if (m.tint !== undefined) { cfg.tint = m.tint; applyTint(); }
    if (m.sizeFactor) cfg.sizeFactor = m.sizeFactor;
  } else if (m.type === 'facing') {
    cfg.facing = m.value; sm = {};
    try { await startCamera(); } catch (e) { post('error', 'camera'); }
  } else if (m.type === 'capture') {
    try { post('photo', canvas.toDataURL('image/png')); } catch (e) { post('error', 'capture'); }
  }
}
document.addEventListener('message', onMsg);
window.addEventListener('message', onMsg);
post('loaded', true);
</script></body></html>`;
