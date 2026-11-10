import { $, $$, h, modal, toast, confirmBox } from './util.js';
import { api } from './api.js';
import { R, S, caricaRegole, apriCampagna, onChange, modificato, emit, ordineMarcia, log, eroePerId } from './state.js';
import { muoviGruppo, tileById } from './game.js';
import * as dadi3d from './table3d.js';
import * as table from './map2d.js';
import * as dice from './dice.js';
import { renderGruppo } from './party.js';
import { renderDungeon, renderIncontro, renderStrumenti, renderRegistro } from './ui.js';

let tab = 'dungeon';

// ---------------- qualità grafica (leggera = per computer datati) ----------------
const debole = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 8) <= 2;
const QUALITA = localStorage.getItem('fad-qualita') || (debole ? 'leggera' : 'alta');
const LEGGERA = QUALITA === 'leggera';
table.qualita.leggera = LEGGERA;
if (LEGGERA) dice.settings.fisici = false;

const RENDER = { dungeon: renderDungeon, incontro: renderIncontro, strumenti: renderStrumenti, registro: renderRegistro };

function disegna() {
  if (!S.camp || !S.party) return;
  const scrolls = { p: $('#panel')?.scrollTop, l: $('#left')?.scrollTop };
  renderGruppo($('#partyBox'));
  RENDER[tab]($('#panel'));
  $('#panel').scrollTop = scrolls.p || 0; $('#left').scrollTop = scrolls.l || 0;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const inc = S.adv.incontro;
  $('#tabs [data-tab=incontro]').classList.toggle('alert', !!inc && inc.stato !== 'finito');
  disegnaStrumentiTessera(table.getSelected());
  aggiornaSegnalini();
}

// ---------------- segnalini dei personaggi ----------------
const COLORI = { guerriero: '#b8281f', barbaro: '#8a4a1c', chierico: '#b9a55a', elfo: '#2f7d46', furfante: '#5a4a9a', mago: '#2557a7', mezzuomo: '#9a7a22', nano: '#6a5a4a', arlecchino: '#c0397b', assassino: '#3a3a44', 'elfo-fuoco': '#d2631a', tiratore: '#3b7a8a', veterano: '#7a7a7a' };
function aggiornaSegnalini() {
  const qui = S.adv.stanzaCorrente;
  table.setTokens(ordineMarcia().map(e => ({
    id: e.id, label: (e.nome || '?')[0].toUpperCase(), color: COLORI[e.classe] || '#555', stato: e.stato, tileId: e.posizione || qui
  })));
}
let pronto = false;
function programma() { if (pronto) return; pronto = true; requestAnimationFrame(() => { pronto = false; disegna(); }); }

function apriTab(t) { tab = t; disegna(); }

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
    if (d === 'd66') await dice.d66('Tiro libero d66'); else await dice.tira(d, `Tiro libero ${d}`);
  });
  const go = async () => { const v = $('#diceExpr').value.trim(); if (!v) return; try { await dice.tira(v, `Tiro libero ${v}`); } catch (e) { toast(e.message, 'warn'); } };
  $('#diceGo').onclick = go; $('#diceExpr').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#dicePhys').onchange = e => { dice.settings.fisici = e.target.checked; };
  dice.onRoll(r => {
    const box = $('#rollLog');
    const el = h('div', { class: 'roll' }, h('b', {}, r.totale), h('span', {}, `${r.label || r.expr}`), h('small', {}, r.dadi.length > 1 || r.expr.includes('+') ? `[${r.dadi.join(' ')}]` : ''));
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
  table.setTiles(S.adv.tessere);
  table.selectTile(null);
  disegna();
}

async function avvia() {
  try {
    await caricaRegole();
    table.initMap($('#mapView'));
    if (!LEGGERA) { dadi3d.initTable($('#diceLayer')); dice.tableIsReady(); }
    table.onTileChange(() => modificato('avventura'));
    table.onTileSelect(t => disegnaStrumentiTessera(t));
    table.onTokenMove((id, tileId) => {
      const e = eroePerId(id), t = tileById(tileId); if (!e || !t) return;
      e.posizione = tileId; log(`${e.nome} si sposta nella ${t.nome.toLowerCase()}.`); modificato('party');
    });
    table.onTileDouble(tileId => {
      const a = S.adv; if (!a.attiva || a.stanzaCorrente === tileId) return;
      muoviGruppo(a.stanzaCorrente, tileId); a.stanzaCorrente = tileId;
      log(`Il gruppo si sposta nella ${tileById(tileId)?.nome.toLowerCase()}.`); modificato();
    });
    $('#loading').remove();
  } catch (e) { $('#loading').textContent = 'Errore: ' + e.message; console.error(e); return; }

  $('#qualita').value = QUALITA;
  $('#qualita').onchange = e => { localStorage.setItem('fad-qualita', e.target.value); location.reload(); };
  if (LEGGERA) { $('#dicePhys').checked = false; $('#dicePhys').disabled = true; $('#diceLayer').remove(); }
  $$('#stageTop [data-view]').forEach(b => b.onclick = () => table.setView(b.dataset.view));
  $$('#tabs button').forEach(b => b.onclick = () => apriTab(b.dataset.tab));
  document.addEventListener('apri-tab', e => apriTab(e.detail));
  inizializzaDadi();
  onChange(programma);

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
window.__4ad = { S, R, table, dice };
