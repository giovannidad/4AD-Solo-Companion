// Ritratti degli eroi: un'immagine caricata dall'utente (ritagliata e ridotta nel browser) oppure un ritratto predefinito
// disegnato in SVG a seconda della classe. Le immagini caricate stanno in S.ritratti ({ idEroe: dataURL }), salvate a parte
// nel file ritratti.json della campagna, così non appesantiscono i dati degli eroi.
import { S, salva, modificato } from './state.js';
import { h, toast } from './util.js';

const COLORI = { guerriero: '#b8281f', barbaro: '#8a4a1c', chierico: '#b9a55a', elfo: '#2f7d46', furfante: '#5a4a9a', mago: '#2557a7', mezzuomo: '#9a7a22', nano: '#6a5a4a', arlecchino: '#c0397b', assassino: '#3a3a44', 'elfo-fuoco': '#d2631a', tiratore: '#3b7a8a', veterano: '#7a7a7a', spadaccino: '#a03060', 'chierico-elidra': '#b9709a', 'chierico-korimnos': '#8a7a30', druido: '#4f7a3a', 'elfo-silvano': '#2f6a46', 'guida-terre-selvagge': '#8a6a3a', 'signore-bestie': '#7a4a2a' };
Object.assign(COLORI, { cambione: '#7a2a5a', demonologo: '#5a1a1a', paladino: '#c9ccd2', 'chierico-zur': '#4a4a58', 'chierico-foryos': '#b8561f' });
export const coloreClasse = c => COLORI[c] || '#555';

// ---------------- ritratti predefiniti (SVG) ----------------
function prng(seed) { let x = 2166136261; for (const ch of String(seed)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
const scegli = (r, l) => l[Math.floor(r() * l.length)];
const PELLI = ['#f2cfae', '#e4b48c', '#c98f64', '#a86a45', '#7b4a2e'];
const CAPELLI = ['#2b1b10', '#5a3418', '#8a5a2b', '#c9a24a', '#a8a8a8', '#8a2a1a', '#1c1c24'];

function svgRitratto(classe, seed) {
  const r = prng(classe + seed), col = coloreClasse(classe), pelle = scegli(r, PELLI), capelli = scegli(r, CAPELLI), stile = Math.floor(r() * 3);
  const occhi = scegli(r, ['#2b1b10', '#1d3d6b', '#2f6b3a']);
  let dietro = '', davanti = '';
  const elfico = ['elfo', 'elfo-fuoco', 'elfo-silvano'].includes(classe);
  const orecchie = `<path d="M30 66 L${elfico ? 14 : 24} ${elfico ? 52 : 64} L33 78Z M98 66 L${elfico ? 114 : 104} ${elfico ? 52 : 64} L95 78Z" fill="${pelle}"/>`;
  // capelli (di base, poi ogni classe aggiunge copricapo e dettagli)
  const chioma = classe === 'elfo-fuoco'
    ? `<path d="M30 70 Q22 30 64 14 Q106 30 98 70 Q92 40 64 36 Q36 40 30 70Z M40 40 Q36 20 52 8 Q50 24 60 30Z M70 28 Q74 8 92 6 Q84 22 88 38Z" fill="#f08a2a"/><path d="M44 34 Q50 18 56 30Z M76 30 Q84 16 88 32Z" fill="#ffd45c"/>`
    : stile === 0 ? `<path d="M30 72 Q24 28 64 22 Q104 28 98 72 Q92 46 64 44 Q36 46 30 72Z" fill="${capelli}"/>`
    : stile === 1 ? `<path d="M28 96 Q20 26 64 20 Q108 26 100 96 L92 96 Q96 50 64 44 Q32 50 36 96Z" fill="${capelli}"/>`
    : `<path d="M32 62 Q28 32 64 26 Q100 32 96 62 Q80 40 64 44 Q48 40 32 62Z" fill="${capelli}"/>`;
  const barba = (c, lunga = false) => `<path d="M38 80 Q40 ${lunga ? 118 : 104} 64 ${lunga ? 122 : 108} Q88 ${lunga ? 118 : 104} 90 80 Q80 92 64 92 Q48 92 38 80Z" fill="${c}"/>`;
  switch (classe) {
    case 'guerriero':
      davanti = `<path d="M28 68 Q26 22 64 18 Q102 22 100 68 L90 68 Q90 40 64 38 Q38 40 38 68Z" fill="#9aa3ad" stroke="#4d555e" stroke-width="2"/><rect x="60" y="38" width="8" height="30" fill="#8a929c"/><path d="M64 18 Q60 4 78 6 Q70 14 70 22Z" fill="#b8281f"/>`; break;
    case 'barbaro':
      dietro = `<path d="M30 40 Q10 36 8 12 Q26 20 40 34Z M98 40 Q118 36 120 12 Q102 20 88 34Z" fill="#efe4c4" stroke="#8a7a50" stroke-width="2"/>`;
      davanti = `<path d="M28 66 Q26 24 64 20 Q102 24 100 66 Q96 44 64 42 Q32 44 28 66Z" fill="#6a4a2a"/><path d="M26 66 Q26 50 38 46 L40 60Z M102 66 Q102 50 90 46 L88 60Z" fill="#8a6a42"/>` + barba(capelli); break;
    case 'chierico':
      dietro = `<path d="M22 100 Q18 30 64 16 Q110 30 106 100Z" fill="#f4f0e4" stroke="#b9a55a" stroke-width="3"/>`;
      davanti = `<circle cx="64" cy="110" r="10" fill="#d8b23a" stroke="#7a5a10" stroke-width="2"/><path d="M64 102 V118 M56 110 H72" stroke="#7a5a10" stroke-width="3"/><circle cx="64" cy="10" r="0" />`; break;
    case 'elfo':
      davanti = `<path d="M30 70 Q24 28 64 22 Q104 28 98 70" fill="none" stroke="#c9d6a0" stroke-width="3"/><circle cx="64" cy="26" r="4" fill="#4fb36a" stroke="#1d5530"/><path d="M28 96 Q20 46 34 34 L36 96Z M100 96 Q108 46 94 34 L92 96Z" fill="${capelli}"/>`; break;
    case 'furfante':
      dietro = `<path d="M24 100 Q18 28 64 14 Q110 28 104 100Z" fill="#2b2540"/>`;
      davanti = `<path d="M30 62 Q64 50 98 62 L96 78 Q64 70 32 78Z" fill="#1a1626"/><path d="M34 80 Q64 118 94 80 L92 108 L36 108Z" fill="#3a3258"/>`; break;
    case 'mago':
      davanti = `<path d="M30 52 L64 -6 L98 52 Q64 62 30 52Z" fill="#2b4a9a" stroke="#142a5a" stroke-width="2"/><path d="M24 54 Q64 70 104 54 L100 62 Q64 76 28 62Z" fill="#1c3070"/><path d="M62 18 l3 7 7 .5 -5.5 4.5 2 7 -6.5 -4 -6.5 4 2 -7 -5.5 -4.5 7 -.5Z" fill="#ffd45c"/>` + barba('#e9e6df', true); break;
    case 'mezzuomo':
      davanti = `<g fill="${capelli}"><circle cx="38" cy="40" r="12"/><circle cx="54" cy="30" r="12"/><circle cx="74" cy="30" r="12"/><circle cx="90" cy="40" r="12"/><circle cx="64" cy="34" r="10"/></g><path d="M92 26 q12 -14 22 -4 q-8 14 -22 4Z" fill="#4fb36a"/>`; break;
    case 'nano':
      davanti = `<path d="M28 62 Q28 28 64 24 Q100 28 100 62 L92 62 Q90 42 64 40 Q38 42 36 62Z" fill="#6a6a72" stroke="#33333a" stroke-width="2"/><path d="M60 24 L64 10 L68 24Z" fill="#8a8a92"/>` + barba('#c9742a', true) + `<path d="M50 104 v12 M64 108 v14 M78 104 v12" stroke="#6a3a0a" stroke-width="3"/>`; break;
    case 'arlecchino':
      davanti = `<path d="M28 62 Q22 20 8 18 Q26 4 48 18 Q64 4 80 18 Q102 4 120 18 Q106 20 100 62Z" fill="#c0397b"/><path d="M64 62 L64 18 Q80 4 120 18 Q106 20 100 62Z" fill="#2b9ac0"/><circle cx="8" cy="18" r="5" fill="#ffd45c"/><circle cx="120" cy="18" r="5" fill="#ffd45c"/><circle cx="64" cy="6" r="5" fill="#ffd45c"/><path d="M34 104 l10 14 10 -14 10 14 10 -14 10 14 10 -14Z" fill="#fbf8ee" stroke="#c0397b" stroke-width="2"/>`; break;
    case 'assassino':
      dietro = `<path d="M24 100 Q18 28 64 14 Q110 28 104 100Z" fill="#1c1c22"/>`;
      davanti = `<path d="M30 62 Q64 52 98 62 L96 74 Q64 66 32 74Z" fill="#101014"/><path d="M34 82 Q64 120 94 82 L92 112 L36 112Z" fill="#7a1a1a"/>`; break;
    case 'tiratore':
      davanti = `<path d="M18 52 Q64 40 110 52 L106 58 Q64 48 22 58Z" fill="#5a3a1a"/><path d="M34 52 Q34 24 64 22 Q94 24 94 52Z" fill="#7a5a2a"/><circle cx="82" cy="68" r="9" fill="none" stroke="#c9ccd2" stroke-width="3"/><path d="M82 77 L84 96" stroke="#c9ccd2" stroke-width="1.5"/>`; break;
    case 'spadaccino':
      dietro = `<path d="M18 104 Q10 66 40 62 L88 62 Q118 66 110 104Z" fill="#7a1a3a"/>`;
      davanti = `<path d="M14 56 Q64 26 114 56 L102 62 Q64 44 26 62Z" fill="#2e2418"/><path d="M34 54 Q36 28 64 24 Q92 28 94 54Z" fill="#43321f"/><path d="M90 40 Q112 14 122 30 Q108 28 100 48Z" fill="#c0392b"/><path d="M50 84 Q64 90 78 84" fill="none" stroke="#2b1b10" stroke-width="3"/>`; break;
    case 'chierico-elidra':
      dietro = `<path d="M22 100 Q18 30 64 16 Q110 30 106 100Z" fill="#f6e4ee" stroke="#b9709a" stroke-width="3"/>`;
      davanti = `<path d="M44 30 Q64 12 84 30" fill="none" stroke="#e7c76a" stroke-width="3"/><circle cx="64" cy="18" r="4" fill="#e7c76a"/><path d="M50 106 Q47 122 58 124 M78 106 Q81 122 70 124 M50 106 Q64 98 78 106 M57 107 V122 M64 105 V123 M71 107 V122" stroke="#e7c76a" stroke-width="2.4" fill="none"/>`; break;
    case 'chierico-korimnos':
      dietro = `<path d="M22 100 Q18 30 64 16 Q110 30 106 100Z" fill="#3f6a3a" stroke="#d8b23a" stroke-width="3"/>`;
      davanti = `<path d="M42 38 Q30 24 36 6 M37 22 Q26 18 22 8 M86 38 Q98 24 92 6 M91 22 Q102 18 106 8 M64 30 Q64 14 64 4" stroke="#e0b93a" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="64" cy="112" r="9" fill="#e0b93a" stroke="#7a5a10" stroke-width="2"/>`; break;
    case 'druido':
      dietro = `<path d="M20 102 Q16 28 64 14 Q112 28 108 102Z" fill="#4a5f34" stroke="#2b3a1c" stroke-width="2"/>`;
      davanti = `<path d="M34 46 Q42 28 54 34 Q50 46 38 50Z M94 46 Q86 28 74 34 Q78 46 90 50Z M54 26 Q64 10 74 26 Q64 30 54 26Z" fill="#6fae4a" stroke="#2f5a1c" stroke-width="2"/>` + barba('#c9c4b4', true) + `<path d="M92 90 L104 128" stroke="#7a5a2a" stroke-width="5"/><circle cx="92" cy="88" r="6" fill="#6fae4a"/>`; break;
    case 'elfo-silvano':
      dietro = `<path d="M24 100 Q18 30 64 14 Q110 30 104 100Z" fill="#2f5a3a"/>`;
      davanti = `<path d="M30 56 Q64 36 98 56 L96 64 Q64 48 32 64Z" fill="#3f7a4a"/><path d="M88 40 Q104 10 118 14 Q106 24 98 46Z" fill="#c9a24a" stroke="#7a5a1a" stroke-width="1.5"/><path d="M96 52 L100 36" stroke="#7a5a1a" stroke-width="2"/><path d="M28 96 Q20 56 34 44 L36 96Z M100 96 Q108 56 94 44 L92 96Z" fill="${capelli}"/>`; break;
    case 'guida-terre-selvagge':
      davanti = `<path d="M8 54 Q64 38 120 54 L116 62 Q64 50 12 62Z" fill="#6a4a22"/><path d="M36 54 Q38 22 64 20 Q90 22 92 54Z" fill="#8a6a3a"/><path d="M84 28 Q106 6 122 16 Q104 22 94 40Z" fill="#c0392b"/><path d="M36 98 Q64 116 92 98 L90 118 Q64 126 38 118Z" fill="#a8452a"/><circle cx="64" cy="108" r="5" fill="none" stroke="#e0c46a" stroke-width="2"/>`; break;
    case 'signore-bestie':
      dietro = `<path d="M18 104 Q14 40 40 28 L40 8 L52 24 Q64 20 76 24 L88 8 L88 28 Q114 40 110 104Z" fill="#7a6a58" stroke="#3a2a1a" stroke-width="2"/>`;
      davanti = `<path d="M30 60 Q64 36 98 60 Q92 44 64 40 Q36 44 30 60Z" fill="#8a7a66"/><path d="M42 100 l4 14 4 -14 M56 104 l4 14 4 -14 M70 104 l4 14 4 -14 M84 100 l4 14 4 -14" stroke="#efe4c4" stroke-width="4" fill="none" stroke-linecap="round"/>`; break;
    case 'cambione':
      davanti = `<path d="M36 42 Q22 22 30 4 Q44 18 52 36Z M92 42 Q106 22 98 4 Q84 18 76 36Z" fill="#3a0f1f" stroke="#12060c" stroke-width="2"/><path d="M42 74 Q64 92 86 74" fill="none" stroke="#7a1a1a" stroke-width="3"/><circle cx="52" cy="66" r="3" fill="#ff5a3a"/><circle cx="76" cy="66" r="3" fill="#ff5a3a"/>`; break;
    case 'demonologo':
      dietro = `<path d="M22 104 Q16 30 64 14 Q112 30 106 104Z" fill="#2a0c10" stroke="#8a1a1a" stroke-width="2"/>`;
      davanti = `<path d="M44 34 L64 12 L84 34" fill="none" stroke="#c9302c" stroke-width="3"/><circle cx="64" cy="24" r="5" fill="none" stroke="#c9302c" stroke-width="2"/><path d="M50 52 l6 6 M78 52 l-6 6 M64 46 v8" stroke="#c9302c" stroke-width="3"/>`; break;
    case 'paladino':
      davanti = `<path d="M26 66 Q24 20 64 16 Q104 20 102 66 L92 66 Q92 38 64 36 Q36 38 36 66Z" fill="#c9ccd2" stroke="#6a707a" stroke-width="2"/><path d="M64 16 V36 M52 24 H76" stroke="#d8b23a" stroke-width="4"/><rect x="60" y="36" width="8" height="30" fill="#aeb3bb"/>`; break;
    case 'chierico-zur':
      dietro = `<path d="M22 100 Q18 30 64 16 Q110 30 106 100Z" fill="#26262e" stroke="#7a7a88" stroke-width="3"/>`;
      davanti = `<path d="M40 44 Q64 30 88 44 L88 52 Q64 40 40 52Z" fill="#d8d8e0"/><circle cx="52" cy="66" r="4" fill="#d8d8e0"/><circle cx="76" cy="66" r="4" fill="#d8d8e0"/><path d="M52 90 H76 M56 86 v8 M64 86 v8 M72 86 v8" stroke="#d8d8e0" stroke-width="2"/>`; break;
    case 'chierico-foryos':
      dietro = `<path d="M22 100 Q18 30 64 16 Q110 30 106 100Z" fill="#8a3a14" stroke="#e0a43a" stroke-width="3"/>`;
      davanti = `<path d="M30 56 Q64 20 98 56 L90 60 Q64 34 38 60Z" fill="#b8561f" stroke="#e0a43a" stroke-width="2"/><path d="M64 18 L72 4 L56 4Z" fill="#e0a43a"/><path d="M50 108 L78 128 M78 108 L50 128" stroke="#e0a43a" stroke-width="4"/>`; break;
    case 'veterano':
      davanti = `<path d="M28 58 Q64 40 100 58 L98 68 Q64 54 30 68Z" fill="#b8281f"/><path d="M84 54 L96 92" stroke="#7a2a2a" stroke-width="3"/>` + `<path d="M40 86 Q64 104 88 86 Q64 96 40 86Z" fill="#8a8a8a" opacity=".7"/>`; break;
  }
  const spalle = `<path d="M10 128 Q14 100 44 96 L84 96 Q114 100 118 128Z" fill="${col}" stroke="#00000055" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="f" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset="1" stop-color="#14100c"/></radialGradient></defs><rect width="128" height="128" fill="url(#f)"/>${dietro}${spalle}<rect x="54" y="84" width="20" height="18" fill="${pelle}"/>${orecchie}<ellipse cx="64" cy="64" rx="32" ry="36" fill="${pelle}"/>${chioma}<circle cx="52" cy="66" r="3.2" fill="${occhi}"/><circle cx="76" cy="66" r="3.2" fill="${occhi}"/><path d="M50 60 Q52 57 56 59 M72 59 Q76 57 78 60" stroke="${capelli}" stroke-width="2.4" fill="none"/><path d="M56 82 Q64 88 72 82" stroke="#7a3a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M64 70 L60 78 L66 78" stroke="#00000033" stroke-width="2" fill="none"/>${davanti}</svg>`;
}
const cacheSvg = new Map();
function predefinito(e) {
  const k = (e.culto || e.classe) + '|' + e.id; let u = cacheSvg.get(k);
  if (!u) { u = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgRitratto(e.culto || e.classe, e.id)); cacheSvg.set(k, u); }
  return u;
}

// ---------------- API ----------------
export const urlRitratto = e => (S.ritratti && S.ritratti[e.id]) || predefinito(e);
export const haRitrattoProprio = e => !!(S.ritratti && S.ritratti[e.id]);
/** Elemento <img> tondo con il ritratto dell'eroe. */
export const immagine = (e, dim = 40, cls = '') => h('img', { class: `ritratto ${cls}`.trim(), src: urlRitratto(e), width: dim, height: dim, alt: e.nome, draggable: 'false' });

/** Carica un'immagine dal disco: ritaglio quadrato centrale, ridotto a 256 px, WebP (o JPEG). */
export async function carica(e, file) {
  if (!file || !/^image\//.test(file.type)) { toast('Scegli un file immagine (PNG, JPG o WebP).', 'warn'); return false; }
  if (file.size > 15e6) { toast('Immagine troppo grande (massimo 15 MB).', 'warn'); return false; }
  const bmp = await createImageBitmap(file);
  const lato = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, (bmp.width - lato) / 2, (bmp.height - lato) / 2, lato, lato, 0, 0, 256, 256);
  let url = c.toDataURL('image/webp', 0.85); if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.85);
  (S.ritratti = S.ritratti || {})[e.id] = url;
  salva('ritratti'); modificato('party'); return true;
}
export function rimuovi(e) { if (S.ritratti) delete S.ritratti[e.id]; salva('ritratti'); modificato('party'); }
