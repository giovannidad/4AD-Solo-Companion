// Esportazione della mappa del dungeon in PNG o PDF (il PDF è scritto a mano: una pagina A4 con l'immagine JPEG).
import * as table from './map2d.js';
import { toast, scelta } from './util.js';
import { S } from './state.js';
import { renderScheda } from './schede.js';

const nomeFile = t => (t || 'mappa-dungeon').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mappa-dungeon';
function scarica(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const blobDi = (cv, tipo, q) => new Promise(res => cv.toBlob(res, tipo, q));

/** PDF A4 con una pagina per immagine JPEG ({jpeg, w, h}); ogni pagina è orizzontale o verticale secondo l'immagine, con margini. */
function creaPdf(pagine) {
  const enc = new TextEncoder(), parti = [], offs = []; let len = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parti.push(u); len += u.length; };
  const obj = (n, corpo) => { offs[n] = len; push(`${n} 0 obj\n`); corpo(); push('\nendobj\n'); };
  const N = pagine.length, tot = 2 + 3 * N;
  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pagine.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${N} >>`));
  pagine.forEach(({ jpeg, w, h }, i) => {
    const land = w > h, PW = land ? 842 : 595, PH = land ? 595 : 842, mar = pagine.length > 1 && !land ? 0 : 24, k = Math.min((PW - 2 * mar) / w, (PH - 2 * mar) / h), iw = w * k, ih = h * k, ix = (PW - iw) / 2, iy = (PH - ih) / 2;
    const cont = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q`, n0 = 3 + 3 * i;
    obj(n0, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${n0 + 1} 0 R >> >> /Contents ${n0 + 2} 0 R >>`));
    obj(n0 + 1, () => { push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
    obj(n0 + 2, () => push(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`));
  });
  const xref = len; push(`xref\n0 ${tot + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= tot; n++) push(String(offs[n]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${tot + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; for (const u of parti) { out.set(u, p); p += u.length; }
  return out;
}

export async function esportaMappa(formato) {
  const f = formato || await scelta('Esporta la mappa', 'Salva la mappa esplorata (stanze e griglia; i ritratti dei personaggi non vengono esportati).', [['png', 'Immagine PNG', 'Alta risoluzione, sfondo carta quadrettata'], ['pdf', 'Documento PDF', 'Una pagina A4 pronta da stampare']]);
  if (!f) return;
  const titolo = S.adv?.nomeDungeon || '';
  const cv = table.renderEsportazione({ titolo });
  if (!cv) { toast('Non c’è ancora nessuna stanza da esportare.', 'warn'); return; }
  const base = nomeFile(titolo);
  if (f === 'png') scarica(await blobDi(cv, 'image/png'), `${base}.png`);
  else { const jpg = new Uint8Array(await (await blobDi(cv, 'image/jpeg', 0.92)).arrayBuffer()); scarica(new Blob([creaPdf([{ jpeg: jpg, w: cv.width, h: cv.height }])], { type: 'application/pdf' }), `${base}.pdf`); }
  toast(`Mappa esportata (${f.toUpperCase()}).`);
}

/** Esporta le schede dei personaggi (fantasy, A4) in PNG (un file per eroe) o in un unico PDF con una pagina per eroe. */
export async function esportaSchede(formato, stile) {
  const eroi = S.party?.eroi || [];
  if (!eroi.length) { toast('Non ci sono ancora personaggi da esportare.', 'warn'); return; }
  const f = formato || await scelta('Esporta le schede', 'Schede illustrate in stile fantasy, pronte da stampare per giocare senza computer (una pagina A4 per personaggio, senza ritratto).', [['pdf', 'Documento PDF', 'Un solo file, una pagina per personaggio'], ['png', 'Immagini PNG', 'Un file per ogni personaggio']]);
  if (!f) return;
  const st = stile || await scelta('Stampa a colori o eco?', 'La stampa eco usa solo bianco e nero, senza sfondo: consuma pochissimo inchiostro.', [['colore', 'A colori', 'Pergamena e colori della classe'], ['eco', 'Eco (bianco e nero)', 'Solo nero su bianco, senza sfondo']]);
  if (!st) return;
  const base = 'gruppo';
  const pagine = [];
  for (const e of eroi) {
    const cv = renderScheda(e, { eco: st === 'eco' });
    if (f === 'png') scarica(await blobDi(cv, 'image/png'), `scheda-${nomeFile(e.nome)}${st === 'eco' ? '-eco' : ''}.png`);
    else pagine.push({ jpeg: new Uint8Array(await (await blobDi(cv, 'image/jpeg', 0.93)).arrayBuffer()), w: cv.width, h: cv.height });
  }
  if (f === 'pdf') scarica(new Blob([creaPdf(pagine)], { type: 'application/pdf' }), `schede-${base}${st === 'eco' ? '-eco' : ''}.pdf`);
  toast(`Schede esportate (${f.toUpperCase()}).`);
}
