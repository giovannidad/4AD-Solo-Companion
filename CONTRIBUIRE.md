# Come contribuire

Grazie dell'interesse! Il progetto è piccolo e senza strumenti di build: basta Node.js.

1. Fai un fork e crea un ramo (`git checkout -b mia-modifica`).
2. `npm install` e `npm start`, poi prova nel browser (http://localhost:3000).
3. Tieni il codice semplice: moduli ES, nessun framework, nomi e messaggi in italiano.
4. Controlla la sintassi dei moduli: `for f in public/js/*.js; do node --input-type=module --check < $f; done`.
5. Descrivi nella pull request cosa cambia e come l'hai provato.

Se tocchi `public/js/modulo.js`: `node tools/valida-modulo.js assets/moduli/*.json` deve restare senza errori; se cambi i dati dei mostri, rigenera `docs/MOSTRI-MODULI.md` con `node tools/elenco-mostri.js`.

Idee utili: automatizzare i poteri dei mostri avanzati ancora solo descritti, uscite delle tessere per il posizionamento assistito,
modalità cooperativa online, test automatici delle regole, traduzioni.

**Non caricare il manuale in PDF** né altro materiale protetto da copyright.

## Pacchetti di compilazione (`dist/`)

Dopo ogni nuova compilazione o pubblicazione la cartella `dist/` deve contenere **solo l'ultima versione**: elimina i file delle versioni precedenti (`Four Against Darkness-<versione>*`). Le vecchie versioni restano scaricabili dalle release su GitHub. La cartella è esclusa da git.
