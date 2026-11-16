import { $, $$, h, modal, toast, confirmBox } from './util.js';
import { api } from './api.js';
import { R, S, caricaRegole, apriCampagna, onChange, modificato, emit, ordineMarcia, log, eroePerId } from './state.js';
import { muoviGruppo, tileById, spostamento, stanzaSicura } from './game.js';
import * as table from './map2d.js';
import * as dice from './dice.js';
import { renderGruppo } from './party.js';
import { apriImpostazioni } from './impostazioni.js';
import * as Coop from './coop.js';
import { esportaMappa, esportaSchede } from './esporta.js';
import * as Rit from './ritratti.js';
import { renderDungeon, renderIncontro, renderStrumenti, renderRegistro, firmaUI } from './ui.js';

let tab = 'dungeon';

// ---------------- qualità grafica (leggera = per computer datati) ----------------
const debole = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 8) <= 2;
const QUALITA = localStorage.getItem('fad-qualita') || (debole ? 'leggera' : 'alta');
const LEGGERA = QUALITA === 'leggera';
table.qualita.leggera = LEGGERA;
if (LEGGERA) dice.settings.fisici = false;

const RENDER = { dungeon: renderDungeon, incontro: renderIncontro, strumenti: renderStrumenti, registro: renderRegistro };

// Ridisegno a parti: ogni sezione si ricostruisce solo se la sua «firma» (lo stato da cui dipende) è cambiata.
export const tempi = { gruppo: 0, pannello: 0 };   // diagnostica: ms dell'ultimo ridisegno
const firme = { gruppo: '', pannello: '', tessera: '', segnalini: '' };
const firma = (...v) => JSON.stringify(v);
function disegna(forza = false) {
  if (!S.camp || !S.party) return;
  const coop = [Coop.coop.ruolo, Coop.coop.info?.giocatori];
  const sg = firma(S.party, coop);
  const sp = tab === 'registro' ? firma(tab, S.registro?.length, S.registro?.[S.registro.length - 1]) : firma(tab, S.adv, S.party, coop, firmaUI(), table.firmaUI());
  const cambiaG = forza || sg !== firme.gruppo, cambiaP = forza || sp !== firme.pannello;
  const scrolls = (cambiaG || cambiaP) ? { p: $('#panel').scrollTop, l: $('#left').scrollTop } : null;   // letti prima di toccare il DOM: niente layout forzato
  const t0 = performance.now();
  if (cambiaG) { firme.gruppo = sg; renderGruppo($('#partyBox')); }
  const t1 = performance.now();
  if (cambiaP) { firme.pannello = sp; RENDER[tab]($('#panel')); }
  tempi.gruppo = t1 - t0; tempi.pannello = performance.now() - t1;
  if (scrolls) { $('#panel').scrollTop = scrolls.p || 0; $('#left').scrollTop = scrolls.l || 0; }
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const inc = S.adv.incontro;
  $('#tabs [data-tab=incontro]').classList.toggle('alert', !!inc && inc.stato !== 'finito');
  const sel = table.getSelected(), st = firma(sel, table.firmaUI());
  if (forza || st !== firme.tessera) { firme.tessera = st; disegnaStrumentiTessera(sel); }
  aggiornaSegnalini();
}

// ---------------- segnalini dei personaggi ----------------
const COLORI = { guerriero: '#b8281f', barbaro: '#8a4a1c', chierico: '#b9a55a', elfo: '#2f7d46', furfante: '#5a4a9a', mago: '#2557a7', mezzuomo: '#9a7a22', nano: '#6a5a4a', arlecchino: '#c0397b', assassino: '#3a3a44', 'elfo-fuoco': '#d2631a', tiratore: '#3b7a8a', veterano: '#7a7a7a' };
let firmaSicure = '';
function aggiornaSicure() {
  const f = (S.adv.tessere || []).filter(t => stanzaSicura(t)).map(t => t.id).join(',');
  if (f !== firmaSicure) { firmaSicure = f; table.ridisegna(); }
}
function aggiornaSegnalini() {
  aggiornaSicure();
  const qui = S.adv.stanzaCorrente;
  const lista = ordineMarcia().map(e => ({
    id: e.id, label: (e.nome || '?')[0].toUpperCase(), color: COLORI[e.classe] || '#555', stato: e.stato, tileId: e.posizione || qui,
    img: Rit.urlRitratto(e), imgId: Rit.haRitrattoProprio(e) ? e.id + ':' + S.ritratti[e.id].length : 'd:' + e.classe + ':' + e.id
  }));
  const f = firma(lista.map(({ img, ...r }) => r)); if (f === firme.segnalini) return;   // segnalini invariati: niente ricalcolo
  firme.segnalini = f; table.setTokens(lista);
}
let pronto = false;
function programma() { if (pronto) return; pronto = true; requestAnimationFrame(() => { pronto = false; disegna(); }); }

function apriTab(t) { if (Coop.sonoOspite() && t === 'strumenti') t = 'incontro'; tab = t; disegna(); }

// ---------------- barra strumenti tessera ----------------
function disegnaStrumentiTessera(t) {
  const box = $('#tileTools');
  if (!t) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden'); box.replaceChildren(
    h('span', { class: 'tname' }, t.nome),
    h('button', { title: 'Ruota a sinistra', onclick: () => table.rotateSelected(-1) }, '⟲'),
    h('button', { title: 'Ruota a destra', onclick: () => table.rotateSelected(1) }, '⟳'),
    h('button', { title: 'Specchia', onclick: () => table.flipSelected() }, '⇄'),
    h('button', { title: 'Riduci', onclick: () => table.scaleSelected(0.95) }, '−'),
    h('button', { title: 'Ingrandisci', onclick: () => table.scaleSelected(1.05) }, '+'),
    t.tipo === 'stanza' ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!t.corridoio, onchange: ev => { table.updateTile({ corridoio: ev.target.checked }); } }), 'corridoio') : null,
    h('button', { title: 'Deseleziona', onclick: () => table.selectTile(null) }, '×'));
}

// ---------------- dadi: barra e storico ----------------
function inizializzaDadi() {
  $('#diceBar').addEventListener('click', async ev => {
    const b = ev.target.closest('button[data-d]'); if (!b) return;
    const d = b.dataset.d;
    if (Coop.sonoOspite()) { Coop.comando({ tipo: 'tira', expr: d === 'd66' ? '1d6' : d }); return; }
    if (d === 'd66') await dice.d66('Tiro libero d66'); else await dice.tira(d, `Tiro libero ${d}`);
  });
  const go = async () => { const v = $('#diceExpr').value.trim(); if (!v) return; if (Coop.sonoOspite()) { Coop.comando({ tipo: 'tira', expr: v }); return; } try { await dice.tira(v, `Tiro libero ${v}`); } catch (e) { toast(e.message, 'warn'); } };
  $('#diceGo').onclick = go; $('#diceExpr').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#dicePhys').onchange = e => { dice.settings.fisici = e.target.checked; };
  dice.onRoll(r => {
    const box = $('#rollLog');
    const el = h('div', { class: 'roll' }, h('b', {}, r.totale), h('span', {}, `${r.label || r.expr}`), h('small', {}, r.dadi.length > 1 || r.expr.includes('+') || r.expr.includes('d8') ? `[${r.dadi.join(' ')}]` : ''));
    box.prepend(el); while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => el.classList.add('old'), 9000);
  });
}

// ---------------- campagne ----------------
async function caricaElencoCampagne(selId) {
  const lista = await api.elencoCampagne();
  const sel = $('#campSel'); sel.replaceChildren(...lista.map(c => h('option', { value: c.id }, c.nome)));
  if (selId) sel.value = selId;
  return lista;
}
async function nuovaCampagna() {
  return new Promise(res => modal('Nuova campagna', (b, close) => {
    const n = h('input', { type: 'text', value: 'La mia campagna', maxlength: 40 });
    const ok = async () => { const c = await api.creaCampagna(n.value.trim() || 'Campagna'); res(c); close(); };
    n.onkeydown = e => { if (e.key === 'Enter') ok(); };
    b.append(h('label', {}, 'Nome della campagna', n), h('p', { class: 'hint' }, 'Tutti i dati vengono salvati come file di testo in data/campagne/.'), h('div', { class: 'row end' }, h('button', { onclick: () => { res(null); close(); } }, 'Annulla'), h('button', { class: 'primary', onclick: ok }, 'Crea')));
    setTimeout(() => n.select(), 50);
  }, { onClose: () => res(null) }));
}
async function selezionaCampagna(id) {
  await apriCampagna(id);
  table.setTema(S.adv.tema); table.setTiles(S.adv.tessere);
  table.selectTile(null);
  disegna(true);
}

async function avvia() {
  try {
    await caricaRegole();
    table.initMap($('#mapView')); table.setTileData(R.tiles, R.tilesSet); table.setSicuraFn(stanzaSicura);
    // three.js e cannon-es (~1 MB) si scaricano in background: l'interfaccia parte subito e i primi tiri sono virtuali
    if (!LEGGERA) import('./table3d.js').then(m => { m.initTable($('#diceLayer')); dice.collegaTavolo(m); }).catch(e => console.error('dadi 3D', e));
    table.onTileChange(() => modificato('avventura'));
    table.onTileSelect(t => disegnaStrumentiTessera(t));
    table.onTokenMove((id, tileId) => {
      if (Coop.sonoOspite()) { Coop.comando({ tipo: 'sposta', eroeId: id, tileId }); return; }
      const e = eroePerId(id), t = tileById(tileId); if (!e || !t) return;
      const da = e.posizione; e.posizione = tileId; log(`${e.nome} si sposta nella ${t.nome.toLowerCase()}.`); modificato('party');
      if (da && da !== tileId && tileId !== S.adv?.stanzaCorrente) spostamento(da, tileId, e.nome);   // chi si riunisce al gruppo non tira
    });
    table.onTileDouble(tileId => {
      if (Coop.sonoOspite()) return;
      const a = S.adv; if (!a.attiva || a.stanzaCorrente === tileId) return;
      const da = a.stanzaCorrente; muoviGruppo(da, tileId); a.stanzaCorrente = tileId;
      log(`Il gruppo si sposta nella ${tileById(tileId)?.nome.toLowerCase()}.`); modificato();
      spostamento(da, tileId);
    });
    $('#loading').remove(); window.__avvioMs = Math.round(performance.now());
  } catch (e) { $('#loading').textContent = 'Errore: ' + e.message; console.error(e); return; }

  fetch('/versione.json').then(r => r.json()).then(v => { if (v.versione) $('#ver').textContent = '· v' + v.versione; }).catch(() => {});
  $('#esporta').onclick = () => esportaMappa();
  $('#esportaSchede').onclick = () => esportaSchede();
  $('#impostazioni').onclick = () => apriImpostazioni({ leggera: LEGGERA });
  $('#coopBtn').onclick = () => Coop.apriCoop();
  $('#qualita').value = QUALITA;
  $('#qualita').onchange = e => { localStorage.setItem('fad-qualita', e.target.value); location.reload(); };
  if (LEGGERA) { $('#dicePhys').checked = false; $('#dicePhys').disabled = true; $('#diceLayer').remove(); }
  $$('#stageTop [data-view]').forEach(b => b.onclick = () => table.setView(b.dataset.view));
  $$('#tabs button').forEach(b => b.onclick = () => apriTab(b.dataset.tab));
  document.addEventListener('apri-tab', e => apriTab(e.detail));
  inizializzaDadi();
  onChange(programma);

  // partita cooperativa come ospite: niente campagne locali, lo stato arriva dall'ospitante
  const qs = new URLSearchParams(location.search);
  if (qs.get('coop')) {
    table.permessi.tessere = false; table.permessi.token = id => Coop.eMio(id);
    S.party = { eroi: [], ordine: [] }; S.adv = { tessere: [], attiva: false }; S.registro = [];
    try { await Coop.unisciti(qs.get('coop'), qs.get('nome') || localStorage.getItem('fad-nome') || 'Ospite'); }
    catch (e) { toast(e.message, 'warn'); setTimeout(() => { location.href = location.pathname; }, 2500); }
    return;
  }
  let lista = await caricaElencoCampagne();
  if (!lista.length) { const c = await nuovaCampagna() || await api.creaCampagna('Campagna'); lista = await caricaElencoCampagne(c.id); }
  const salvata = localStorage.getItem('4ad-campagna');
  const id = lista.find(c => c.id === salvata)?.id || lista[0].id;
  $('#campSel').value = id;
  await selezionaCampagna(id);
  $('#campSel').onchange = e => selezionaCampagna(e.target.value);
  $('#campNew').onclick = async () => { const c = await nuovaCampagna(); if (c) { await caricaElencoCampagne(c.id); await selezionaCampagna(c.id); } };
  $('#campDel').onclick = async () => {
    const id = $('#campSel').value;
    if (!(await confirmBox('Eliminare definitivamente questa campagna e tutti i suoi file?'))) return;
    await api.eliminaCampagna(id);
    let l = await caricaElencoCampagne();
    if (!l.length) { const c = await api.creaCampagna('Campagna'); l = await caricaElencoCampagne(c.id); }
    await selezionaCampagna(l[0].id);
  };
}
avvia();
window.__4ad = { S, R, table, dice, disegna, tempi, get avvioMs() { return window.__avvioMs; } };
