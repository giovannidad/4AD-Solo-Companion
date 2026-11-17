#!/usr/bin/env node
// Prepara la cartella da pubblicare su un host statico (versione per telefono / PWA, senza server di gioco).
// Uso: node tools/prepara-statico.js [cartella-di-destinazione]     (predefinita: web-statico/)
// Copia public/, assets/ (-> assets/) e data/rules/ (-> rules/), poi scrive:
//   versione.json     { versione (da package.json), build (impronta dei file) }
//   elenco-file.json  elenco dei file da mettere in cache per l'uso offline
// e inserisce l'impronta in sw.js: a ogni modifica dei file il service worker cambia e il telefono propone l'aggiornamento.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DEST = path.resolve(process.argv[2] || path.join(ROOT, 'web-statico'));
if (DEST === ROOT || ROOT.startsWith(DEST + path.sep)) { console.error('Destinazione non valida.'); process.exit(1); }

const ORIGINI = [['public', ''], ['assets', 'assets'], ['data/rules', 'rules']];
const elenco = (dir, prefisso = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
  if (d.name.startsWith('.')) return [];
  const rel = prefisso ? `${prefisso}/${d.name}` : d.name;
  return d.isDirectory() ? elenco(path.join(dir, d.name), rel) : [rel];
});

const file = [];   // { rel, src }
for (const [da, a] of ORIGINI) for (const r of elenco(path.join(ROOT, da))) file.push({ rel: a ? `${a}/${r}` : r, src: path.join(ROOT, da, r) });
file.sort((x, y) => x.rel.localeCompare(y.rel));

const hash = crypto.createHash('sha1');
for (const f of file) { hash.update(f.rel); hash.update(fs.readFileSync(f.src)); }
const versione = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0';
const build = `${versione}-${hash.digest('hex').slice(0, 8)}`;

fs.rmSync(DEST, { recursive: true, force: true });
for (const f of file) {
  const out = path.join(DEST, f.rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(f.src, out);
}
const sw = path.join(DEST, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace('__BUILD__', build));
fs.writeFileSync(path.join(DEST, 'versione.json'), JSON.stringify({ versione, build }));
const cache = file.map(f => f.rel).filter(r => r !== 'sw.js');
fs.writeFileSync(path.join(DEST, 'elenco-file.json'), JSON.stringify({ build, file: cache }));
console.log(`Pronto in ${DEST}: ${file.length} file, versione ${versione}, build ${build}`);
