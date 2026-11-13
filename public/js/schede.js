// Schede dei personaggi in formato grafico «fantasy» (pergamena, cornici e medaglioni), da stampare e usare al tavolo senza computer.
// Una pagina A4 per eroe; i campi sono quelli della scheda del manuale base. Il ritratto NON viene esportato: resta una cornice vuota da disegnare o incollare.
import { R, S } from './state.js';
import { armaDi, nomeClasse, modAttacco, modDifesa, NOME_ARMATURA } from './rules.js';
import { coloreClasse } from './ritratti.js';

const W = 1240, H = 1754, K = 2;   // A4 a 150 dpi, disegnato al doppio per la stampa
let INK = '#2b1b10', RED = '#7a1d14', GOLD = '#b8892b', PERG1 = '#f3e4bd', PERG2 = '#dcc08a', ECO = false;   // ECO: stampa solo in bianco e nero, senza sfondo
const SERIF = 'Palatino, "Palatino Linotype", Georgia, serif';

// ---- tratto a matita (stile A): linee a mano libera, doppio passaggio di grafite, sempre uguali per la stessa scheda ----
let seme = 11;
const rnd = () => (seme = (seme * 16807) % 2147483647) / 2147483647 - 0.5;
const AMP = 1.6;
/** Linea a mano libera da (a,b) a (c,d), con due passaggi di intensità diversa. */
function matita(g, a, b, c, d, w = 2, col = '#4a3a2c') {
  g.save(); g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const n = Math.max(2, Math.ceil(Math.hypot(c - a, d - b) / 40));
  for (let k = 0; k < 2; k++) {
    g.lineWidth = k ? w * 0.6 : w; g.globalAlpha = k ? 0.55 : 0.9; g.beginPath(); g.moveTo(a + rnd() * AMP, b + rnd() * AMP);
    for (let i = 1; i <= n; i++) { const f = i / n; g.lineTo(a + (c - a) * f + rnd() * AMP * 1.5, b + (d - b) * f + rnd() * AMP * 1.5); }
    g.stroke();
  }
  g.restore();
}
function rettM(g, x, y, w, h, lw, col) { matita(g, x, y, x + w, y, lw, col); matita(g, x + w, y, x + w, y + h, lw, col); matita(g, x + w, y + h, x, y + h, lw, col); matita(g, x, y + h, x, y, lw, col); }
function cerchioM(g, cx, cy, r, w, col) {
  g.save(); g.strokeStyle = col; g.lineCap = 'round';
  for (let k = 0; k < 2; k++) { g.lineWidth = k ? w * 0.6 : w; g.globalAlpha = k ? 0.55 : 0.9; g.beginPath(); for (let a = 0; a <= 6.5; a += 0.2) g.lineTo(cx + Math.cos(a) * (r + rnd() * AMP), cy + Math.sin(a) * (r + rnd() * AMP)); g.stroke(); }
  g.restore();
}
function polM(g, pts, w, col) { for (let i = 0; i < pts.length; i++) { const [a, b] = pts[i], [c, d] = pts[(i + 1) % pts.length]; matita(g, a, b, c, d, w, col); } }
function ombraTesto(g, s, x, y, col = INK) { g.fillStyle = col; g.fillText(s, x, y); }
function righe(g, testo, larg) {
  const out = []; let cur = '';
  for (const p of String(testo).split(' ')) { const t = cur ? cur + ' ' + p : p; if (g.measureText(t).width > larg && cur) { out.push(cur); cur = p; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function sfondo(g) {
  const gr = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1150); gr.addColorStop(0, PERG1); gr.addColorStop(1, PERG2);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (ECO) return;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // macchie di pergamena, sempre uguali
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(120,80,30,${0.015 + rnd() * 0.03})`; g.beginPath(); g.arc(rnd() * W, rnd() * H, 8 + rnd() * 60, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(90,50,20,.35)'; g.lineWidth = 14; g.strokeRect(0, 0, W, H);
}
function cornice(g, col) {
  rettM(g, 34, 34, W - 68, H - 68, 6, RED);
  rettM(g, 46, 46, W - 92, H - 92, 2.4, GOLD);
  rettM(g, 54, 54, W - 108, H - 108, 2.4, col);
  for (const [cx, cy, sx, sy] of [[46, 46, 1, 1], [W - 46, 46, -1, 1], [46, H - 46, 1, -1], [W - 46, H - 46, -1, -1]]) {   // angoli ornati
    g.save(); g.translate(cx, cy); g.scale(sx, sy);
    g.fillStyle = RED; g.beginPath(); g.moveTo(-14, -14); g.lineTo(46, -14); g.lineTo(14, 14); g.lineTo(-14, 46); g.closePath(); g.fill();
    polM(g, [[-14, -14], [46, -14], [14, 14], [-14, 46]], 3, GOLD);
    g.fillStyle = GOLD; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill();
    matita(g, 60, 0, 84, 8, 2, GOLD); matita(g, 84, 8, 90, 30, 2, GOLD); matita(g, 0, 60, 8, 84, 2, GOLD); matita(g, 8, 84, 30, 90, 2, GOLD);
    g.restore();
  }
}
function filetto(g, x, y, w) {
  matita(g, x, y, x + w / 2 - 14, y, 2.2, GOLD); matita(g, x + w / 2 + 14, y, x + w, y, 2.2, GOLD);
  g.fillStyle = RED; g.beginPath(); g.moveTo(x + w / 2, y - 7); g.lineTo(x + w / 2 + 8, y); g.lineTo(x + w / 2, y + 7); g.lineTo(x + w / 2 - 8, y); g.closePath(); g.fill();
}
function titolo(g, s, x, y, w) {
  g.font = `bold 30px ${SERIF}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; ombraTesto(g, s.toUpperCase().split('').join(' '), x, y, RED); filetto(g, x, y + 12, w);
}
function cuore(g, cx, cy, r, pieno) {
  g.beginPath(); g.moveTo(cx, cy + r * 0.9);
  g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.1, cx, cy - r * 0.35);
  g.bezierCurveTo(cx + r * 0.7, cy - r * 1.1, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.9); g.closePath();
  if (pieno) { g.fillStyle = ECO ? '#555' : '#b01e22'; g.fill(); }
  { const pts = []; for (let t = 0; t <= 1; t += 0.05) { const a = t * 6.2832, hx = 16 * Math.sin(a) ** 3, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); pts.push([cx + hx * r / 17, cy + hy * r / 17 - r * 0.1]); } polM(g, pts.filter((_, i) => i % 1 === 0), 2.4, ECO ? '#000' : pieno ? '#5a0d10' : '#6b5030'); }
}
function scatola(g, x, y, s, spuntata) {
  g.fillStyle = 'rgba(255,250,235,.7)'; g.fillRect(x, y, s, s); rettM(g, x, y, s, s, 2.4, INK);
  if (spuntata) { matita(g, x + 3, y + 3, x + s - 3, y + s - 3, 4, RED); matita(g, x + s - 3, y + 3, x + 3, y + s - 3, 4, RED); }
}
function medaglione(g, cx, cy, r, valore, etichetta, col) {
  const gr = g.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); gr.addColorStop(0, '#fff6dc'); gr.addColorStop(1, '#e3c98e');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  cerchioM(g, cx, cy, r, 5, col); cerchioM(g, cx, cy, r - 9, 2, GOLD);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${String(valore).length > 3 ? 36 : 54}px ${SERIF}`; ombraTesto(g, String(valore), cx, cy + 2);
  g.textBaseline = 'alphabetic'; g.font = `bold 20px ${SERIF}`; ombraTesto(g, etichetta.toUpperCase(), cx, cy + r + 28, RED);
}
const segno = n => (n > 0 ? '+' + n : String(n));

/** Disegna la scheda di un eroe e restituisce il canvas (A4, 2480×3508 px). */
export function renderScheda(e, { eco = false } = {}) {
  ECO = eco;
  if (eco) { INK = '#000'; RED = '#000'; GOLD = '#555'; PERG1 = PERG2 = '#fff'; } else { INK = '#2b1b10'; RED = '#7a1d14'; GOLD = '#b8892b'; PERG1 = '#f3e4bd'; PERG2 = '#dcc08a'; }
  const cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
  const g = cv.getContext('2d'); g.scale(K, K); g.lineJoin = 'round';
  const col = eco ? '#000' : coloreClasse(e.classe), c = R.classi[e.classe] || {};
  seme = 11; sfondo(g); cornice(g, col);
  const X = 100, DX = W - 200;

  // intestazione: nastro con nome e classe
  g.fillStyle = ECO ? '#fff' : RED; g.beginPath(); g.moveTo(X - 20, 100); g.lineTo(X + 760, 100); g.lineTo(X + 790, 142); g.lineTo(X + 760, 184); g.lineTo(X - 20, 184); g.lineTo(X + 10, 142); g.closePath(); g.fill();
  polM(g, [[X - 20, 100], [X + 760, 100], [X + 790, 142], [X + 760, 184], [X - 20, 184], [X + 10, 142]], 3, GOLD);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 62; g.font = `bold ${fs}px ${SERIF}`; while (g.measureText(e.nome).width > 680 && fs > 28) { fs -= 2; g.font = `bold ${fs}px ${SERIF}`; }
  g.fillStyle = ECO ? '#000' : '#fbeec7'; g.fillText(e.nome, X + 385, 144);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = `italic 34px ${SERIF}`; ombraTesto(g, `${nomeClasse(e)} · Livello ${e.livello}`, X, 236, col === '#ffffff' ? INK : INK);
  g.fillStyle = col; g.fillRect(X, 250, 330, 5);
  g.font = `italic 22px ${SERIF}`; ombraTesto(g, 'Four Against Darkness — Scheda del personaggio', X, 288, '#6b5030');

  // cornice vuota per il ritratto (non esportato)
  const px = W - 330, py = 90, pw = 230, ph = 230;
  g.fillStyle = 'rgba(255,250,235,.45)'; g.fillRect(px, py, pw, ph);
  rettM(g, px, py, pw, ph, 5, RED); rettM(g, px + 9, py + 9, pw - 18, ph - 18, 2, GOLD);
  g.textAlign = 'center'; g.font = `italic 20px ${SERIF}`; ombraTesto(g, 'Ritratto', px + pw / 2, py + ph / 2 + 6, '#9a8560');

  // medaglioni
  const att = modAttacco(e).tot, dif = modDifesa(e).tot;
  const med = [[segno(att), 'Attacco', '#8a2b1e'], [segno(dif), 'Difesa', '#2c4f7a'], [e.livello, 'Livello', col], [e.oro || 0, 'Oro', GOLD], [e.indizi || 0, 'Indizi', '#4b6a3a']].map(m => (eco ? [m[0], m[1], '#000'] : m));
  med.forEach(([v, l, cc], i) => medaglione(g, X + 80 + i * ((DX - 160) / 4), 410, 66, v, l, cc));

  // punti ferita
  let y = 560; titolo(g, 'Punti ferita', X, y, DX);
  g.textAlign = 'left'; g.font = `bold 26px ${SERIF}`; ombraTesto(g, `${e.pv} / ${e.pvMax}`, X + DX - 130, y);
  const n = Math.max(e.pvMax, 1), per = Math.min(n, 15), r = 25;
  for (let i = 0; i < n; i++) cuore(g, X + 30 + (i % per) * 62, y + 62 + Math.floor(i / per) * 62, r, i < e.pv);
  y += 62 + Math.floor((n - 1) / per) * 62 + 56;

  // equipaggiamento a sinistra, poteri a destra
  const colW = (DX - 40) / 2, xs = X, xd = X + colW + 40;
  let yl = y; titolo(g, 'Equipaggiamento', xs, yl, colW); yl += 50;
  g.textAlign = 'left'; g.font = `24px ${SERIF}`;
  const voce = (txt, sub) => { ombraTesto(g, txt, xs + 6, yl); if (sub) { g.textAlign = 'right'; ombraTesto(g, sub, xs + colW - 4, yl, RED); g.textAlign = 'left'; } yl += 36; };
  voce(`Armatura: ${NOME_ARMATURA[e.armatura] || 'Nessuna'}`, e.armatura === 'leggera' ? '+1' : e.armatura === 'pesante' ? '+2' : '');
  voce(`Scudo: ${e.scudo ? 'sì' : 'no'}`, e.scudo ? '+1' : '');
  voce(`Lanterna: ${e.lanterna ? 'sì' : 'no'}`);
  if (e.bonusMagico) voce('Arma magica', segno(e.bonusMagico)); if (e.bonusDifesa) voce('Armatura magica', segno(e.bonusDifesa));
  yl += 8; g.font = `bold 22px ${SERIF}`; ombraTesto(g, 'ARMI', xs + 6, yl, RED); yl += 34; g.font = `24px ${SERIF}`;
  (e.armi || []).forEach(id => { const a = armaDi(id); if (a) voce(`${id === e.armaPrincipale ? '★ ' : '• '}${a.nome}`, a.mod ? segno(a.mod) : ''); });
  if (!(e.armi || []).length) voce('Nessuna arma');
  for (let i = 0; i < 2; i++) { matita(g, xs + 6, yl + 4, xs + colW - 4, yl + 4, 1.5, 'rgba(60,40,20,.55)'); yl += 36; }

  let yr = y; titolo(g, 'Poteri della classe', xd, yr, colW); yr += 46;
  g.font = `20px ${SERIF}`; g.textAlign = 'left';
  for (const riga of righe(g, c.tratti || '', colW - 10)) { ombraTesto(g, riga, xd + 4, yr); yr += 27; }
  yr += 10;
  const lim = [['Benedizioni', 'benedizione', c.benedizioni], ['Guarigioni', 'guarigione', c.guarigioni], ['Furie', 'furie', c.furie ? Math.ceil(e.livello / 2) : 0], ['Fortuna', 'fortuna', c.fortuna ? e.livello + 1 : 0]];
  for (const [nome, chiave, max] of lim) {
    if (!max) continue; g.font = `bold 22px ${SERIF}`; ombraTesto(g, nome, xd + 4, yr + 22);
    for (let i = 0; i < max; i++) scatola(g, xd + 190 + i * 38, yr + 2, 28, i < (e.usi?.[chiave] || 0)); yr += 42;
  }
  if (c.incantatore || (e.incantesimi || []).length) {
    yr += 6; g.font = `bold 22px ${SERIF}`; ombraTesto(g, "INCANTESIMI", xd + 4, yr + 20, RED); yr += 52; g.font = `22px ${SERIF}`;
    (e.incantesimi || []).forEach(s => { scatola(g, xd + 4, yr - 20, 26, !!s.usato); ombraTesto(g, s.nome + (s.usato ? ' (usato)' : ''), xd + 44, yr); yr += 38; });
  }

  // oggetti, tratti e condizioni
  y = Math.max(yl, yr) + 24; titolo(g, 'Zaino e oggetti', X, y, DX); y += 44; g.font = `24px ${SERIF}`; g.textAlign = 'left';
  const og = (e.oggetti || []).map(o => `${o.nome}${o.qta > 1 ? ` ×${o.qta}` : ''}`);
  const rowsOg = Math.max(4, Math.ceil(og.length / 2));
  for (let i = 0; i < rowsOg; i++) {
    for (let k = 0; k < 2; k++) {
      const x0 = X + k * (DX / 2 + 10), w = DX / 2 - 20; matita(g, x0, y + 8, x0 + w, y + 8, 1.5, 'rgba(60,40,20,.55)');
      const t = og[i * 2 + k]; if (t) { g.font = `24px ${SERIF}`; ombraTesto(g, t, x0 + 4, y); }
    }
    y += 38;
  }
  y += 18; const trat = [...(e.tratti || []).map(t => `${t.nome}: ${t.testo}`), ...(e.traguardi || []).map(t => `Traguardo – ${t.nome} (${t.conta}/${t.obiettivo} ${t.unita})`)];
  const cond = [e.maledetto && 'Maledetto (−1)', e.zoppo && 'Zoppicante (−1)', e.follia && `Follia ${e.follia}`, e.stato === 'pietra' && 'Pietrificato', e.stato === 'morto' && 'Caduto'].filter(Boolean);
  if (trat.length || cond.length) {
    titolo(g, 'Tratti e condizioni', X, y, DX); y += 42; g.font = `20px ${SERIF}`;
    if (cond.length) { g.font = `bold 22px ${SERIF}`; ombraTesto(g, cond.join('   ·   '), X + 4, y, RED); y += 34; g.font = `20px ${SERIF}`; }
    for (const t of trat) for (const riga of righe(g, '• ' + t, DX - 10)) { if (y > H - 250) break; ombraTesto(g, riga, X + 4, y); y += 27; }
    y += 14;
  }
  const rimasto = H - 150 - y;
  if (rimasto > 90) {
    titolo(g, 'Appunti', X, y, DX); y += 40; g.font = `22px ${SERIF}`;
    for (const riga of righe(g, e.note || '', DX - 10)) { ombraTesto(g, riga, X + 4, y); y += 32; }
    for (; y < H - 130; y += 38) { matita(g, X, y, X + DX, y, 1.5, 'rgba(60,40,20,.5)'); }
  }
  g.textAlign = 'center'; g.font = `italic 18px ${SERIF}`; ombraTesto(g, 'Four Against Darkness è di Andrea Sfiligoi — scheda generata da 4AD Solo Companion', W / 2, H - 78, '#6b5030');
  if (!eco) return cv;
  const bn = document.createElement('canvas'); bn.width = cv.width; bn.height = cv.height;   // tutto in scala di grigi, contrasto alto
  const gb = bn.getContext('2d'); gb.fillStyle = '#fff'; gb.fillRect(0, 0, bn.width, bn.height); gb.filter = 'grayscale(1) contrast(1.35)'; gb.drawImage(cv, 0, 0);
  return bn;
}
