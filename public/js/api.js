// Client per il server: tutto viene salvato come file di testo nella cartella data/
async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r;
}
export const api = {
  elencoCampagne: async () => (await j('/api/campagne')).json(),
  creaCampagna: async nome => (await j('/api/campagne', { method: 'POST', body: JSON.stringify({ nome }) })).json(),
  eliminaCampagna: id => j(`/api/campagne/${id}`, { method: 'DELETE' }),
  leggi: async (id, file) => { const t = await (await j(`/api/campagne/${id}/${file}`)).text(); return file === 'registro' ? t : JSON.parse(t || 'null'); },
  scrivi: (id, file, dati) => j(`/api/campagne/${id}/${file}`, { method: 'PUT', body: file === 'registro' ? dati : JSON.stringify(dati, null, 1) }),
  riga: (id, riga) => j(`/api/campagne/${id}/registro`, { method: 'POST', body: JSON.stringify({ riga }) }),
  regola: async nome => (await j(`/rules/${nome}.json`)).json()
};
