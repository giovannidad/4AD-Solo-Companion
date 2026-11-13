// Equipaggiare come armi e armature gli oggetti trovati (bottino) o tenuti nello zaino.
import { R, S, log, modificato } from './state.js';
import { toast, scelta } from './util.js';
import { armaDi } from './rules.js';

const ARMATURE = { leggera: 'Armatura leggera', pesante: 'Armatura pesante' };

/** Riconosce se un oggetto è un'arma, un'armatura o uno scudo. Restituisce {tipo:'arma', id?, cat?, mat?, argento} | {tipo:'armatura', valore} | {tipo:'scudo'} | null. */
export function tipoEquip(o) {
  const t = `${o.nome || ''} ${o.nota || ''}`.toLowerCase();
  if (o.id && /^(armatura-|scudo$)/.test(o.id)) return null;
  if (/anello|pozione|pergamena|acqua santa|fial/.test(t) && !/arma|armatura|scudo/.test(t.replace(/arma incantata/, ''))) return null;
  if (/\bscudo\b/.test(t)) return { tipo: 'scudo' };
  if (/armatura pesante/.test(t)) return { tipo: 'armatura', valore: 'pesante' };
  if (/armatura leggera/.test(t)) return { tipo: 'armatura', valore: 'leggera' };
  if (/\barmatura\b/.test(t) && !/magica \(anello/.test(t)) return { tipo: 'armatura', valore: null };
  if (/\barma\b/.test(t) && !/arma incantata/.test(t)) {
    const cat = /due mani/.test(t) ? 'due-mani' : /una mano/.test(t) ? 'una-mano' : /leggera/.test(t) ? 'leggera' : null;
    const mat = /contundente/.test(t) ? 'contundente' : /taglio/.test(t) ? 'taglio' : null;
    return { tipo: 'arma', cat, mat, argento: /argent/.test(t) };
  }
  const a = R.equipaggiamento.armi.find(x => x.nome.toLowerCase() === (o.nome || '').toLowerCase());
  if (a) return { tipo: 'arma', id: a.id };
  return null;
}
export const equipaggiabile = o => !!tipoEquip(o);

function armiAmmesse(e) {
  const c = R.classi[e.classe]?.armi;
  return R.equipaggiamento.armi.filter(a => (!a.suppl || S.party.supplCaos) && (c === 'tutte' || (c || []).some(k => k === a.categoria || k === a.id || (k === 'mischia' && !a.lancio) || (k === 'distanza' && a.lancio))));
}
const togli = (e, o) => { if ((o.qta || 1) > 1) o.qta--; else e.oggetti = (e.oggetti || []).filter(x => x !== o); };
const rimetti = (e, nome) => { const ex = (e.oggetti = e.oggetti || []).find(o => o.nome === nome); if (ex) ex.qta = (ex.qta || 1) + 1; else e.oggetti.push({ nome, qta: 1 }); };

/** Equipaggia l'oggetto `o` all'eroe `e` (rimuovendolo dallo zaino). Restituisce true se è stato equipaggiato. */
export async function equipaggia(e, o) {
  const q = tipoEquip(o); if (!q) { toast('Questo oggetto non è un’arma né un’armatura.', 'warn'); return false; }
  const cl = R.classi[e.classe];
  if (q.tipo === 'scudo') {
    if (!cl.scudo) { toast(`${R.classi[e.classe].nome}: non può usare lo scudo.`, 'warn'); return false; }
    if (e.scudo) { toast(`${e.nome} ha già uno scudo.`, 'warn'); return false; }
    e.scudo = true; togli(e, o); log(`${e.nome} imbraccia ${o.nome}.`);
  } else if (q.tipo === 'armatura') {
    const permesse = cl.armature || [];
    let v = q.valore;
    if (!v) { v = await scelta('Quale armatura?', `${o.nome}`, permesse.map(k => [k, ARMATURE[k]])); if (!v) return false; }
    if (!permesse.includes(v)) { toast(`${R.classi[e.classe].nome}: non può indossare l’${ARMATURE[v].toLowerCase()}.`, 'warn'); return false; }
    if (o.noBarbaro && e.classe === 'barbaro') { toast('I barbari non possono usare questo oggetto.', 'warn'); return false; }
    if (e.armatura === v) { toast(`${e.nome} indossa già un’${ARMATURE[v].toLowerCase()}.`, 'warn'); return false; }
    const vecchia = e.armatura; e.armatura = v; togli(e, o);
    if (vecchia && vecchia !== 'nessuna') rimetti(e, ARMATURE[vecchia]);
    log(`${e.nome} indossa ${o.nome}${vecchia && vecchia !== 'nessuna' ? ` (l’${ARMATURE[vecchia].toLowerCase()} torna nello zaino)` : ''}.`);
  } else {
    let id = q.id;
    if (!id) {
      const filtra = lista => lista.filter(a => (!q.cat || a.categoria === q.cat) && (!q.mat || a.tipo === q.mat));
      let cand = filtra(armiAmmesse(e));
      if (!cand.length) { cand = filtra(R.equipaggiamento.armi.filter(a => !a.suppl || S.party.supplCaos)); if (cand.length) toast(`${R.classi[e.classe].nome}: non è un’arma tipica della classe (si applicano le penalità previste).`, 'warn'); }   // regola morbida: maghi e furfanti possono impugnare armi pesanti con malus
      if (!cand.length) { toast('Nessuna arma di questo tipo.', 'warn'); return false; }
      id = cand.length === 1 ? cand[0].id : await scelta('Che arma è?', `${o.nome}`, cand.map(a => [a.id, a.nome, `${a.mod >= 0 ? '+' : ''}${a.mod} all’attacco`]));
      if (!id) return false;
    }
    (e.armi = e.armi || []).push(id); e.armaPrincipale = id;
    if (q.argento) (e.armiArgento = e.armiArgento || []).push(id);
    togli(e, o); log(`${e.nome} impugna ${armaDi(id)?.nome || o.nome}${q.argento ? ' (d’argento)' : ''}.`);
  }
  modificato('party'); return true;
}
