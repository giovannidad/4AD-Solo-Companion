// Mappa 2D su foglio quadrettato: le stanze sono "disegnate a matita" e si adattano ai quadretti.
export const SHEET = { w: 20, h: 28 };     // 20x28 quadretti, come consigliato dal manuale

const PAPER = '#f4efe0', GRAPHITE = [46, 46, 54];
export const qualita = { leggera: false };   // true: niente ombre sfocate né animazione a matita
let host, canvas, ctx, W = 0, H = 0, dpr = 1;
const view = { x: SHEET.w / 2, y: SHEET.h / 2, zoom: 24 };
const tiles = new Map();                    // id -> {d, img, proc, anim, drawn}
let selectedId = null, tileCb = () => {}, selectCb = () => {};
let drag = null, raf = 0, paperPattern = null;
let tokens = [], tokenCb = () => {}, dblCb = () => {};
export const onTokenMove = cb => { tokenCb = cb; };
export const onTileDouble = cb => { dblCb = cb; };

export const onTileChange = cb => { tileCb = cb; };
export const onTileSelect = cb => { selectCb = cb; };

// ---------------- geometria ----------------
function dims(d) {
  const s = d.scale || 1;
  const bw = d.w / d.cx * s, bh = d.h / d.cy * s;
  return (d.rot || 0) % 2 ? { bw, bh, dw: bh, dh: bw } : { bw, bh, dw: bw, dh: bh };
}
/** Offset (in quadretti) della prima linea di griglia dell'immagine, dopo specchio/rotazione. */
function align(d) {
  const s = d.scale || 1, g = dims(d);
  if (s !== 1) return { ...g, fx: 0, fy: 0 };
  let w = d.w / d.cx, h = d.h / d.cy;
  let fx = (d.ox / d.cx) % 1, fy = (d.oy / d.cy) % 1;
  if (d.flip) fx = ((w - fx) % 1 + 1) % 1;
  for (let k = 0; k < (d.rot || 0) % 4; k++) { const nfx = ((h - fy) % 1 + 1) % 1; fy = fx; fx = nfx; [w, h] = [h, w]; }
  return { ...g, fx, fy };
}
/** Nessun aggancio alla griglia: le stanze si posizionano liberamente (al pixel). */
function snapCenter(d, cx, cy) { return [cx, cy]; }
const toScreen = (x, y) => [(x - view.x) * view.zoom + W / 2, (y - view.y) * view.zoom + H / 2];
const toWorld = (px, py) => [(px - W / 2) / view.zoom + view.x, (py - H / 2) / view.zoom + view.y];

let rtPending = false;
function retargetSoon() { if (rtPending) return; rtPending = true; queueMicrotask(() => { rtPending = false; retarget(); invalidate(); }); }

// ---------------- immagine "a matita" ----------------
function pencilize(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), p = im.data;
  // tessere a colori con sfondo trasparente (testura in pietra): si usano così come sono
  let trasp = 0; for (let i = 3; i < p.length; i += 4) if (p[i] < 200) trasp++;
  if (trasp > p.length / 4 * 0.005) return c;
  for (let i = 0; i < p.length; i += 4) {
    const L = (p[i] + p[i + 1] + p[i + 2]) / 765;              // 0 nero .. 1 bianco
    if (L > 0.93) { p[i] = 249; p[i + 1] = 245; p[i + 2] = 231; p[i + 3] = 255; continue; }
    const grain = 1 - Math.random() * 0.16 * (1 - L);          // grana della grafite
    const k = Math.min(1, L * 1.05);
    p[i] = (GRAPHITE[0] + (240 - GRAPHITE[0]) * k) * grain;
    p[i + 1] = (GRAPHITE[1] + (238 - GRAPHITE[1]) * k) * grain;
    p[i + 2] = (GRAPHITE[2] + (226 - GRAPHITE[2]) * k) * grain;
    p[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------------- gestione tessere ----------------
export function upsertTile(d) {
  retargetSoon();
  d.src = d.src.replace(/\.png$/, '.webp');   // salvataggi vecchi: le immagini ora sono WebP
  let e = tiles.get(d.id);
  if (!e) {
    e = { d, proc: null, anim: null };
    tiles.set(d.id, e);
    const img = new Image();
    img.onload = () => { e.proc = pencilize(img); if (e.wantAnim) startAnim(e); invalidate(); };
    img.src = d.src;
  } else e.d = d;
  invalidate();
}
export function setTiles(list) {
  for (const id of [...tiles.keys()]) if (!list.find(t => t.id === id)) removeTile(id);
  list.forEach(upsertTile);
}
export function removeTile(id) { tiles.delete(id); retargetSoon(); if (selectedId === id) selectedId = null; invalidate(); }
export function selectTile(id) { selectedId = id; selectCb(id ? tiles.get(id)?.d : null); invalidate(); }
export const getSelected = () => (selectedId ? tiles.get(selectedId)?.d : null);
export function updateTile(patch) {
  const e = selectedId && tiles.get(selectedId); if (!e) return;
  Object.assign(e.d, patch);
  [e.d.x, e.d.z] = snapCenter(e.d, e.d.x, e.d.z);
  tileCb(e.d, 'edit'); selectCb(e.d); invalidate();
}
export const rotateSelected = (dir = 1) => { const d = getSelected(); if (d) updateTile({ rot: ((d.rot || 0) + dir + 4) % 4 }); };
export const flipSelected = () => { const d = getSelected(); if (d) updateTile({ flip: !d.flip }); };
export const scaleSelected = f => { const d = getSelected(); if (d) updateTile({ scale: Math.max(0.4, Math.min(3, +((d.scale || 1) * f).toFixed(3))) }); };

/** Fa "scrivere a matita" la stanza. */
export function animate(id) {
  const e = tiles.get(id); if (!e) return;
  if (qualita.leggera) { e.drawn = true; invalidate(); return; }
  if (e.proc) startAnim(e); else e.wantAnim = true;
}
function startAnim(e) {
  e.wantAnim = false;
  const w = e.proc.width, h = e.proc.height, sp = Math.max(9, Math.round(h / 22));
  e.anim = { t0: performance.now(), dur: Math.min(3600, 1100 + w * h / 55), mask: mk(w, h), tmp: mk(w, h), sp, rows: Math.ceil(h / sp) + 1, w, h, pos: 0, tip: [0, 0] };
  invalidate();
}
function animPoint(a, pos) {
  const r = Math.min(a.rows - 1, Math.floor(pos / a.w)), t = pos - r * a.w;
  const x = r % 2 === 0 ? t : a.w - t;
  return [x, Math.min(a.h, r * a.sp + a.sp * 0.5 + Math.sin(x * 0.06 + r * 1.7) * a.sp * 0.18)];
}
function stepAnim(e, now) {
  const a = e.anim; if (!a) return;
  const p = Math.min(1, (now - a.t0) / a.dur), total = a.rows * a.w, target = p * total;
  const m = a.mask.getContext('2d'); m.strokeStyle = '#000'; m.lineWidth = a.sp * 1.35; m.lineCap = 'round'; m.lineJoin = 'round';
  m.beginPath(); let [px, py] = animPoint(a, a.pos); m.moveTo(px, py);
  for (let q = a.pos + 6; q < target; q += 6) { const [x, y] = animPoint(a, q); m.lineTo(x, y); }
  const end = animPoint(a, target); m.lineTo(end[0], end[1]); m.stroke();
  a.pos = target; a.tip = end;
  if (p >= 1) { e.anim = null; e.drawn = true; }
}

// ---------------- disegno ----------------
function drawPaper() {
  ctx.fillStyle = '#1c140d'; ctx.fillRect(0, 0, W, H);
  const sr = sheetRect();
  const [x0, y0] = toScreen(sr.x0, sr.y0), [x1, y1] = toScreen(sr.x1, sr.y1), z = view.zoom;
  // ombra del foglio: due rettangoli sfumati a costo quasi nullo (niente shadowBlur, lento sulle GPU vecchie)
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x0 + 3, y0 + 4, x1 - x0, y1 - y0);
  ctx.fillStyle = PAPER; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (!paperPattern) {
    const c = mk(128, 128), g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,100,60,${Math.random() * 0.07})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1); }
    paperPattern = ctx.createPattern(c, 'repeat');
  }
  ctx.fillStyle = paperPattern; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineWidth = 1;
  for (let i = sr.x0; i <= sr.x1; i++) { const [x] = toScreen(i, 0); ctx.strokeStyle = i % 5 === 0 ? 'rgba(70,120,175,.55)' : 'rgba(70,120,175,.28)'; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, y0); ctx.lineTo(Math.round(x) + .5, y1); ctx.stroke(); }
  for (let j = sr.y0; j <= sr.y1; j++) { const [, y] = toScreen(0, j); ctx.strokeStyle = j % 5 === 0 ? 'rgba(70,120,175,.55)' : 'rgba(70,120,175,.28)'; ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + .5); ctx.lineTo(x1, Math.round(y) + .5); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(200,70,60,.35)'; ctx.beginPath(); ctx.moveTo(x0 + z * 1, y0); ctx.lineTo(x0 + z * 1, y1); ctx.stroke(); // margine
}

function drawTile(e, now, pencils) {
  const d = e.d; if (!e.proc) return;
  const z = view.zoom, { bw, bh, dw, dh } = dims(d);
  const [sx, sy] = toScreen(d.x, d.z);
  if (!e.anim && (sx + dw * z / 2 < 0 || sx - dw * z / 2 > W || sy + dh * z / 2 < 0 || sy - dh * z / 2 > H)) return;   // fuori schermo
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate((d.rot || 0) * Math.PI / 2); ctx.scale(d.flip ? -1 : 1, 1);
  const x = -bw * z / 2, y = -bh * z / 2, w = bw * z, h = bh * z;
  if (d.pending) {
    ctx.globalAlpha = 0.62; ctx.drawImage(e.proc, x, y, w, h);
  } else if (e.anim) {
    stepAnim(e, now);
    if (e.anim) {
      const a = e.anim, t = a.tmp.getContext('2d');
      t.clearRect(0, 0, a.w, a.h); t.globalCompositeOperation = 'source-over'; t.drawImage(e.proc, 0, 0);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(a.mask, 0, 0); t.globalCompositeOperation = 'source-over';
      ctx.drawImage(a.tmp, x, y, w, h);
      const m = ctx.getTransform(), p = m.transformPoint(new DOMPoint(x + a.tip[0] / a.w * w, y + a.tip[1] / a.h * h));
      pencils.push([p.x / dpr, p.y / dpr]);
    } else ctx.drawImage(e.proc, x, y, w, h);
  } else ctx.drawImage(e.proc, x, y, w, h);
  ctx.restore();
  // cornice della selezione / ghost
  if (d.pending || d.id === selectedId) {
    ctx.save(); ctx.setLineDash(d.pending ? [8, 5] : [3, 4]); ctx.lineWidth = 2; ctx.strokeStyle = d.pending ? '#d08a14' : '#2f7fb8';
    ctx.strokeRect(sx - dw * z / 2, sy - dh * z / 2, dw * z, dh * z); ctx.restore();
  }
  // numerino scritto a mano
  if (!d.pending && !e.anim && (d.idx || d.tipo === 'ingresso')) {
    ctx.save(); ctx.font = `${Math.max(11, z * 0.62)}px "Bradley Hand","Noteworthy","Segoe Script","Comic Sans MS",cursive`;
    ctx.fillStyle = 'rgba(40,40,60,.9)'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const lx = sx - dw * z / 2 + z * 0.55, ly = sy - dh * z / 2 + z * 0.55;
    ctx.strokeStyle = 'rgba(40,40,60,.7)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(lx, ly, z * 0.42, z * 0.38, -0.2, 0.2, Math.PI * 2 - 0.1); ctx.stroke();
    ctx.fillText(d.tipo === 'ingresso' ? 'E' : String(d.idx), lx, ly + 1);
    if (d.perquisita) ctx.fillText('P', lx + z * 0.95, ly);
    ctx.restore();
  }
}

function drawPencil(x, y, now) {
  ctx.save(); ctx.translate(x, y + Math.sin(now / 40) * 1.5); ctx.rotate(-0.62);
  ctx.fillStyle = '#ecd2a8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, -7); ctx.lineTo(30, 7); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#2d2d33'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, -2.4); ctx.lineTo(9, 2.4); ctx.fill();
  ctx.fillStyle = '#e3a21f'; ctx.fillRect(30, -7, 78, 14); ctx.fillStyle = '#b87b0d'; ctx.fillRect(30, 3, 78, 4);
  ctx.fillStyle = '#c9ccd2'; ctx.fillRect(108, -7, 9, 14); ctx.fillStyle = '#e08c93'; ctx.fillRect(117, -7, 10, 14);
  ctx.restore();
}

function frame(now) {
  raf = 0;
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPaper();
  const pencils = [];
  const list = [...tiles.values()].sort((a, b) => (a.d.pending ? 1 : 0) - (b.d.pending ? 1 : 0));
  for (const e of list) drawTile(e, now, pencils);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mov = stepTokens(); drawTokens(now);
  pencils.forEach(p => drawPencil(p[0], p[1], now));
  if (mov || [...tiles.values()].some(e => e.anim || e.wantAnim)) invalidate();
}
function invalidate() { if (!raf) raf = requestAnimationFrame(frame); }

// ---------------- segnalini dei personaggi ----------------
/** list: [{id, label, color, stato, tileId}] nell'ordine di marcia. I segnalini scivolano da una stanza all'altra. */
export function setTokens(list) {
  const old = new Map(tokens.map(t => [t.id, t]));
  tokens = list.map(t => { const o = old.get(t.id); return { x: o?.x, y: o?.y, ...t, tx: o?.tx, ty: o?.ty }; });
  retarget(); invalidate();
}
function retarget() {
  const groups = new Map();
  tokens.forEach(t => { const e = tiles.get(t.tileId); if (!e || e.d.pending) { t.hidden = true; return; } t.hidden = false; (groups.get(t.tileId) || groups.set(t.tileId, []).get(t.tileId)).push(t); });
  for (const [id, arr] of groups) {
    const d = tiles.get(id).d, n = arr.length, cols = Math.min(n, 2), rows = Math.ceil(n / 2);
    arr.forEach((t, k) => {
      const c = k % 2, r = Math.floor(k / 2);
      t.tx = d.x + (c - (cols - 1) / 2) * 0.95; t.ty = d.z + (r - (rows - 1) / 2) * 0.95;
      if (t.x == null) { t.x = t.tx; t.y = t.ty; }
    });
  }
}
function stepTokens() {
  let moving = false;
  for (const t of tokens) {
    if (t.hidden || t === drag?.token) continue;
    const dx = t.tx - t.x, dy = t.ty - t.y;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) { t.x += dx * 0.16; t.y += dy * 0.16; moving = true; } else { t.x = t.tx; t.y = t.ty; }
  }
  return moving;
}
function drawTokens(now) {
  const z = view.zoom, r = Math.max(9, z * 0.42);
  for (const t of tokens) {
    if (t.hidden || t.x == null) continue;
    const [sx, sy0] = toScreen(t.x, t.y), lift = (t === drag?.token ? 8 : 0), sy = sy0 - lift;
    const dead = t.stato === 'morto', stone = t.stato === 'pietra';
    ctx.save();
    if (!qualita.leggera) { ctx.shadowColor = '#0008'; ctx.shadowBlur = 8 + lift; ctx.shadowOffsetY = 3 + lift; }
    const g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.1, sx, sy, r);
    const col = dead || stone ? '#8a8a8a' : t.color; g.addColorStop(0, '#ffffff66'); g.addColorStop(0.25, col); g.addColorStop(1, shade(col, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.lineWidth = 2.4; ctx.strokeStyle = t.activo ? '#ffd45c' : '#1b1b22'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 1.05)}px Palatino, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dead ? '\u2020' : (t.label || '?'), sx, sy + 1);
    ctx.restore();
  }
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v + (f < 0 ? v : 255 - v) * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function tokenAt(px, py) {
  const r = Math.max(9, view.zoom * 0.42);
  for (const t of [...tokens].reverse()) { if (t.hidden || t.x == null) continue; const [sx, sy] = toScreen(t.x, t.y); if (Math.hypot(px - sx, py - sy) <= r + 2) return t; }
  return null;
}

// ---------------- posizionamento automatico ----------------
function rectOf(d) { const { dw, dh } = dims(d); return [d.x - dw / 2, d.z - dh / 2, d.x + dw / 2, d.z + dh / 2]; }
const overlap = (a, b) => a[0] < b[2] - 0.3 && a[2] > b[0] + 0.3 && a[1] < b[3] - 0.3 && a[3] > b[1] + 0.3;
function libera(d, altre) {
  const r = rectOf(d);
  return !altre.some(o => o.id !== d.id && !o.pending && overlap(r, rectOf(o)));
}
/** Mette la stanza accanto a quella di riferimento (sopra, a sinistra, a destra, sotto) o nel primo spazio libero. */
export function autoPlace(d, ref, altre) {
  const { dw, dh } = dims(d);
  const cand = [];
  if (ref) {
    const rr = rectOf(ref), cx = (rr[0] + rr[2]) / 2, cy = (rr[1] + rr[3]) / 2;
    cand.push([cx, rr[1] - dh / 2], [rr[0] - dw / 2, cy], [rr[2] + dw / 2, cy], [cx, rr[3] + dh / 2]);
  }
  const ox = ref ? ref.x : SHEET.w / 2, oy = ref ? ref.z : SHEET.h / 2;
  for (let k = 1; k <= 14; k++) for (let dx = -k; dx <= k; dx++) for (let dy = -k; dy <= k; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === k) cand.push([ox + dx * 2, oy + dy * 2]);
  for (const [x, y] of cand) {
    [d.x, d.z] = snapCenter(d, x, y);
    if (libera(d, altre)) return true;
  }
  [d.x, d.z] = snapCenter(d, SHEET.w / 2, SHEET.h / 2); return false;
}
export function placeBottom(d) { const { dh } = dims(d); [d.x, d.z] = snapCenter(d, SHEET.w / 2, SHEET.h - dh / 2); }
export function ensureVisible(d) {
  const [sx, sy] = toScreen(d.x, d.z);
  if (sx < 40 || sy < 40 || sx > W - 40 || sy > H - 40) { view.x = d.x; view.y = d.z; invalidate(); }
}

// ---------------- foglio che cresce con il dungeon ----------------
const PAD = 3;   // quadretti di margine attorno alle stanze
/** Il foglio parte da 20x28 quadretti e si espande (in tutte le direzioni) man mano che il dungeon cresce. */
export function sheetRect() {
  let x0 = 0, y0 = 0, x1 = SHEET.w, y1 = SHEET.h;
  for (const e of tiles.values()) {
    const r = rectOf(e.d);
    x0 = Math.min(x0, Math.floor(r[0]) - PAD); y0 = Math.min(y0, Math.floor(r[1]) - PAD);
    x1 = Math.max(x1, Math.ceil(r[2]) + PAD); y1 = Math.max(y1, Math.ceil(r[3]) + PAD);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// ---------------- viste ----------------
export function setView(nome) {
  if (nome === 'fit') { const r = sheetRect(); view.zoom = Math.max(6, Math.min((W - 40) / r.w, (H - 40) / r.h)); view.x = (r.x0 + r.x1) / 2; view.y = (r.y0 + r.y1) / 2; }
  else if (nome === 'in') view.zoom = Math.min(90, view.zoom * 1.25);
  else if (nome === 'out') view.zoom = Math.max(4, view.zoom / 1.25);
  invalidate();
}

// ---------------- interazione ----------------
function hit(wx, wy) {
  const list = [...tiles.values()].sort((a, b) => (a.d.pending ? 1 : 0) - (b.d.pending ? 1 : 0));
  for (const e of list.reverse()) { const r = rectOf(e.d); if (wx >= r[0] && wx <= r[2] && wy >= r[1] && wy <= r[3]) return e; }
  return null;
}
function pos(ev) { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
function onDown(ev) {
  if (ev.button > 1) return;
  const [px, py] = pos(ev), [wx, wy] = toWorld(px, py);
  canvas.setPointerCapture(ev.pointerId); canvas.focus();
  const tk = ev.button === 0 ? tokenAt(px, py) : null;
  if (tk) { drag = { kind: 'token', token: tk }; invalidate(); return; }
  const e = ev.button === 0 ? hit(wx, wy) : null;
  if (e) { selectTile(e.d.id); drag = { kind: 'tile', e, dx: e.d.x - wx, dy: e.d.z - wy, moved: false }; }
  else { if (ev.button === 0) selectTile(null); drag = { kind: 'pan', px, py, vx: view.x, vy: view.y }; }
}
function onMove(ev) {
  if (!drag) return;
  const [px, py] = pos(ev);
  if (drag.kind === 'token') { const [wx, wy] = toWorld(px, py); drag.token.x = wx; drag.token.y = wy; }
  else if (drag.kind === 'pan') { view.x = drag.vx - (px - drag.px) / view.zoom; view.y = drag.vy - (py - drag.py) / view.zoom; }
  else { const [wx, wy] = toWorld(px, py); [drag.e.d.x, drag.e.d.z] = snapCenter(drag.e.d, wx + drag.dx, wy + drag.dy); drag.moved = true; retarget(); }
  invalidate();
}
function onUp(ev) {
  if (drag?.kind === 'tile' && drag.moved) tileCb(drag.e.d, 'move');
  if (drag?.kind === 'token') { const t = drag.token, e = hit(t.x, t.y); drag = null; if (e && !e.d.pending && e.d.id !== t.tileId) tokenCb(t.id, e.d.id); retarget(); invalidate(); return; }
  drag = null;
}
function onWheel(ev) {
  ev.preventDefault();
  const [px, py] = pos(ev), [wx, wy] = toWorld(px, py);
  view.zoom = Math.max(4, Math.min(90, view.zoom * Math.exp(-ev.deltaY * 0.0012)));
  view.x = wx - (px - W / 2) / view.zoom; view.y = wy - (py - H / 2) / view.zoom; invalidate();
}
function onKey(ev) {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (!getSelected()) return;
  if (ev.key === 'r' || ev.key === 'R') rotateSelected(ev.shiftKey ? -1 : 1);
  else if (ev.key === 'f' || ev.key === 'F') flipSelected();
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  const first = !W;
  dpr = qualita.leggera ? 1 : Math.min(devicePixelRatio || 1, 2); W = w; H = h;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  if (first) setView('fit');
  invalidate();
}
export function initMap(el) {
  host = el; canvas = document.createElement('canvas'); canvas.tabIndex = 0; canvas.style.touchAction = 'none'; canvas.style.outline = 'none';
  ctx = canvas.getContext('2d'); host.appendChild(canvas);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', ev => { const [px, py] = pos(ev), e = hit(...toWorld(px, py)); if (e && !e.d.pending) dblCb(e.d.id); else setView('fit'); });
  window.addEventListener('keydown', onKey);
  new ResizeObserver(resize).observe(host); resize();
}
