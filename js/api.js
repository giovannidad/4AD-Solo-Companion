// Archivio delle campagne. Due implementazioni con la stessa interfaccia:
//  - server: file di testo nella cartella data/ tramite le rotte /api/campagne (PC, Electron);
//  - locale: IndexedDB del browser, senza server (versione per telefono / PWA). Stessi identificatori, stessa struttura dei dati.
// La scelta è automatica all'avvio (inizializzaApi): se /api/campagne risponde si usa il server, altrimenti la memoria del browser.
// Con ?locale=1 nell'indirizzo si forza la modalità locale (per provarla).
async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r;
}
// le regole sono file statici: percorso relativo alla pagina, così funziona anche se l'app sta in una sottocartella
const regola = async nome => (await j(`rules/${nome}.json`)).json();

const server = {
  modalita: 'server',
  elencoCampagne: async () => (await j('/api/campagne')).json(),
  creaCampagna: async nome => (await j('/api/campagne', { method: 'POST', body: JSON.stringify({ nome }) })).json(),
  eliminaCampagna: id => j(`/api/campagne/${id}`, { method: 'DELETE' }),
  leggi: async (id, file) => { const t = await (await j(`/api/campagne/${id}/${file}`)).text(); return file === 'registro' ? t : JSON.parse(t || 'null'); },
  scrivi: (id, file, dati) => j(`/api/campagne/${id}/${file}`, { method: 'PUT', body: file === 'registro' ? dati : JSON.stringify(dati, null, 1) }),
  riga: (id, riga) => j(`/api/campagne/${id}/registro`, { method: 'POST', body: JSON.stringify({ riga }) }),
  regola
};

// ---------------- IndexedDB ----------------
// Un record per campagna: { id, nome, creata, party, avventura, registro, ritratti } dove i primi tre campi di contenuto sono TESTO
// (JSON o righe), esattamente come i file del server (party.json, avventura.json, registro.txt, ritratti.json).
const DB = '4ad-companion', STORE = 'campagne', FILE_VALIDI = ['party', 'avventura', 'registro', 'ritratti'];
let dbPromessa = null;
const apriDb = () => dbPromessa || (dbPromessa = new Promise((ok, ko) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => { dbPromessa = null; ko(r.error); };
}));
/** Esegue `fn(store)` in una transazione; il risultato (o l'errore) arriva a transazione completata. */
async function tx(modo, fn) {
  const db = await apriDb();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, modo); let out;
    Promise.resolve(fn(t.objectStore(STORE))).then(v => { out = v; }, ko);
    t.oncomplete = () => ok(out); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error || new Error('transazione annullata'));
  });
}
const rq = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const validId = id => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
const sicuro = (id, file) => { if (!validId(id)) throw new Error('id non valido'); if (file && !FILE_VALIDI.includes(file)) throw new Error('file sconosciuto'); };

/** Crea un record con un id libero (come il server: slug del nome, poi -2, -3…). */
async function nuovoRecord(nome, extra = {}) {
  const base = slug(nome || ''); if (!base) throw new Error('nome non valido');
  return tx('readwrite', async s => {
    let id = base, n = 1;
    while (await rq(s.getKey(id))) id = `${base}-${++n}`;
    const rec = { id, nome, creata: new Date().toISOString(), ...extra };
    await rq(s.add(rec));
    return { id, nome };
  });
}
/** Legge, modifica e riscrive un record nella stessa transazione. */
const aggiorna = (id, fn) => tx('readwrite', async s => {
  const rec = await rq(s.get(id)); if (!rec) throw new Error('campagna non trovata');
  fn(rec); await rq(s.put(rec));
});

const locale = {
  modalita: 'locale',
  elencoCampagne: () => tx('readonly', async s => (await rq(s.getAll())).map(({ id, nome }) => ({ id, nome })).sort((a, b) => a.id.localeCompare(b.id))),
  creaCampagna: nome => nuovoRecord(nome),
  eliminaCampagna: id => { sicuro(id); return tx('readwrite', s => rq(s.delete(id))); },
  leggi: async (id, file) => {
    sicuro(id, file);
    const rec = await tx('readonly', s => rq(s.get(id))); if (!rec) throw new Error('campagna non trovata');
    const t = rec[file];
    if (file === 'registro') return t || '';
    return t ? JSON.parse(t) : null;
  },
  scrivi: async (id, file, dati) => {
    sicuro(id, file);
    const t = file === 'registro' ? String(dati) : JSON.stringify(dati, null, 1);
    await aggiorna(id, rec => { rec[file] = t; });
  },
  riga: async (id, riga) => { sicuro(id); await aggiorna(id, rec => { rec.registro = (rec.registro || '') + String(riga).replace(/[\r\n]+/g, ' ') + '\n'; }); },
  regola,

  /** Contenuto di una campagna come oggetto da salvare in un file .json (copia di sicurezza). */
  esporta: async id => {
    sicuro(id);
    const rec = await tx('readonly', s => rq(s.get(id))); if (!rec) throw new Error('campagna non trovata');
    const f = { formato: '4ad-campagna', versione: 1, id: rec.id, nome: rec.nome, creata: rec.creata, registro: rec.registro || '' };
    for (const k of ['party', 'avventura', 'ritratti']) f[k] = rec[k] ? JSON.parse(rec[k]) : null;
    return f;
  },
  /** Crea una NUOVA campagna dal contenuto di un file esportato (non sovrascrive mai quelle esistenti). */
  importa: async f => {
    if (!f || f.formato !== '4ad-campagna' || !f.nome) throw new Error('Il file non è una campagna esportata da questo programma.');
    const extra = { registro: typeof f.registro === 'string' ? f.registro : '' };
    for (const k of ['party', 'avventura', 'ritratti']) if (f[k]) extra[k] = JSON.stringify(f[k], null, 1);
    if (f.creata) extra.creata = f.creata;
    const nuovo = await nuovoRecord(String(f.nome).slice(0, 40), extra);
    return nuovo;
  }
};

// ---------------- scelta all'avvio ----------------
let impl = server;
async function serverRisponde() {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/campagne', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
    return r.ok && Array.isArray(await r.clone().json());   // un host statico può rispondere 200 con una pagina HTML: non basta
  } catch { return false; }
}
/** Da chiamare una volta, prima di caricare regole e campagne. Restituisce 'server' o 'locale'. */
export async function inizializzaApi() {
  const forzata = new URLSearchParams(location.search).get('locale') === '1';
  const haIdb = typeof indexedDB !== 'undefined';
  if (!forzata || !haIdb) impl = (await serverRisponde()) ? server : locale;
  else impl = locale;
  if (impl === locale) {
    if (!haIdb) throw new Error('Questo browser non permette di salvare i dati sul dispositivo (IndexedDB non disponibile).');
    try { await apriDb(); } catch (e) { throw new Error('Impossibile aprire la memoria del browser (navigazione privata?): ' + (e?.message || e)); }
    try { navigator.storage?.persist?.(); } catch { /* ok */ }   // chiede di non cancellare i dati quando manca spazio
  }
  return impl.modalita;
}
export const modalita = () => impl.modalita;
export const inModalitaLocale = () => impl === locale;

// i moduli importano `api` e la usano subito: ogni metodo passa dall'implementazione scelta
export const api = new Proxy({}, { get: (_, k) => k === 'modalita' ? impl.modalita : impl[k] });
