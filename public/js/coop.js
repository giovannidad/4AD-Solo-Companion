// Modalità cooperativa online (client). Chi ospita esegue tutta la logica e pubblica lo stato; gli ospiti vedono la partita in tempo reale
// e inviano comandi per i propri eroi (attacchi, incantesimi, cure, spostamenti, dadi), che l'ospitante convalida ed esegue.
import { S, onChange, emit, eroePerId, modificato, log } from './state.js';
import { h, modal, toast } from './util.js';
import * as dice from './dice.js';
import * as C from './combat.js';
import * as Q from './acque.js';
import * as table from './map2d.js';

export const coop = { ruolo: null, codice: null, token: null, id: null, nome: null, info: null, ospiti: [], porta: null, indirizzi: [] };
export const sonoOspite = () => coop.ruolo === 'ospite';
export const sonoHost = () => coop.ruolo === 'host';
/** Eroi che il giocatore ospite controlla (assegnati dall'ospitante). */
export const mieiEroi = () => coop.info?.giocatori?.find(g => g.id === coop.id)?.eroi || [];
export const eMio = id => !sonoOspite() || mieiEroi().includes(id);

let es = null, invioTimer = null, coda = Promise.resolve();
const scollega = [];   // funzioni per togliere gli ascoltatori registrati da ospita()
const chat = [];

const post = (azione, corpo) => fetch(`/api/coop/${coop.codice}/${azione}?t=${coop.token}`, { method: 'POST', body: JSON.stringify(corpo || {}), keepalive: true })
  .then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.error || r.statusText); }); return r.json(); });

// ---------------- stato pubblicato dall'ospitante ----------------
// Lo stato è diviso in «pezzi» (gruppo, ogni eroe, avventura, incontro, ogni tessera, registro, giocatori): a ogni modifica
// si spediscono solo i pezzi cambiati (confrontando una firma), non l'intero stato.
const firmeInviate = new Map();
let regInviato = 0;
function pezzi() {
  const c = {}, P = S.party || {}, A = S.adv || {};
  const { eroi = [], ...pm } = P; c.p = { ...pm, eroiIds: eroi.map(e => e.id) }; eroi.forEach(e => { c['e:' + e.id] = e; });
  const { tessere = [], incontro = null, ...am } = A; c.a = { ...am, tessereIds: tessere.map(t => t.id) }; c.i = { incontro }; tessere.forEach(t => { c['t:' + t.id] = t; });
  for (const [id, url] of Object.entries(S.ritratti || {})) c['x:' + id] = { url };
  c.c = { camp: S.camp, codice: coop.codice, giocatori: coop.ospiti.map(g => ({ id: g.id, nome: g.nome, online: g.online, eroi: S.party?.coopEroi?.[g.nome] || [] })) };
  return c;
}
/** Differenze rispetto all'ultimo invio (o tutto, con `pieno`). Restituisce null se non è cambiato nulla. */
function differenze(pieno = false) {
  if (pieno) { firmeInviate.clear(); regInviato = 0; }
  const c = pezzi(), delta = {};
  for (const [k, v] of Object.entries(c)) { const f = JSON.stringify(v); if (firmeInviate.get(k) !== f) { firmeInviate.set(k, f); delta[k] = v; } }
  for (const k of [...firmeInviate.keys()]) if (!(k in c)) { firmeInviate.delete(k); delta[k] = null; }
  // registro: solo le righe nuove (all'inizio le ultime 60)
  const reg = S.registro || [], n = reg.length;
  if (n !== regInviato) { const nuove = regInviato ? Math.min(n - regInviato, 60) : Math.min(n, 60); delta.r = { n, righe: nuove > 0 ? reg.slice(-nuove) : [] }; regInviato = n; }
  return Object.keys(delta).length ? delta : null;
}
function pubblica(subito = false, pieno = false) {
  if (!sonoHost()) return;
  clearTimeout(invioTimer);
  invioTimer = setTimeout(() => {
    const d = differenze(pieno); if (!d) return;
    post('invia', { tipo: 'stato', dati: { pieno, delta: d } }).catch(e => console.error('coop', e));
  }, subito ? 0 : 140);
}

// ---------------- ospitante ----------------
export async function ospita(porta) {
  const r = await fetch('/api/coop/ospita', { method: 'POST', body: JSON.stringify(porta ? { porta: +porta } : {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Impossibile avviare la stanza');
  Object.assign(coop, { ruolo: 'host', codice: j.codice, token: j.token, porta: j.lan?.porta, indirizzi: j.indirizzi || [], ospiti: [] });
  if (S.party) S.party.coopEroi = S.party.coopEroi || {};
  collega();
  scollega.forEach(f => f()); scollega.length = 0;   // niente ascoltatori doppi se si riavvia la stanza
  scollega.push(onChange(() => pubblica()), dice.onRoll(r2 => { if (sonoHost()) post('invia', { tipo: 'tiro', dati: r2 }).catch(() => {}); }));
  document.body.classList.add('coop-host');
  pubblica(true, true); aggiornaBadge(); mostraChat();
  return j;
}
export async function chiudiStanza() {
  if (!sonoHost()) return;
  try { await post('chiudi'); } catch { /* già chiusa */ }
  es?.close(); es = null; coop.ruolo = null; scollega.forEach(f => f()); scollega.length = 0; document.body.classList.remove('coop-host'); aggiornaBadge(); nascondiChat();
}
export function assegna(nome, eroeId, si) {
  const m = (S.party.coopEroi = S.party.coopEroi || {});
  for (const k of Object.keys(m)) m[k] = m[k].filter(x => x !== eroeId);   // un eroe ha un solo giocatore
  if (si) (m[nome] = m[nome] || []).push(eroeId);
  modificato('party'); pubblica(true);
}

function collega() {
  es?.close();
  es = new EventSource(`/api/coop/${coop.codice}/flusso?t=${coop.token}`);
  const on = (n, f) => es.addEventListener(n, ev => { try { f(JSON.parse(ev.data)); } catch (e) { console.error('coop', n, e); } });
  if (sonoHost()) {
    on('rosa', d => { coop.ospiti = d.ospiti; aggiornaBadge(); });
    on('unito', d => { const g = coop.ospiti.find(x => x.id === d.id); if (g) { g.online = true; g.nome = d.nome; } else coop.ospiti.push({ ...d, online: true }); toast(`${d.nome} si è unito alla partita.`); log(`${d.nome} si unisce alla partita cooperativa.`); aggiornaBadge(); pubblica(true); });
    on('uscito', d => { const g = coop.ospiti.find(x => x.id === d.id); if (g) g.online = false; toast(`${d.nome} si è scollegato.`, 'warn'); aggiornaBadge(); pubblica(true); });
    on('comando', d => { coda = coda.then(() => esegui(d)).catch(e => console.error('comando', e)); });
    on('chat', aggiungiChat);
  } else {
    on('benvenuto', d => { coop.id = d.id; coop.nome = d.nome; });
    on('stato', applica);
    on('tiro', r => dice.iniettaTiro(r));
    on('chat', aggiungiChat);
    on('avviso', d => toast(d.testo, 'warn'));
    on('chiusa', d => { toast(d.motivo || 'Stanza chiusa.', 'warn'); es.close(); document.body.classList.remove('ospite'); setTimeout(() => { location.href = location.pathname; }, 2500); });
  }
}

/** Esegue il comando di un ospite sull'eroe che gli appartiene. */
async function esegui({ da, nome, cmd }) {
  const avvisa = testo => post('invia', { tipo: 'a', dati: { id: da, evento: 'avviso', dati: { testo } } }).catch(() => {});
  if (cmd.tipo === 'tira') {
    if (!/^[0-9dD+x-]{1,14}$/.test(cmd.expr || '')) return;
    return void (await dice.tira(cmd.expr, `${nome}: ${cmd.expr}`));
  }
  const e = eroePerId(cmd.eroeId);
  if (!e || !(S.party.coopEroi?.[nome] || []).includes(e.id)) return avvisa('Quell’eroe non è tuo.');
  const i = S.adv?.incontro;
  const inCombattimento = i && i.stato === 'combattimento';
  const speso = () => inCombattimento && i.agito?.[e.id];
  switch (cmd.tipo) {
    case 'sposta': {
      const t = S.adv.tessere.find(x => x.id === cmd.tileId); if (!t || t.pending) return;
      e.posizione = t.id; log(`${e.nome} si sposta nella ${t.nome.toLowerCase()}.`); return modificato('party');
    }
    case 'attacca':
      if (!i || i.stato === 'finito') return avvisa('Non c’è un combattimento in corso.');
      if (speso()) return avvisa(`${e.nome} ha terminato gli attacchi per questo turno.`);
      return void (await C.attacca(e, { armaId: cmd.armaId, furioso: !!cmd.furioso, coda: !!cmd.coda }));
    case 'maestria': return void Q.armaMaestria(e);
    case 'marchia': if (speso()) return avvisa(`${e.nome} ha terminato gli attacchi per questo turno.`); return void (await C.marchia(e));
    case 'lancia': {
      if (speso()) return avvisa(`${e.nome} ha terminato gli attacchi per questo turno.`);
      const o = cmd.og != null ? e.oggetti?.[cmd.og] : null;
      return void (await C.lancia(e, cmd.idx ?? -1, { bersaglioId: cmd.bersaglioId, oggetto: o || undefined, daPergamena: !!o && o.tipo === 'pergamena' }));
    }
    case 'cura': if (speso()) return avvisa(`${e.nome} ha terminato gli attacchi per questo turno.`); return void (await C.guarisci(e, eroePerId(cmd.bersaglioId) || e));
    case 'benedizione': if (speso()) return avvisa(`${e.nome} ha terminato gli attacchi per questo turno.`); return void (await C.usaBenedizione(e, eroePerId(cmd.bersaglioId) || e));
  }
}

// ---------------- ospite ----------------
export async function unisciti(codice, nome) {
  const r = await fetch(`/api/coop/${codice.toUpperCase()}/unisci`, { method: 'POST', body: JSON.stringify({ nome }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Impossibile unirsi');
  Object.assign(coop, { ruolo: 'ospite', codice: codice.toUpperCase(), token: j.token, id: j.id, nome: j.nome });
  S.ospite = true;
  document.body.classList.add('ospite');
  collega(); aggiornaBadge(); mostraChat();
}
const pezziOspite = {};
let regOspite = [], regN = null;
function applica(msg) {
  if (msg.pieno) { for (const k of Object.keys(pezziOspite)) delete pezziOspite[k]; regOspite = []; regN = null; }
  for (const [k, v] of Object.entries(msg.delta || {})) {
    if (k === 'r') {
      if (regN === null) regOspite = v.righe.slice();
      else { const q = Math.min(v.righe.length, Math.max(0, v.n - regN)); regOspite = [...regOspite, ...(q ? v.righe.slice(-q) : [])]; }
      regN = v.n; regOspite = regOspite.slice(-300); continue;
    }
    if (v === null) delete pezziOspite[k]; else pezziOspite[k] = v;
  }
  const p = pezziOspite.p, a = pezziOspite.a; if (!p || !a) return;
  const { eroiIds, ...pm } = p, { tessereIds, ...am } = a;
  S.party = { ...pm, eroi: eroiIds.map(id => pezziOspite['e:' + id]).filter(Boolean) };
  S.adv = { ...am, incontro: pezziOspite.i?.incontro || null, tessere: tessereIds.map(id => pezziOspite['t:' + id]).filter(Boolean) };
  S.registro = regOspite; S.camp = pezziOspite.c?.camp || 'coop'; coop.info = pezziOspite.c;
  S.ritratti = Object.fromEntries(Object.entries(pezziOspite).filter(([k]) => k.startsWith('x:')).map(([k, v]) => [k.slice(2), v.url]));
  table.setTema(S.adv.tema); table.setTiles(S.adv.tessere || []);
  emit(); aggiornaBadge();
}
/** Invia un comando per un proprio eroe (usato dall'interfaccia dell'ospite). */
export async function comando(cmd) {
  try { await post('invia', { tipo: 'comando', dati: cmd }); } catch (e) { toast(e.message, 'warn'); }
}

// ---------------- interfaccia: badge, chat, finestra ----------------
function aggiornaBadge() {
  let b = document.getElementById('coopBadge');
  if (!coop.ruolo) { b?.remove(); return; }
  if (!b) { b = h('button', { id: 'coopBadge', class: 'coop-badge', onclick: () => apriCoop() }); document.querySelector('.camp')?.prepend(b); }
  b.textContent = sonoHost() ? `Cooperativa · ${coop.codice} · ${coop.ospiti.filter(g => g.online).length} online` : `Ospite · ${coop.nome} · ${coop.codice}`;
}
function mostraChat() {
  if (document.getElementById('chatDock')) return;
  const log_ = h('div', { class: 'chat-log' });
  const inp = h('input', { type: 'text', placeholder: 'Scrivi un messaggio…', maxlength: 300, onkeydown: ev => { if (ev.key === 'Enter') invia(); } });
  const invia = () => { const t = inp.value.trim(); if (!t) return; inp.value = ''; post('invia', { tipo: 'chat', dati: { testo: t, da: sonoHost() ? 'Ospitante' : coop.nome } }).catch(e => toast(e.message, 'warn')); };
  const dock = h('div', { id: 'chatDock', class: 'chat-dock' }, h('div', { class: 'chat-head', onclick: () => dock.classList.toggle('min') }, 'Chat della partita'), log_, h('div', { class: 'chat-in' }, inp, h('button', { onclick: invia }, 'Invia')));
  dock.classList.add('min');
  document.body.append(dock);
  chat.forEach(m => log_.append(rigaChat(m)));
}
const rigaChat = m => h('div', { class: 'chat-row' }, h('b', {}, m.da), ' ', m.testo);
function aggiungiChat(m) {
  chat.push(m); const l = document.querySelector('#chatDock .chat-log'); if (!l) return;
  l.append(rigaChat(m)); l.scrollTop = l.scrollHeight;
  const d = document.getElementById('chatDock'); if (d?.classList.contains('min')) d.classList.add('nuovo');
}
function nascondiChat() { document.getElementById('chatDock')?.remove(); }

/** Finestra della modalità cooperativa. */
export function apriCoop() {
  modal('Partita cooperativa online', (b, close) => {
    if (sonoOspite()) {
      b.append(h('p', {}, `Sei collegato alla stanza ${coop.codice} come «${coop.nome}».`),
        h('p', { class: 'hint' }, mieiEroi().length ? 'I tuoi eroi: ' + mieiEroi().map(id => eroePerId(id)?.nome).filter(Boolean).join(', ') : 'L’ospitante non ti ha ancora assegnato nessun eroe: per ora osservi.'),
        h('div', { class: 'row end' }, h('button', { onclick: () => { location.href = location.pathname; } }, 'Esci dalla stanza'), h('button', { class: 'primary', onclick: close }, 'Chiudi')));
      return;
    }
    if (sonoHost()) { vistaHost(b, close); return; }
    const codice = h('input', { type: 'text', placeholder: 'Codice (es. K7M2QX)', maxlength: 8, style: 'text-transform:uppercase' });
    const nome = h('input', { type: 'text', placeholder: 'Il tuo nome', maxlength: 24, value: localStorage.getItem('fad-nome') || '' });
    const ind = h('input', { type: 'text', placeholder: 'Indirizzo dell’ospitante (es. 192.168.1.23:3001) – vuoto = questo computer' });
    const porta = h('input', { type: 'number', min: 1024, max: 65535, value: localStorage.getItem('fad-porta') || 3001, style: 'width:110px' });
    b.append(h('h4', {}, 'Ospita una partita'),
      h('p', { class: 'hint' }, 'Gli altri giocatori si collegano dal browser al tuo computer: ognuno guida i propri eroi mentre tu gestisci dungeon, mostri e dadi.'),
      h('label', {}, 'Porta di rete da usare (1024–65535)', porta),
      h('p', { class: 'hint' }, 'È la porta su cui gli altri si collegano al tuo computer: se giochi via Internet è quella da aprire sul router. Scegline una libera e ricordala.'),
      h('button', { class: 'primary', disabled: !S.party?.eroi?.length, title: S.party?.eroi?.length ? '' : 'Crea prima il gruppo', onclick: async () => {
        const n = Number(porta.value);
        if (!Number.isInteger(n) || n < 1024 || n > 65535) return toast('La porta deve essere un numero tra 1024 e 65535.', 'warn');
        try { await ospita(n); localStorage.setItem('fad-porta', String(n)); close(); apriCoop(); } catch (e) { toast(e.message, 'warn'); }
      } }, 'Avvia la stanza'),
      h('h4', {}, 'Unisciti a una partita'), h('label', {}, 'Codice stanza', codice), h('label', {}, 'Nome', nome), h('label', {}, 'Indirizzo', ind),
      h('div', { class: 'row end' }, h('button', { onclick: close }, 'Annulla'), h('button', { class: 'primary', onclick: () => {
        const c = codice.value.trim().toUpperCase(), n = nome.value.trim(); if (!c || !n) return toast('Inserisci codice e nome.', 'warn');
        localStorage.setItem('fad-nome', n);
        let base = ind.value.trim(); base = base ? (/^https?:/.test(base) ? base : 'http://' + base) : location.origin;
        location.href = `${base.replace(/\/$/, '')}/?coop=${encodeURIComponent(c)}&nome=${encodeURIComponent(n)}`;
      } }, 'Unisciti')));
  }, { wide: true });
}
function vistaHost(b, close) {
  const porta = coop.porta || location.port;
  const link = ip => `http://${ip}:${porta}/?coop=${coop.codice}`;
  const lista = h('div', { class: 'list' });
  const disegna = () => {
    lista.replaceChildren();
    if (!coop.ospiti.length) lista.append(h('small', {}, 'Nessun giocatore collegato per ora.'));
    coop.ospiti.forEach(g => {
      const mio = S.party.coopEroi?.[g.nome] || [];
      lista.append(h('div', { class: 'card' }, h('b', {}, `${g.nome}${g.online ? '' : ' (offline)'}`),
        h('div', { class: 'chk-row' }, S.party.eroi.filter(e => e.stato !== 'morto').map(e => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: mio.includes(e.id), onchange: ev => assegna(g.nome, e.id, ev.target.checked) }), e.nome)))));
    });
  };
  fetch('/api/coop/ip-pubblico').then(r => r.json()).then(({ ip }) => {
    const box = document.getElementById('ipPubblico'); if (!box) return;
    if (!ip) { box.replaceChildren(h('small', {}, 'IP pubblico non disponibile (nessuna connessione a Internet?).')); return; }
    const l = `http://${ip.includes(':') ? `[${ip}]` : ip}:${porta}/?coop=${coop.codice}`;
    box.replaceChildren(h('span', {}, 'IP pubblico: ', h('b', {}, ip)), h('code', { class: 'grow' }, l), h('button', { class: 'mini', onclick: () => navigator.clipboard?.writeText(l).then(() => toast('Link copiato.')) }, 'Copia'));
  }).catch(() => { const box = document.getElementById('ipPubblico'); box?.replaceChildren(h('small', {}, 'IP pubblico non disponibile.')); });
  disegna();
  const t = setInterval(() => { if (!document.body.contains(lista)) clearInterval(t); else disegna(); }, 1500);
  b.append(h('p', {}, 'Stanza attiva. Codice: ', h('b', { class: 'codice' }, coop.codice)),
    h('p', { class: 'hint' }, 'Rete locale: chi è collegato alla tua stessa Wi-Fi/LAN apre uno di questi indirizzi nel browser:'),
    ...(coop.indirizzi.length ? coop.indirizzi.map(ip => h('div', { class: 'row' }, h('code', { class: 'grow' }, link(ip)), h('button', { class: 'mini', onclick: () => navigator.clipboard?.writeText(link(ip)).then(() => toast('Link copiato.')) }, 'Copia'))) : [h('small', {}, 'Nessuna rete locale rilevata.')]),
    h('div', { class: 'row', id: 'ipPubblico' }, h('small', {}, 'IP pubblico: ricerca in corso…')),
    h('p', { class: 'hint' }, `Via Internet: apri la porta ${porta} del router verso questo computer oppure usa un tunnel/VPN (per esempio Tailscale o ngrok) e invia agli amici l’indirizzo risultante seguito da /?coop=${coop.codice}. Chi conosce il codice può entrare: non condividerlo con sconosciuti.`),
    h('h4', {}, 'Giocatori e eroi'), lista,
    h('p', { class: 'hint' }, 'Spunta gli eroi che ogni giocatore guida. Gli altri eroi restano a te. I giocatori non possono tirare per i mostri né generare stanze.'),
    h('div', { class: 'row end' }, h('button', { class: 'danger', onclick: async () => { await chiudiStanza(); close(); } }, 'Chiudi la stanza'), h('button', { class: 'primary', onclick: close }, 'Chiudi')));
}
