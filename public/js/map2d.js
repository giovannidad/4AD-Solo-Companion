// Mappa 2D su foglio quadrettato: le stanze sono "disegnate a matita" e si adattano ai quadretti.
export const SHEET = { w: 20, h: 28 };     // 20x28 quadretti, come consigliato dal manuale

const PAPER = '#f4efe0', GRAPHITE = [46, 46, 54];
// ---- temi del foglio: sfondo, griglia e testi cambiano con il set di tessere scelto per il dungeon ----
const TEMI = {
  carta: { fuori: '#1c140d', base: PAPER, gr: '70,120,175', a1: .28, a2: .55, testo: 'rgba(40,30,20,.92)', testo2: 'rgba(40,30,20,.6)', margine: true, tex: null },
  classico: null, foresta: null   // il fondale è lo stesso per tutti gli stili: cambiano solo le tessere
};
TEMI.classico = TEMI.foresta = TEMI.carta;
let tema = TEMI.carta;
/** Sceglie il tema del foglio (carta, classico, foresta) in base al set di tessere del dungeon. */
export function setTema(nome) { const t = TEMI[nome] || TEMI.carta; if (t === tema) return; tema = t; paperPattern = null; invalidate(); }
function texturaCarta(g) {
  const S = 256, c = mk(S, S), gg = c.getContext('2d'); gg.fillStyle = tema.base; gg.fillRect(0, 0, S, S);
  if (tema.tex) tema.tex(gg, S);
  else { c.width = c.height = 128; gg.fillStyle = tema.base; gg.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { gg.fillStyle = `rgba(120,100,60,${Math.random() * 0.07})`; gg.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1); } }
  return g.createPattern(c, 'repeat');
}
export const qualita = { leggera: false };   // true: niente ombre sfocate né animazione a matita
let host, canvas, ctx, W = 0, H = 0, dpr = 1;
const view = { x: SHEET.w / 2, y: SHEET.h / 2, zoom: 24 };
const tiles = new Map();                    // id -> {d, img, proc, anim, drawn}
let selectedId = null, tileCb = () => {}, selectCb = () => {};
let drag = null, raf = 0, paperPattern = null;
let tokens = [], tokenCb = () => {}, dblCb = () => {};
export const onTokenMove = cb => { tokenCb = cb; };
/** Permessi dell'ospite di una partita cooperativa: non sposta le stanze e muove solo i propri segnalini. */
export const permessi = { tessere: true, token: () => true };
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
/** Opzioni del foglio: snap to grid (le linee della stanza coincidono con i quadretti del foglio). */
export const opzioni = { snap: true, assist: true, matita: true };
try { const v = localStorage.getItem('fad-snap'); if (v !== null) opzioni.snap = v === '1'; const a = localStorage.getItem('fad-assist'); if (a !== null) opzioni.assist = a === '1'; const m = localStorage.getItem('fad-matita'); if (m !== null) opzioni.matita = m === '1'; } catch { /* predefinito */ }
export function setMatita(on) { opzioni.matita = !!on; try { localStorage.setItem('fad-matita', on ? '1' : '0'); } catch { /* ok */ } }
export function setAssist(on) { opzioni.assist = !!on; try { localStorage.setItem('fad-assist', on ? '1' : '0'); } catch { /* ok */ } }
export function setSnap(on) { opzioni.snap = !!on; try { localStorage.setItem('fad-snap', on ? '1' : '0'); } catch { /* ok */ } }
let snapTemp = true;   // false mentre si tiene premuto Alt: spostamento libero
/** Con lo snap attivo il centro viene spostato in modo che la griglia disegnata sulla stanza cada sui quadretti del foglio. */
function snapCenter(d, cx, cy) {
  if (!opzioni.snap || !snapTemp) return [cx, cy];
  const a = align(d);
  return [Math.round(cx - a.dw / 2 + a.fx) - a.fx + a.dw / 2, Math.round(cy - a.dh / 2 + a.fy) - a.fy + a.dh / 2];
}
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
  if (qualita.leggera || !opzioni.matita) { e.drawn = true; e.wantAnim = false; e.anim = null; invalidate(); return; }   // senza l'effetto a matita la stanza compare subito
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
// Il foglio è disegnato con pochi comandi: la texture della carta una volta sola (contiene già il colore) e le linee della griglia
// raggruppate in due tratti (normali e ogni 5 quadretti). Un livello in cache è stato provato ma non dava vantaggi misurabili.
function drawPaper() {
  const g = ctx, sr = sheetRect(), z = view.zoom;
  g.fillStyle = tema.fuori; g.fillRect(0, 0, W, H);
  const [x0, y0] = toScreen(sr.x0, sr.y0), [x1, y1] = toScreen(sr.x1, sr.y1);
  // ombra del foglio: due rettangoli sfumati a costo quasi nullo (niente shadowBlur, lento sulle GPU vecchie)
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x0 + 3, y0 + 4, x1 - x0, y1 - y0);
  if (!paperPattern) paperPattern = texturaCarta(g);
  g.fillStyle = paperPattern; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.lineWidth = 1;
  const linee = (stile, test) => {
    g.strokeStyle = stile; g.beginPath();
    for (let i = sr.x0; i <= sr.x1; i++) if (test(i)) { const x = Math.round(toScreen(i, 0)[0]) + .5; g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let j = sr.y0; j <= sr.y1; j++) if (test(j)) { const y = Math.round(toScreen(0, j)[1]) + .5; g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke();
  };
  linee(`rgba(${tema.gr},${tema.a1})`, i => i % 5 !== 0);
  linee(`rgba(${tema.gr},${tema.a2})`, i => i % 5 === 0);
  if (tema.margine) { g.strokeStyle = 'rgba(200,70,60,.35)'; g.beginPath(); g.moveTo(x0 + z * 1, y0); g.lineTo(x0 + z * 1, y1); g.stroke(); } // margine
}

const LIVELLI = [32, 64];   // pixel per quadretto dei livelli ridotti (oltre al raster nativo, 128)
/** Sorgente della tessera adatta allo zoom: il raster nativo ridotto a metà/quarto evita di ricampionare ogni volta un'immagine molto più grande dello schermo. */
function fonteTessera(e, z) {
  const d = e.d, nat = d.cx, serve = z * dpr;                  // pixel per quadretto richiesti sullo schermo
  const lv = LIVELLI.find(l => l >= serve * 1.1 && l < nat);
  if (!lv) return e.proc;
  if (e.mip?.da === e.proc && e.mip.liv === lv) return e.mip.c;
  const f = lv / nat, c = mk(Math.max(1, Math.round(e.proc.width * f)), Math.max(1, Math.round(e.proc.height * f))), g = c.getContext('2d');
  g.imageSmoothingQuality = 'high'; g.drawImage(e.proc, 0, 0, c.width, c.height);
  e.mip = { da: e.proc, liv: lv, c }; return c;
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
    ctx.globalAlpha = 0.62; ctx.drawImage(fonteTessera(e, z), x, y, w, h);
  } else if (e.anim) {
    stepAnim(e, now);
    if (e.anim) {
      const a = e.anim, t = a.tmp.getContext('2d');
      t.clearRect(0, 0, a.w, a.h); t.globalCompositeOperation = 'source-over'; t.drawImage(e.proc, 0, 0);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(a.mask, 0, 0); t.globalCompositeOperation = 'source-over';
      ctx.drawImage(a.tmp, x, y, w, h);
      const m = ctx.getTransform(), p = m.transformPoint(new DOMPoint(x + a.tip[0] / a.w * w, y + a.tip[1] / a.h * h));
      pencils.push([p.x / dpr, p.y / dpr]);
    } else ctx.drawImage(fonteTessera(e, z), x, y, w, h);
  } else ctx.drawImage(fonteTessera(e, z), x, y, w, h);
  ctx.restore();
  // cornice della selezione / ghost
  if (d.pending || d.id === selectedId) {
    ctx.save(); ctx.setLineDash(d.pending ? [8, 5] : [3, 4]); ctx.lineWidth = 2; ctx.strokeStyle = d.pending ? '#d08a14' : '#2f7fb8';
    ctx.strokeRect(sx - dw * z / 2, sy - dh * z / 2, dw * z, dh * z); ctx.restore();
  }
  // stanza dove ci si può riposare senza problemi: alone verde
  if (!d.pending && sicuraFn?.(d)) {
    ctx.save(); const [bx, by] = toScreen(d.x, d.z); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(70,200,110,.9)'; ctx.fillStyle = 'rgba(70,200,110,.10)'; ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.roundRect(bx - dw * z / 2 + 2, by - dh * z / 2 + 2, dw * z - 4, dh * z - 4, 6); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // numerino scritto a mano
  if (!d.pending && !e.anim && (d.idx || d.tipo === 'ingresso')) {
    ctx.save(); ctx.font = `${Math.max(11, z * 0.62)}px "Bradley Hand","Noteworthy","Segoe Script","Comic Sans MS",cursive`;
    ctx.fillStyle = 'rgba(40,40,60,.9)'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const [lx, ly] = toScreen(...posEtichetta(d));
    ctx.strokeStyle = 'rgba(40,40,60,.7)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(lx, ly, z * 0.42, z * 0.38, -0.2, 0.2, Math.PI * 2 - 0.1); ctx.stroke();
    ctx.fillText(d.tipo === 'ingresso' ? 'E' : String(d.idx), lx, ly + 1);
    if (d.perquisita) ctx.fillText('P', lx + z * 0.9, ly);
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

/** Diagnostica: permette a misura() di escludere parti del fotogramma. */
export const _salta = { carta: false, tessere: false, segnalini: false };
function frame(now) {
  raf = 0;
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!_salta.carta) drawPaper(); else { ctx.fillStyle = tema.fuori; ctx.fillRect(0, 0, W, H); }
  const pencils = [];
  const list = [...tiles.values()].sort((a, b) => (a.d.pending ? 1 : 0) - (b.d.pending ? 1 : 0));
  if (!_salta.tessere) for (const e of list) drawTile(e, now, pencils);
  drawUscite();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mov = stepTokens(); if (!_salta.segnalini) drawTokens(now);
  pencils.forEach(p => drawPencil(p[0], p[1], now));
  if (mov || [...tiles.values()].some(e => e.anim || e.wantAnim)) invalidate();
}
/** Disegna la mappa esplorata (tutte le stanze, il foglio quadrettato e il titolo; i segnalini dei personaggi non vengono disegnati) in un canvas fuori schermo per l'esportazione. */
export function renderEsportazione({ titolo = '', zoom = 48, segnalini = false } = {}) {
  const lista = [...tiles.values()].filter(e => !e.d.pending && e.proc);
  if (!lista.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of lista) { const r = rectOf(e.d); x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  const M = 1.5, T = titolo ? 3.2 : 0;
  x0 = Math.floor(x0) - M; y0 = Math.floor(y0) - M - T; x1 = Math.ceil(x1) + M; y1 = Math.ceil(y1) + M;
  const maxPx = 7000; zoom = Math.min(zoom, maxPx / (x1 - x0), maxPx / (y1 - y0));
  const w = Math.round((x1 - x0) * zoom), h = Math.round((y1 - y0) * zoom), cv = mk(w, h), g = cv.getContext('2d');
  const salvato = { ctx, W, H, dpr, vx: view.x, vy: view.y, vz: view.zoom, sicuraFn, sel: selectedId, drag };
  try {
    ctx = g; W = w; H = h; dpr = 1; view.x = (x0 + x1) / 2; view.y = (y0 + y1) / 2 + T / 2; view.zoom = zoom; sicuraFn = null; selectedId = null; drag = null;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = tema.tex ? texturaCarta(g) : tema.base; g.fillRect(0, 0, w, h);
    g.lineWidth = 1; const tracciati = (stile, test) => { g.strokeStyle = stile; g.beginPath(); for (let i = Math.ceil(x0); i <= x1; i++) if (test(i)) { const x = Math.round((i - x0) * zoom) + .5; g.moveTo(x, 0); g.lineTo(x, h); } for (let j = Math.ceil(y0); j <= y1; j++) if (test(j)) { const y = Math.round((j - y0) * zoom) + .5; g.moveTo(0, y); g.lineTo(w, y); } g.stroke(); };
    tracciati(`rgba(${tema.gr},${tema.a1})`, i => i % 5 !== 0); tracciati(`rgba(${tema.gr},${tema.a2})`, i => i % 5 === 0);
    for (const e of lista) { const anim = e.anim; e.anim = null; try { drawTile(e, performance.now(), []); } finally { e.anim = anim; } }
    if (segnalini) { const mov = tokens.map(t => [t, t.x, t.y]); try { drawTokens(0); } finally { mov.forEach(([t, x, y]) => { t.x = x; t.y = y; }); } }
    if (titolo) {
      g.fillStyle = tema.testo; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = `bold ${Math.round(zoom * 0.9)}px Palatino, Georgia, serif`; g.fillText(titolo, M * zoom, (M + 0.7) * zoom);
      g.font = `${Math.round(zoom * 0.42)}px Palatino, Georgia, serif`; g.fillStyle = tema.testo2; g.fillText('Four Against Darkness – mappa del dungeon', M * zoom, (M + 1.55) * zoom);
    }
  } finally {
    ctx = salvato.ctx; W = salvato.W; H = salvato.H; dpr = salvato.dpr; view.x = salvato.vx; view.y = salvato.vy; view.zoom = salvato.vz; sicuraFn = salvato.sicuraFn; selectedId = salvato.sel; drag = salvato.drag;
    invalidate();
  }
  return cv;
}
let sicuraFn = null;
export function setSicuraFn(f) { sicuraFn = f; invalidate(); }
export const ridisegna = () => invalidate();
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
const sprites = new Map(), immagini = new Map();
/** Immagine del ritratto di un segnalino, caricata in modo asincrono (al termine si ridisegnano gli sprite). */
function immagineSegnalino(url) {
  let im = immagini.get(url);
  if (!im) { im = new Image(); im.onload = () => { sprites.clear(); invalidate(); }; im.src = url; if (immagini.size > 40) immagini.clear(); immagini.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}
/** Sprite di un segnalino (gradiente, ombra, bordo e lettera) disegnato una volta sola per colore/stato/dimensione. */
function spriteSegnalino(t, r, lift) {
  const dead = t.stato === 'morto', stone = t.stato === 'pietra', chiave = `${t.color}|${t.label}|${t.imgId || ''}|${dead ? 'm' : stone ? 'p' : ''}|${t.activo ? 1 : 0}|${Math.round(r * 10)}|${lift}|${dpr}|${qualita.leggera ? 1 : 0}`;
  let sp = sprites.get(chiave); if (sp) return sp;
  const foto = t.img ? immagineSegnalino(t.img) : null;
  const pad = Math.ceil(r * 0.4 + 12 + lift), dim = Math.ceil((r + pad) * 2 * dpr), c = mk(dim, dim), g = c.getContext('2d');
  g.scale(dpr, dpr); const cx = r + pad, cy = r + pad - lift * 0 - 0;
  if (!qualita.leggera) { g.shadowColor = '#0008'; g.shadowBlur = 8 + lift; g.shadowOffsetY = 3 + lift; }
  const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  const col = dead || stone ? '#8a8a8a' : t.color; gr.addColorStop(0, '#ffffff66'); gr.addColorStop(0.25, col); gr.addColorStop(1, shade(col, -0.45));
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  if (foto) {   // ritratto in un cerchio, con anello del colore della classe (grigio e con croce se caduto/pietrificato)
    g.save(); g.beginPath(); g.arc(cx, cy, r - 1.5, 0, Math.PI * 2); g.clip(); g.drawImage(foto, cx - r, cy - r, r * 2, r * 2);
    if (dead || stone) { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(cx - r, cy - r, r * 2, r * 2); }
    g.restore();
    g.lineWidth = 3; g.strokeStyle = t.activo ? '#ffd45c' : col; g.beginPath(); g.arc(cx, cy, r - 1, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = '#1b1b22'; g.beginPath(); g.arc(cx, cy, r + .6, 0, Math.PI * 2); g.stroke();
    if (dead) { g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 1.1)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u2020', cx, cy + 1); }
  } else {
    g.lineWidth = 2.4; g.strokeStyle = t.activo ? '#ffd45c' : '#1b1b22'; g.stroke();
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 1.05)}px Palatino, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(dead ? '\u2020' : (t.label || '?'), cx, cy + 1);
  }
  sp = { c, off: r + pad }; if (sprites.size > 80) sprites.clear(); sprites.set(chiave, sp); return sp;
}
function drawTokens(now) {
  const z = view.zoom, r = Math.max(9, z * 0.42);
  for (const t of tokens) {
    if (t.hidden || t.x == null) continue;
    const [sx, sy0] = toScreen(t.x, t.y), lift = (t === drag?.token ? 8 : 0), sy = sy0 - lift;
    const sp = spriteSegnalino(t, r, lift);
    ctx.drawImage(sp.c, sx - sp.off, sy - sp.off, sp.c.width / dpr, sp.c.height / dpr);
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
/** Rettangolo del solo pavimento (senza il margine di muri e alone delle stanze vettoriali): serve ad affiancare le stanze. */
function rectOf(d) { const { dw, dh } = dims(d), p = d.svg || (d.src || '').endsWith('.svg') ? (d.ox || 0) / d.cx * (d.scale || 1) : 0; return [d.x - dw / 2 + p, d.z - dh / 2 + p, d.x + dw / 2 - p, d.z + dh / 2 - p]; }
const overlap = (a, b) => a[0] < b[2] - 0.3 && a[2] > b[0] + 0.3 && a[1] < b[3] - 0.3 && a[3] > b[1] + 0.3;
function libera(d, altre) {
  const r = rectOf(d);
  return !altre.some(o => o.id !== d.id && !o.pending && overlap(r, rectOf(o)));
}
/** Mette la stanza accanto a quella di riferimento (sopra, a sinistra, a destra, sotto) o nel primo spazio libero. */
export function autoPlace(d, ref, altre) {
  if (opzioni.assist && !d.pendingManuale && assistStart(d, ref)) return true;
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
  if (ev.button === 0 && assistClick(wx, wy)) return;
  let tk = ev.button === 0 ? tokenAt(px, py) : null;
  if (tk && !permessi.token(tk.id)) tk = null;
  if (tk) { drag = { kind: 'token', token: tk }; invalidate(); return; }
  const e = ev.button === 0 && permessi.tessere ? hit(wx, wy) : null;
  if (e) { selectTile(e.d.id); drag = { kind: 'tile', e, dx: e.d.x - wx, dy: e.d.z - wy, moved: false }; }
  else { if (ev.button === 0) selectTile(null); drag = { kind: 'pan', px, py, vx: view.x, vy: view.y }; }
}
function onMove(ev) {
  if (!drag) return;
  const [px, py] = pos(ev);
  if (drag.kind === 'token') { const [wx, wy] = toWorld(px, py); drag.token.x = wx; drag.token.y = wy; }
  else if (drag.kind === 'pan') { view.x = drag.vx - (px - drag.px) / view.zoom; view.y = drag.vy - (py - drag.py) / view.zoom; }
  else { snapTemp = !ev.altKey; const [wx, wy] = toWorld(px, py); [drag.e.d.x, drag.e.d.z] = snapCenter(drag.e.d, wx + drag.dx, wy + drag.dy); drag.moved = true; retarget(); }
  invalidate();
}
function onUp(ev) {
  snapTemp = true;
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


// =============================================================
//  USCITE DELLE STANZE E POSIZIONAMENTO ASSISTITO
//  Ogni tessera vettoriale conosce le sue porte (data/rules/tiles.json: `celle`, `porte` in quadretti dal pavimento).
//  Una nuova stanza si appoggia a una porta libera della stanza di partenza: porta contro porta, nel verso opposto.
// =============================================================
/** Punto del foglio dove scrivere il numero della stanza: il quadretto di pavimento più vicino al centro della stanza
 *  (per l'ingresso, il primo quadretto bianco in ordine di lettura). Senza dati vettoriali, il centro della tessera. */
const centriEtichetta = new Map();
export function posEtichetta(d) {
  const m = metaDi(d);
  if (!m?.celle?.length) return [d.x, d.z];
  const chiave = (d.tipo === 'ingresso' ? 'i' : 't') + d.n;
  let loc = centriEtichetta.get(chiave);
  if (!loc) {
    const pad = m.ox / m.cx, cs = [...m.celle].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (d.tipo === 'ingresso') loc = cs[0];
    else {
      const mx = cs.reduce((a, c) => a + c[0] + .5, 0) / cs.length, my = cs.reduce((a, c) => a + c[1] + .5, 0) / cs.length;
      loc = cs.reduce((b, c) => (Math.hypot(c[0] + .5 - mx, c[1] + .5 - my) < Math.hypot(b[0] + .5 - mx, b[1] + .5 - my) ? c : b), cs[0]);
    }
    loc = [pad + loc[0] + .5, pad + loc[1] + .5]; centriEtichetta.set(chiave, loc);
  }
  return trasf(d).pt(loc[0], loc[1]);
}

let TDATA = null, TSETS = {};
export function setTileData(t, sets) { TDATA = t; TSETS = sets || {}; }
/** Geometria (quadretti e porte) della tessera: ogni set tematico ha la propria, riconosciuta dalla cartella dell'immagine. */
const metaDi = d => ((TSETS[/\/set-(\w+)\//.exec(d.src || '')?.[1]]) || TDATA)?.[d.tipo === 'ingresso' ? 'ingressi' : 'tiles']?.[d.n];
const SENO = [0, 1, 0, -1], COSENO = [1, 0, -1, 0];
/** Trasformazione locale → foglio di una tessera (rotazione, specchio, centro). */
function trasf(d) {
  const s = d.scale || 1, bw = d.w / d.cx, bh = d.h / d.cy, r = ((d.rot || 0) % 4 + 4) % 4, c = COSENO[r], sn = SENO[r];
  return {
    pt: (lx, ly) => { let x = (lx - bw / 2) * s; const y = (ly - bh / 2) * s; if (d.flip) x = -x; return [d.x + x * c - y * sn, d.z + x * sn + y * c]; },
    vec: (nx, ny) => { if (d.flip) nx = -nx; return [nx * c - ny * sn, nx * sn + ny * c]; }
  };
}
/** Le uscite (porte) di una tessera in coordinate del foglio, con la normale che punta fuori dal pavimento. */
export function exitsOf(d) {
  const m = metaDi(d); if (!m?.porte?.length) return [];
  const pad = m.ox / m.cx, celle = new Set(m.celle.map(c => c[0] + ',' + c[1])), T = trasf(d);
  return m.porte.map(([o, i, j], k) => {
    let lx, ly, n;
    if (o === 'h') { lx = pad + i + 0.5; ly = pad + j; n = [0, celle.has(i + ',' + j) ? -1 : 1]; }
    else { lx = pad + i; ly = pad + j + 0.5; n = [celle.has(i + ',' + j) ? -1 : 1, 0]; }
    const [x, y] = T.pt(lx, ly), [nx, ny] = T.vec(n[0], n[1]);
    return { tile: d, k, x, y, nx: Math.round(nx), ny: Math.round(ny) };
  });
}
/** Quadretti occupati dal pavimento, come chiavi "i,j" del reticolo del foglio. */
function cellsWorld(d) {
  const m = metaDi(d); if (!m?.celle) return [];
  const pad = m.ox / m.cx, T = trasf(d);
  return m.celle.map(([i, j]) => { const [x, y] = T.pt(pad + i + 0.5, pad + j + 0.5); return Math.round(x - 0.5) + ',' + Math.round(y - 0.5); });
}
/** Due stanze si toccano (un lato in comune, anche solo in parte): serve a calcolare il percorso fra stanze. */
export function vicine(a, b) {
  const r = rectOf(a), q = rectOf(b), g = 0.35;
  const oX = Math.min(r[2], q[2]) - Math.max(r[0], q[0]), oY = Math.min(r[3], q[3]) - Math.max(r[1], q[1]);
  return (oX > -g && oY > 0.3) || (oY > -g && oX > 0.3);
}
const stesse = (a, b) => Math.abs(a.x - b.x) < 0.25 && Math.abs(a.y - b.y) < 0.25 && a.nx === -b.nx && a.ny === -b.ny;
/** Uscite non ancora collegate a un'altra stanza. */
export function freeExits(soloTile) {
  const piazzate = [...tiles.values()].filter(e => !e.d.pending).map(e => e.d);
  const tutte = piazzate.flatMap(exitsOf);
  const lista = soloTile ? tutte.filter(x => x.tile.id === soloTile.id) : tutte;
  return lista.filter(x => !tutte.some(y => y.tile.id !== x.tile.id && stesse(x, y)));
}

const assist = { id: null, cand: [], k: 0, refs: [], refSel: -1 };
function candidati(d, refs) {
  const m = metaDi(d); if (!m?.porte?.length || !refs.length) return [];
  const occ = new Set();
  [...tiles.values()].filter(e => e.d.id !== d.id && !e.d.pending).forEach(e => cellsWorld(e.d).forEach(k => occ.add(k)));
  const out = [], visti = new Set();
  for (const flip of [false, true]) for (let rot = 0; rot < 4; rot++) {
    const t = { ...d, scale: 1, rot, flip, x: 0, z: 0 };
    for (const er of refs) for (const en of exitsOf(t)) {
      if (en.nx !== -er.nx || en.ny !== -er.ny) continue;
      const x = er.x - en.x, z = er.y - en.y, key = `${rot}${flip}${x.toFixed(2)}${z.toFixed(2)}`;
      if (visti.has(key)) continue; visti.add(key);
      if (cellsWorld({ ...t, x, z }).some(c => occ.has(c))) continue;
      out.push({ rot, flip, x, z, er });
    }
  }
  return out;
}
function applicaPos(d, c) { Object.assign(d, { rot: c.rot, flip: c.flip, scale: 1, x: c.x, z: c.z }); }
/** Posiziona d accanto a una porta libera di ref (o di una qualsiasi stanza). Restituisce true se ha trovato un posto. */
export function assistStart(d, ref) {
  if (!metaDi(d)?.porte?.length) return false;
  let refs = ref ? freeExits(tiles.get(ref.id)?.d) : [];
  let cand = candidati(d, refs);
  if (!cand.length) { refs = freeExits(); cand = candidati(d, refs); }
  if (!cand.length) { assist.id = null; return false; }
  Object.assign(assist, { id: d.id, cand, k: 0, refs, refSel: -1 });
  applicaPos(d, cand[0]); invalidate(); return true;
}
/** Firma dello stato dell'editor di mappa che influisce sull'interfaccia (selezione, posizionamento assistito). */
export const firmaUI = () => `${selectedId}|${assist.id}|${assist.k}|${assist.cand.length}|${assist.refSel}`;
export function assistInfo(id) { return assist.id && assist.id === id ? { k: assist.k, n: assist.cand.length, refSel: assist.refSel } : null; }
export function assistNext(dir = 1) {
  const e = tiles.get(assist.id); if (!e || !assist.cand.length) return;
  assist.k = (assist.k + dir + assist.cand.length) % assist.cand.length;
  applicaPos(e.d, assist.cand[assist.k]); tileCb(e.d, 'edit'); selectCb(e.d); invalidate();
}
function assistClick(wx, wy) {
  const e = tiles.get(assist.id); if (!e || !e.d.pending) return false;
  const hitIdx = assist.refs.findIndex(r => Math.hypot(r.x - wx, r.y - wy) < 0.6);
  if (hitIdx < 0) return false;
  const r = assist.refs[hitIdx], cand = candidati(e.d, [r]);
  if (!cand.length) { return true; }
  assist.cand = cand; assist.k = 0; assist.refSel = hitIdx; applicaPos(e.d, cand[0]); tileCb(e.d, 'edit'); selectCb(e.d); invalidate(); return true;
}
function drawUscite() {
  const e = tiles.get(assist.id); if (!e || !e.d.pending) return;
  const z = view.zoom, sel = assist.cand[assist.k]?.er;
  for (const r of assist.refs) {
    const [sx, sy] = toScreen(r.x, r.y), on = sel && Math.abs(sel.x - r.x) < 0.01 && Math.abs(sel.y - r.y) < 0.01;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(r.ny, r.nx));
    ctx.fillStyle = on ? '#2fa84f' : '#e08a14'; ctx.strokeStyle = '#1b1208'; ctx.lineWidth = 1.5;
    const a = z * (on ? 0.5 : 0.4);
    ctx.beginPath(); ctx.moveTo(a * 0.9, 0); ctx.lineTo(-a * 0.2, -a * 0.6); ctx.lineTo(-a * 0.2, a * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/** Diagnostica: tempo medio (ms) di un fotogramma, con o senza spostamento della vista. Restituisce {js, totale}: `js` è il tempo di
 *  preparazione dei comandi, `totale` include l'attesa della GPU (sincronizzata a fine ciclo). Si ripete 5 volte e si prende la mediana. */
export function misura(n = 40, spostamento = false) {
  const x0 = view.x, y0 = view.y, js = [], tot = [];
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { if (spostamento) { view.x = x0 + (i % 20) * 0.05; view.y = y0 + (i % 20) * 0.03; } frame(performance.now()); }
    const t1 = performance.now(); ctx.getImageData(0, 0, 1, 1); const t2 = performance.now();
    js.push((t1 - t0) / n); tot.push((t2 - t0) / n);
  }
  view.x = x0; view.y = y0;
  const med = a => +a.sort((p, q) => p - q)[2].toFixed(3);
  return { js: med(js), totale: med(tot) };
}
