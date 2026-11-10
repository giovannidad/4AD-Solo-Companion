// Server minimale senza dipendenze: serve il frontend e salva tutto in file di testo (JSON / TXT)
// dentro la cartella "data". Avvio: node server.js  ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

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
const FILES = { party: 'party.json', avventura: 'avventura.json', registro: 'registro.txt' };

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
function serveStatic(res, baseDir, rel) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return send(res, 403, { error: 'vietato' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'non trovato' });
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') return await api(req, res, parts);
    if (parts[0] === 'assets') return serveStatic(res, ASSETS, parts.slice(1).join('/'));
    if (parts[0] === 'rules') return serveStatic(res, path.join(DATA, 'rules'), parts.slice(1).join('/'));
    return serveStatic(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1));
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`4 Against Darkness pronto su http://localhost:${server.address().port}`));
module.exports = { server, CAMPAGNE };
