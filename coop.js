// Modalità cooperativa online: stanze in memoria, collegate con Server-Sent Events (SSE) + richieste POST.
// Nessuna dipendenza esterna. Chi ospita (client "master") esegue tutta la logica di gioco e pubblica lo stato;
// gli ospiti inviano soltanto comandi per i propri eroi, che l'ospitante convalida ed esegue.
//
//   POST /api/coop/ospita                      (solo da questo computer) crea la stanza -> {codice, token, ...}
//   POST /api/coop/<codice>/unisci             {nome} -> {id, token}
//   GET  /api/coop/<codice>/flusso?t=<token>   flusso SSE degli eventi destinati a quel partecipante
//   POST /api/coop/<codice>/invia?t=<token>    {tipo, dati}: l'ospitante pubblica (stato, tiro, ...); l'ospite invia comandi o chat
//   POST /api/coop/<codice>/chiudi?t=<token>   (ospitante) chiude la stanza
const crypto = require('crypto');
const os = require('os');
const https = require('https');

const stanze = new Map();                 // codice -> stanza
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codiceCasuale = () => Array.from(crypto.randomBytes(6), b => ALFABETO[b % ALFABETO.length]).join('');
const tok = () => crypto.randomBytes(16).toString('hex');
const MAX_OSPITI = 8;

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function leggi(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > 8e6) { reject(new Error('troppo grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function sse(res, evento, dati) {
  try { res.write(`event: ${evento}\ndata: ${JSON.stringify(dati)}\n\n`); } catch { /* connessione chiusa */ }
}
const daLocale = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

function indirizziLocali() {
  const out = [];
  for (const lista of Object.values(os.networkInterfaces())) for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}

/** IP pubblico di questa macchina (richiesta a un servizio esterno, senza inviare alcun dato; in cache per 5 minuti). */
let ipCache = { ip: null, quando: 0 };
function ipPubblico() {
  if (ipCache.ip && Date.now() - ipCache.quando < 300000) return Promise.resolve(ipCache.ip);
  return new Promise(resolve => {
    const req = https.get('https://api.ipify.org', { timeout: 5000 }, r => {
      let t = ''; r.on('data', c => { t += c; if (t.length > 100) r.destroy(); });
      r.on('end', () => { const ip = t.trim(); if (/^[0-9a-fA-F:.]{3,45}$/.test(ip)) ipCache = { ip, quando: Date.now() }; resolve(ipCache.ip); });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function chiudiStanza(s, motivo) {
  for (const o of s.ospiti.values()) { sse(o.res, 'chiusa', { motivo }); try { o.res.end(); } catch { /* già chiusa */ } }
  if (s.host.res) { try { s.host.res.end(); } catch { /* già chiusa */ } }
  clearInterval(s.timer); clearTimeout(s.scade);
  stanze.delete(s.codice);
}

/** Gestisce /api/coop/... Restituisce true se la richiesta era sua. `opzioni.apriLan()` avvia l'ascolto sulla rete locale. */
async function gestisci(req, res, parts, url, opzioni = {}) {
  if (parts[1] !== 'coop') return false;
  try {
    if (parts[2] === 'ospita' && req.method === 'POST') {
      if (!daLocale(req)) return json(res, 403, { error: 'solo da questo computer' }), true;
      const { porta } = JSON.parse((await leggi(req)) || '{}');
      if (porta !== undefined && !(Number.isInteger(+porta) && +porta >= 1024 && +porta <= 65535)) return json(res, 400, { error: 'La porta deve essere un numero tra 1024 e 65535.' }), true;
      let lan = null;
      try { lan = opzioni.apriLan ? await opzioni.apriLan(porta) : null; } catch (e) { return json(res, 409, { error: e.message }), true; }
      let codice; do { codice = codiceCasuale(); } while (stanze.has(codice));
      const s = { codice, host: { token: tok(), res: null }, ospiti: new Map(), stato: null, creata: Date.now() };
      s.timer = setInterval(() => { // battito per tenere aperti i flussi dietro proxy e tunnel
        if (s.host.res) try { s.host.res.write(': \n\n'); } catch { /* ok */ }
        for (const o of s.ospiti.values()) try { o.res.write(': \n\n'); } catch { /* ok */ }
      }, 15000);
      stanze.set(codice, s);
      return json(res, 201, { codice, token: s.host.token, lan, indirizzi: indirizziLocali() }), true;
    }
    if (parts[2] === 'ip-pubblico' && req.method === 'GET') {
      if (!daLocale(req)) return json(res, 403, { error: 'solo da questo computer' }), true;
      return json(res, 200, { ip: await ipPubblico() }), true;
    }
    const s = stanze.get(String(parts[2] || '').toUpperCase());
    if (!s) return json(res, 404, { error: 'stanza non trovata' }), true;
    const azione = parts[3];
    const t = url.searchParams.get('t') || '';

    if (azione === 'unisci' && req.method === 'POST') {
      if (s.ospiti.size >= MAX_OSPITI) return json(res, 409, { error: 'stanza piena' }), true;
      const { nome } = JSON.parse((await leggi(req)) || '{}');
      const pulito = String(nome || 'Ospite').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 24) || 'Ospite';
      const id = tok().slice(0, 8), token = tok();
      s.ospiti.set(id, { id, nome: pulito, token, res: null });
      return json(res, 201, { id, token, nome: pulito }), true;
    }

    if (azione === 'flusso' && req.method === 'GET') {
      const isHost = t === s.host.token;
      const o = [...s.ospiti.values()].find(x => x.token === t);
      if (!isHost && !o) return json(res, 403, { error: 'token non valido' }), true;
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      if (isHost) {
        if (s.host.res) try { s.host.res.end(); } catch { /* ok */ }
        s.host.res = res;
        clearTimeout(s.scade);
        sse(res, 'rosa', { ospiti: [...s.ospiti.values()].map(x => ({ id: x.id, nome: x.nome, online: !!x.res })) });
        req.on('close', () => { if (s.host.res === res) { s.host.res = null; s.scade = setTimeout(() => chiudiStanza(s, 'L’ospitante si è disconnesso'), 60000); } });
      } else {
        if (o.res) try { o.res.end(); } catch { /* ok */ }
        o.res = res;
        sse(res, 'benvenuto', { id: o.id, nome: o.nome, codice: s.codice });
        if (s.stato) sse(res, 'stato', { pieno: true, delta: s.stato });
        if (s.host.res) sse(s.host.res, 'unito', { id: o.id, nome: o.nome });
        req.on('close', () => { if (o.res === res) { o.res = null; if (s.host.res) sse(s.host.res, 'uscito', { id: o.id, nome: o.nome }); } });
      }
      return true;
    }

    if (azione === 'invia' && req.method === 'POST') {
      const { tipo, dati } = JSON.parse((await leggi(req)) || '{}');
      if (t === s.host.token) {
        if (tipo === 'stato') {   // differenze: {pieno, delta:{chiave: valore|null}}; il server tiene lo stato completo per chi arriva dopo
          if (dati.pieno) s.stato = {};
          s.stato = s.stato || {};
          for (const [k, v0] of Object.entries(dati.delta || {})) {
            let v = v0;
            if (k === 'r' && v) v = { n: v.n, righe: [...(s.stato.r?.righe || []), ...v.righe].slice(-60) };   // registro accumulato per chi arriva dopo
            if (v === null) delete s.stato[k]; else s.stato[k] = v;
          }
          for (const o of s.ospiti.values()) if (o.res) sse(o.res, 'stato', dati);
        }
        else if (tipo === 'a') { const o = s.ospiti.get(dati?.id); if (o?.res) sse(o.res, dati.evento || 'messaggio', dati.dati); }
        else for (const o of s.ospiti.values()) if (o.res) sse(o.res, tipo, dati);          // tiro, rosa, chat...
        return json(res, 200, { ok: true }), true;
      }
      const o = [...s.ospiti.values()].find(x => x.token === t);
      if (!o) return json(res, 403, { error: 'token non valido' }), true;
      if (tipo === 'chat') {
        const msg = { da: o.nome, testo: String(dati?.testo || '').slice(0, 300), ora: Date.now() };
        if (s.host.res) sse(s.host.res, 'chat', msg);
        for (const x of s.ospiti.values()) if (x.res) sse(x.res, 'chat', msg);
      } else if (tipo === 'comando') {
        if (s.host.res) sse(s.host.res, 'comando', { da: o.id, nome: o.nome, cmd: dati });
        else return json(res, 503, { error: 'l’ospitante non è collegato' }), true;
      }
      return json(res, 200, { ok: true }), true;
    }

    if (azione === 'chiudi' && req.method === 'POST') {
      if (t !== s.host.token) return json(res, 403, { error: 'solo l’ospitante' }), true;
      chiudiStanza(s, 'Stanza chiusa dall’ospitante'); return json(res, 200, { ok: true }), true;
    }
    return json(res, 404, { error: 'endpoint sconosciuto' }), true;
  } catch (e) {
    json(res, 500, { error: String(e.message || e) }); return true;
  }
}

module.exports = { gestisci, indirizziLocali, stanze };
