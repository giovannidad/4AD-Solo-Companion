// Esportazione della mappa del dungeon in PNG o PDF (il PDF è scritto a mano: una pagina A4 con l'immagine JPEG).
import * as table from './map2d.js';
import { toast, scelta } from './util.js';
import { S } from './state.js';

const nomeFile = t => (t || 'mappa-dungeon').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mappa-dungeon';
function scarica(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const blobDi = (cv, tipo, q) => new Promise(res => cv.toBlob(res, tipo, q));

/** PDF di una pagina A4 (orizzontale o verticale secondo la mappa) con l'immagine JPEG a tutta pagina meno i margini. */
function creaPdf(jpeg, w, h) {
  const enc = new TextEncoder(), parti = [], offs = []; let len = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parti.push(u); len += u.length; };
  const obj = (n, corpo) => { offs[n] = len; push(`${n} 0 obj\n`); corpo(); push('\nendobj\n'); };
  const land = w > h, PW = land ? 842 : 595, PH = land ? 595 : 842, mar = 24, k = Math.min((PW - 2 * mar) / w, (PH - 2 * mar) / h), iw = w * k, ih = h * k, ix = (PW - iw) / 2, iy = (PH - ih) / 2;
  const cont = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q`;
  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
  obj(5, () => push(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`));
  const xref = len; push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let n = 1; n <= 5; n++) push(String(offs[n]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; for (const u of parti) { out.set(u, p); p += u.length; }
  return out;
}

export async function esportaMappa(formato) {
  const f = formato || await scelta('Esporta la mappa', 'Salva la mappa esplorata (stanze, griglia e segnalini).', [['png', 'Immagine PNG', 'Alta risoluzione, sfondo carta quadrettata'], ['pdf', 'Documento PDF', 'Una pagina A4 pronta da stampare']]);
  if (!f) return;
  const titolo = S.adv?.nomeDungeon || '';
  const cv = table.renderEsportazione({ titolo });
  if (!cv) { toast('Non c’è ancora nessuna stanza da esportare.', 'warn'); return; }
  const base = nomeFile(titolo);
  if (f === 'png') scarica(await blobDi(cv, 'image/png'), `${base}.png`);
  else { const jpg = new Uint8Array(await (await blobDi(cv, 'image/jpeg', 0.92)).arrayBuffer()); scarica(new Blob([creaPdf(jpg, cv.width, cv.height)], { type: 'application/pdf' }), `${base}.pdf`); }
  toast(`Mappa esportata (${f.toUpperCase()}).`);
}
