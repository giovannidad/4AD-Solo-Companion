// Server minimale senza dipendenze: serve il frontend e salva tutto in file di testo (JSON / TXT)
// dentro la cartella "data". Avvio: node server.js  ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const coop = require('./coop');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');
// FAD_DATA permette all'app desktop di salvare le campagne in una cartella scrivibile dell'utente
const CAMPAGNE = process.env.FAD_DATA || path.join(DATA, 'campagne');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
// file di campagna ammessi (solo questi, niente path arbitrari)
const FILES = { party: 'party.json', avventura: 'avventura.json', registro: 'registro.txt', ritratti: 'ritratti.json' };

fs.mkdirSync(CAMPAGNE, { recursive: true });

const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const validId = id => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > 5e6) { reject(new Error('troppo grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
// File statici: contenuto in memoria (riletto se cambia la data di modifica), ETag per le richieste condizionate (304),
// compressione brotli/gzip per i tipi testuali (calcolata una volta sola) e cache lunga per immagini e librerie.
const COMPRIMIBILI = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const cacheFile = new Map();
function serveStatic(res, baseDir, rel, req, lunga = false) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return send(res, 403, { error: 'vietato' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'non trovato' });
    let c = cacheFile.get(file);
    const fresco = c && c.mtime === st.mtimeMs;
    const consegna = () => {
      const ext = path.extname(file).toLowerCase(), tipo = MIME[ext] || 'application/octet-stream';
      const h = { 'Content-Type': tipo, ETag: c.etag, 'Cache-Control': lunga ? 'public, max-age=86400' : 'no-cache', Vary: 'Accept-Encoding' };
      if (req && req.headers['if-none-match'] === c.etag) { res.writeHead(304, h); return res.end(); }
      let corpo = c.buf;
      if (COMPRIMIBILI.has(ext) && c.buf.length > 1024) {
        const ae = String(req?.headers['accept-encoding'] || '');
        if (/\bbr\b/.test(ae)) { c.br = c.br || zlib.brotliCompressSync(c.buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); corpo = c.br; h['Content-Encoding'] = 'br'; }
        else if (/\bgzip\b/.test(ae)) { c.gz = c.gz || zlib.gzipSync(c.buf, { level: 6 }); corpo = c.gz; h['Content-Encoding'] = 'gzip'; }
      }
      h['Content-Length'] = corpo.length;
      res.writeHead(200, h); res.end(corpo);
    };
    if (fresco) return consegna();
    fs.readFile(file, (e2, buf) => {
      if (e2) return send(res, 404, { error: 'non trovato' });
      c = { mtime: st.mtimeMs, buf, etag: `"${buf.length.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`, br: null, gz: null };
      cacheFile.set(file, c); consegna();
    });
  });
}

async function api(req, res, parts) {
  // /api/campagne
  if (parts[1] === 'campagne' && parts.length === 2) {
    if (req.method === 'GET') {
      const list = fs.readdirSync(CAMPAGNE, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
        let nome = d.name;
        try { nome = JSON.parse(fs.readFileSync(path.join(CAMPAGNE, d.name, 'meta.json'), 'utf8')).nome || nome; } catch {}
        return { id: d.name, nome };
      });
      return send(res, 200, list);
    }
    if (req.method === 'POST') {
      const { nome } = JSON.parse(await readBody(req) || '{}');
      let id = slug(nome || '');
      if (!id) return send(res, 400, { error: 'nome non valido' });
      let n = 1, base = id;
      while (fs.existsSync(path.join(CAMPAGNE, id))) id = `${base}-${++n}`;
      const dir = path.join(CAMPAGNE, id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ nome, creata: new Date().toISOString() }, null, 2));
      return send(res, 201, { id, nome });
    }
  }
  // /api/campagne/:id[/:file]
  if (parts[1] === 'campagne' && parts.length >= 3) {
    const id = parts[2];
    if (!validId(id)) return send(res, 400, { error: 'id non valido' });
    const dir = path.join(CAMPAGNE, id);
    if (parts.length === 3 && req.method === 'DELETE') {
      if (!fs.existsSync(dir)) return send(res, 404, { error: 'non trovata' });
      fs.rmSync(dir, { recursive: true, force: true });
      return send(res, 200, { ok: true });
    }
    const fname = FILES[parts[3]];
    if (!fname) return send(res, 404, { error: 'file sconosciuto' });
    const file = path.join(dir, fname);
    if (!fs.existsSync(dir)) return send(res, 404, { error: 'campagna non trovata' });
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return send(res, 200, parts[3] === 'registro' ? '' : 'null', parts[3] === 'registro' ? 'text/plain; charset=utf-8' : undefined);
      return send(res, 200, fs.readFileSync(file), parts[3] === 'registro' ? 'text/plain; charset=utf-8' : undefined);
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (parts[3] !== 'registro') JSON.parse(body); // valida
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, body); fs.renameSync(tmp, file); // scrittura atomica
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && parts[3] === 'registro') {
      const { riga } = JSON.parse(await readBody(req) || '{}');
      fs.appendFileSync(file, String(riga).replace(/[\r\n]+/g, ' ') + '\n');
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { error: 'endpoint sconosciuto' });
}

// ---- ascolto sulla rete locale (solo per la modalità cooperativa) ----
// Il server principale resta su 127.0.0.1. Quando si ospita una partita se ne apre un secondo, su tutte le interfacce,
// che serve soltanto i file statici del gioco e le richieste /api/coop (mai le campagne salvate).
let lan = null;
async function gestoreLan(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') { if (await coop.gestisci(req, res, parts, url)) return; return send(res, 404, { error: 'non disponibile' }); }
    if (parts[0] === 'assets') return serveStatic(res, ASSETS, parts.slice(1).join('/'), req, true);
    if (parts[0] === 'rules') return serveStatic(res, path.join(DATA, 'rules'), parts.slice(1).join('/'), req);
    return serveStatic(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1), req, pathname.startsWith('/vendor/'));
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
/** Apre (o riapre) l'ascolto di rete sulla porta scelta dall'utente. Se la porta è occupata segnala l'errore, senza ripiegare su un'altra. */
async function apriLan(porta) {
  const richiesta = Number(porta) || Number(process.env.FAD_COOP_PORT) || 3001;
  if (lan && lan.address().port === richiesta) return { porta: richiesta };
  if (lan) { lan.closeAllConnections?.(); await new Promise(r => lan.close(() => r())); lan = null; }
  return new Promise((resolve, reject) => {
    const srv = http.createServer(gestoreLan);
    srv.once('error', e => reject(new Error(e.code === 'EADDRINUSE' ? `La porta ${richiesta} è già in uso: scegline un’altra.` : e.code === 'EACCES' ? `Non hai il permesso di usare la porta ${richiesta}.` : e.message)));
    srv.listen(richiesta, '0.0.0.0', () => { lan = srv; resolve({ porta: richiesta }); });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') { if (await coop.gestisci(req, res, parts, url, { apriLan })) return; return await api(req, res, parts); }
    if (parts[0] === 'assets') return serveStatic(res, ASSETS, parts.slice(1).join('/'), req, true);
    if (parts[0] === 'rules') return serveStatic(res, path.join(DATA, 'rules'), parts.slice(1).join('/'), req);
    return serveStatic(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1), req, pathname.startsWith('/vendor/'));
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`4 Against Darkness pronto su http://localhost:${server.address().port}`));
module.exports = { server, CAMPAGNE };
