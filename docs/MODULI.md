# Avventure scritte (moduli)

Un **modulo** è un file di testo (JSON) che descrive un dungeon già pronto: la mappa, le porte, e il contenuto di ogni stanza
(mostri, tesori, trappole, eventi). Il gioco lo legge, disegna le stanze sul foglio man mano che il gruppo le esplora e applica le
regole di sempre per combattimenti, tesori, trappole, mostri erranti, perquisizioni e riposo. Chi scrive il modulo decide *che cosa
c'è*; il gioco decide *come si risolve*.

Un modulo funziona in tutte le versioni: sito per telefono (installabile), app per Mac e Windows, avvio da PC con `npm start`.
Nessuna installazione: basta il file.

- Formato in breve: [esempio minimo](#esempio-minimo) e [riferimento dei campi](#riferimento).
- Controllo del file prima di giocare: `node tools/valida-modulo.js mio-modulo.json` (vedi [Controllo](#controllo)).
- Esempi pronti: `assets/moduli/cripta-dei-sussurri.json` (livelli 3-5) e `assets/moduli/fortezza-di-cenere.json` (livelli 6-8, «Contro l'Abisso»).
- Mostri delle tabelle richiamabili per nome: [MOSTRI-MODULI.md](MOSTRI-MODULI.md).
- Schema JSON per l'autocompletamento nell'editor: [modulo-avventura.schema.json](../assets/moduli/modulo-avventura.schema.json).

## Come si carica

Pannello **Dungeon**, quando non c'è un'avventura in corso, riquadro **Avventura scritta**:

- **Campagne narrative…** apre l'elenco delle campagne incluse (file `assets/moduli/campagne.json`: `id`, `nome`, `descrizione` e l'elenco `avventure` dei file dei moduli; il livello coperto si ricava dalle avventure). Si sceglie la campagna, poi l'avventura e infine il gruppo: quello attuale, gli eroi copiati da un'altra partita salvata (di livello adeguato) oppure un gruppo nuovo portato al livello minimo richiesto. Gli ultimi due casi creano una nuova partita salvata;
- **Carica da file…** apre un file `.json` dal dispositivo.

Il gioco controlla il file e, se ci sono errori, li elenca senza avviare nulla. Se va bene, mostra una scheda con autore, livello consigliato,
numero di stanze e tabelle usate; avvisa se il livello o il numero dei personaggi non corrisponde a quello consigliato (si può giocare lo stesso).
L'avventura è salvata nella campagna insieme al modulo: per riprenderla non serve più il file.

## Esempio minimo

```json
{
  "formato": "4ad-avventura",
  "versione": 1,
  "nome": "Il pozzo dimenticato",
  "livello": { "min": 1, "max": 2 },
  "stanze": [
    { "id": "ingresso", "nome": "Imbocco del pozzo", "tipo": "ingresso", "rettangolo": [0, 0, 3, 3] },
    { "id": "tana", "nome": "Tana", "rettangolo": [3, 1, 4, 3],
      "contenuto": [ { "tipo": "mostri", "tabella": "infestanti", "id": "ratti" }, { "tipo": "tesoro", "tira": true } ] }
  ],
  "porte": [ { "da": "ingresso", "a": "tana", "x": 2, "y": 1, "lato": "e" } ]
}
```

## Riferimento

### Dati generali

| Campo | Obbligatorio | Descrizione |
|---|---|---|
| `formato` | sì | sempre `"4ad-avventura"` |
| `versione` | sì | sempre `1` |
| `nome` | sì | titolo (max 60 caratteri); diventa il nome del dungeon |
| `autore`, `licenza`, `lingua` | no | chi l'ha scritto, con quale licenza si può copiare, lingua del testo |
| `descrizione` | no | riassunto mostrato nella scheda di presentazione |
| `introduzione`, `conclusione` | no | testo scritto nel registro all'inizio e (se si vince) alla fine; l'introduzione si mostra anche in una finestra (paragrafi separati da una riga vuota) e si può rileggere dal pannello Dungeon |
| `obiettivo` | no | che cosa deve ottenere il gruppo: si mostra nella finestra di apertura, sotto l'introduzione |
| `serie` | no | `{ "id": "nome-serie", "numero": n, "di": n }`: l'avventura è il capitolo n di una campagna |
| `finali` | no | da 2 a 6 finali a scelta `{ "id", "nome", "scelta", "testo" }`: alla conclusione con successo il giocatore ne sceglie uno, che viene letto e ricordato nella campagna |
| `introduzioneSe` | no | testi da aggiungere all'introduzione secondo il finale scelto in un capitolo precedente della stessa serie: chiave `"capitolo:id-finale"` (es. `"1:tieni"`) |
| `livello` | consigliato | `{ "min": n, "max": n }`: livello dei personaggi per cui è pensata (1-30) |
| `eroi` | no | `{ "min": n, "max": n }`: quanti personaggi |
| `set` | no | tabelle da usare per i tiri casuali (vedi sotto); predefinito `"base"` |
| `fine` | no | `"boss"` (predefinito: si esce dopo il boss finale) oppure `"libera"` (si può uscire quando si vuole) |
| `stanze` | sì | elenco delle stanze |
| `porte` | sì (se più di una stanza) | elenco delle porte |

### Avventure oltre il primo livello

Il livello dei personaggi non è un limite del formato: `livello` è un'indicazione per il giocatore, e si può scrivere un'avventura per qualunque livello da 1 a 30.
Due strumenti la rendono adatta al livello:

1. **`set`** sceglie le tabelle del gioco per tutto ciò che viene tirato a caso (tesori, trappole, eventi, caratteristiche, mostri erranti, spostamenti):

   | `set` | Tabelle |
   |---|---|
   | `base` | manuale base (livelli 1-2) |
   | `coboldi`, `acque` | Schiavisti Coboldi (1-2), Acque Oscure (1-4) |
   | `diabolici` | Nemici diabolici, tabelle avanzate del manuale base (3-5) |
   | `caos` | Contro il Caos (3-6), senza le missioni del supplemento |
   | `abisso` | Contro l'Abisso (5-9) |
   | `aldila` | Orrori dall'Aldilà (6-9) |
   | `profondita` | Contro le Profondità Dimenticate (10-19) |

   «Labirinti Silvani» non è supportato: le sue regole dipendono dalle tessere numerate della selva. Ogni set porta con sé le sue regole (dadi, tesori, trappole) e gli
   stessi controlli all'ingresso del dungeon che avrebbe un'avventura normale.

2. **Mostri a livello giusto.** I mostri si possono prendere dalle tabelle del set (`tabella` + `id`, vedi [MOSTRI-MODULI.md](MOSTRI-MODULI.md)) oppure scrivere da zero con
   qualunque `liv`, `att` e `pv`: così un modulo per il livello 8 non dipende da quali mostri esistono nelle tabelle. Per tarare i valori, guarda quelli delle tabelle del set scelto.

### Stanze

```json
{ "id": "ossario", "nome": "Sala degli ossari", "tipo": "stanza", "rettangolo": [7, 7, 5, 5],
  "testo": "Cataste di ossa ordinate per tipo.", "contenuto": [ … ] }
```

| Campo | Descrizione |
|---|---|
| `id` | identificativo unico: minuscole, cifre, `-` e `_` (max 32) |
| `nome` | nome mostrato nell'elenco e sul registro |
| `tipo` | `"stanza"` (predefinito), `"corridoio"` (valgono le regole dei corridoi, per esempio −1 alla perquisizione) oppure `"ingresso"` (ce ne vuole una sola: è dove inizia il gruppo) |
| `rettangolo` | `[x, y, larghezza, altezza]` in quadretti |
| `celle` | in alternativa al rettangolo, per stanze di forma qualsiasi: elenco di quadretti `[[x, y], …]` |
| `testo` | descrizione da leggere quando il gruppo entra (si mostra prima di tirare qualunque dado) |
| `contenuto` | che cosa c'è nella stanza (vedi sotto); senza contenuto la stanza è vuota e si può perquisire |

**Coordinate.** `x` cresce verso destra (est), `y` verso il basso (sud); l'unità è il quadretto. Si scrive la mappa su un foglio quadrettato, con l'origine dove si vuole:
il gioco sposta tutto da solo. Le stanze non devono sovrapporsi e i quadretti di una stanza devono toccarsi per un lato (area unica). Un corridoio largo un quadretto è un
`rettangolo` di larghezza o altezza 1.

### Porte

Una porta si scrive **una volta sola** e vale nei due sensi. Si indica un quadretto della stanza `da`, il lato su cui si apre, e la stanza `a` che deve trovarsi subito oltre quel lato:

```json
{ "da": "ossario", "a": "cappella", "x": 11, "y": 9, "lato": "e" }
```

```
        x=11   x=12
y=9   [ossario]|[cappella]      lato "e" del quadretto (11, 9) di «ossario»
```

| Campo | Descrizione |
|---|---|
| `da`, `a` | `id` delle due stanze |
| `x`, `y` | quadretto di `da` su cui si apre la porta |
| `lato` | `"n"`, `"s"`, `"e"`, `"o"` (nord, sud, est, ovest) |
| `tipo` | `"normale"` (predefinito) oppure `"segreta"`: non si vede e non si può usare finché il gruppo non la trova perquisendo (esito «porta segreta») |
| `nota` | testo scritto nel registro quando si attraversa la porta |

Ogni stanza deve poter essere raggiunta dall'ingresso. Le porte segrete sono ammesse, ma il controllo avvisa se una stanza si raggiunge solo da lì.

### Contenuto

`contenuto` è un elenco di elementi che il gioco esegue **in ordine** quando il gruppo entra per la prima volta. Una stanza può avere più elementi (per esempio mostri e poi tesoro).

#### `mostri`

Un mostro delle tabelle del gioco:

```json
{ "tipo": "mostri", "tabella": "seguaci", "id": "goblin", "quantita": "1d6+3" }
```

`tabella` è `infestanti`, `seguaci`, `aberranti`, `boss`, … e `id` è quello di [MOSTRI-MODULI.md](MOSTRI-MODULI.md) per il `set` scelto (le voci del manuale base valgono ovunque).
`quantita` è facoltativa: un numero oppure un tiro (`"2d6"`); senza, si usa il numero previsto dalla tabella. Le voci con una scelta interna (per esempio «Scheletri o zombi») non si possono richiamare: si scrive un mostro personalizzato.

Un mostro scritto da zero:

```json
{ "tipo": "mostri", "nome": "Sacerdote scheletrico", "liv": 5, "att": 2, "pv": 4, "maggiore": true,
  "tag": ["non-morto"], "mor": "NO", "tes": 1, "reazioni": [[1, 6, "morte"]],
  "immuneIncantesimi": ["Sonno"], "note": "Testo con i poteri che il gioco non conosce." }
```

| Campo | Descrizione |
|---|---|
| `nome`, `liv`, `att`, `pv` | obbligatori: nome, livello, numero di attacchi, punti vita (per un gruppo di minori, i PV di ciascuno) |
| `maggiore` | `true` per un mostro maggiore (uno solo, con più PV); senza, è un gruppo di minori |
| `quantita` | quanti minori (numero o tiro); predefinito 1 |
| `mor` | modificatore al morale (intero) oppure `"NO"` se non fa mai la prova di morale; predefinito 0 |
| `tes` | tesoro: modificatore (intero), `"NO"` (nessun tesoro) o `"x2"`; predefinito `"NO"` per i minori, `1` per i maggiori |
| `xp` | `false` se non dà tiri di esperienza; predefinito `true` |
| `tag` | etichette usate dalle regole (`non-morto`, `animale`, `demone`, `umanoide`, `volante`, `caos`…) |
| `reazioni` | tabella della reazione: elenco di `[da, a, azione]` sul d6; azioni `combatte`, `combatte-sempre`, `fugge`, `fugge-inf`, `morte`, `corruzione`, `dorme`, `pacifico`, `amichevole`; predefinito `[[1, 6, "combatte"]]` |
| `note` | poteri e regole particolari scritti a parole: il gioco li mostra nella scheda dello scontro e il giocatore li applica a mano |
| poteri automatici | `immuneIncantesimi` (elenco di nomi), `immuneContundenti`, `contundentePiu`, `orda`, `dissangua`, `attPerBersaglio` (vero/falso), `livPrimoTurno`, `livDifesaFerito`, `danno` (interi) |
| `finale` | `true` per il boss finale (richiede `maggiore`): chi lo sconfigge può uscire dal dungeon; si applicano le regole del boss finale (morale assente, +1 PV e +1 attacco) |

#### `tesoro`

```json
{ "tipo": "tesoro", "tira": true, "mod": 1 }
{ "tipo": "tesoro", "fisso": [
    { "tipo": "oro", "valore": 60 },
    { "tipo": "gemma", "valore": 40 },
    { "tipo": "arma-magica", "testo": "Pugnale d'argento +1", "bonusArma": 1, "armaTipo": "arma leggera da taglio" } ] }
```

- `tira`: il gioco tira sulla tabella dei tesori del `set` (con `mod` da -5 a +5 sul dado).
- `fisso`: oggetti decisi dall'autore, che finiscono nel bottino da assegnare. Ogni oggetto ha un `tipo`: `oro`, `gemma`, `gioiello` (con `valore` in pezzi d'oro), `oggetto`, `magico`, `pergamena`,
  `arma-magica`, `armatura-magica` (con `testo`). Campi facoltativi: `bonusArma`, `bonusDifesa` (1-5), `cariche`, `incantesimo`, `solo` (elenco di classi), `nome`.
- Si possono dare entrambi.

#### `trappola`

- `{ "tipo": "trappola", "tira": true }`: trappola a caso dalla tabella del `set`.
- `{ "tipo": "trappola", "modello": "Dardo", "liv": 5 }`: una trappola del manuale base (`Botola`, `Dardo`, `Gas velenoso`, `Lance`, `Masso gigante`, `Tagliola`) con il livello scelto; il gioco offre di disarmarla o lasciarla scattare.
- `{ "tipo": "trappola", "nome": "Lama a pendolo", "testo": "…", "liv": 6 }`: trappola inventata, da risolvere a mano secondo il testo.

#### `caratteristica` ed `evento`

`{ "tipo": "caratteristica", "tira": true }` e `{ "tipo": "evento", "tira": true }` tirano sulle tabelle del `set`. Con `nome` e `testo` si scrive invece un elemento fisso
(`{ "tipo": "evento", "nome": "Le voci del pozzo", "testo": "…" }`): il gioco lo scrive nel registro e il giocatore lo risolve. Una `caratteristica` lascia la stanza perquisibile.

#### `vuota` e `testo`

`{ "tipo": "vuota" }` segna la stanza come vuota (perquisibile; è già così se non c'è altro). `{ "tipo": "testo", "testo": "…" }` aggiunge una frase al registro senza effetti sul gioco.

## Come si gioca un modulo

- Il pannello **Dungeon** mostra la stanza attuale, la sua descrizione e un pulsante per ogni porta. Aprire una porta verso una stanza nuova la disegna sul foglio, legge la descrizione e
  esegue il contenuto; tornare in una stanza già visitata fa tirare i dadi di spostamento (mostri erranti) come in un dungeon normale.
- Le porte segrete compaiono quando una perquisizione dà l'esito «porta segreta». Se la stanza ne ha più d'una si sceglie quale.
- I mostri erranti, il riposo (stanze vuote o ripulite), la perquisizione, i tiri esperienza e il bottino sono quelli di sempre. L'esito «nuova stanza a caso» non esiste: le stanze sono quelle del modulo.
- Con `"fine": "boss"` il pulsante di uscita si abilita dopo aver sconfitto il boss finale; con `"libera"` è sempre attivo.

## Controllo

```bash
node tools/valida-modulo.js mio-modulo.json
```

Segnala gli **errori** (il modulo non si può usare) e gli **avvisi** (si può giocare, ma forse non è voluto): campi mancanti o fuori scala, stanze sovrapposte o spezzate, porte che non
combaciano con le stanze, stanze irraggiungibili, mostri e `id` che non esistono nel `set`, reazioni incomplete. Lo stesso controllo gira nel gioco quando si carica un file.

L'editor può aiutare con lo schema: in Visual Studio Code, aggiungi come prima riga del file `"$schema": "https://giovannidad.github.io/4AD-Solo-Companion/assets/moduli/modulo-avventura.schema.json"`,
oppure associa localmente `assets/moduli/modulo-avventura.schema.json` ai file dei moduli. Lo schema controlla la struttura; i controlli sulla mappa li fa solo `valida-modulo.js`.

## Scrivere un modulo con un assistente

Un assistente (come Claude) può scrivere un modulo se gli dai questo documento. Un buon punto di partenza:

> Scrivi un modulo di avventura nel formato `4ad-avventura` (documento allegato) per 4 personaggi di livello 7, con le tabelle «abisso». Tema: una miniera allagata.
> Dieci stanze, un ramo segreto, un boss finale. Usa mostri delle tabelle quando esistono e mostri personalizzati per quelli unici. Restituisci solo il JSON.

Poi controlla il risultato con `node tools/valida-modulo.js`. Chiedi sempre le stanze come `rettangolo` o `celle` e le porte con le coordinate indicate qui: gli errori più comuni sono porte
che non toccano la stanza di destinazione e stanze che si sovrappongono.

## Limiti della versione 1

- Non sono supportati i Labirinti Silvani, le missioni del supplemento «Contro il Caos» e la mappa a esagoni di «Orrori dall'Aldilà»: nel set `caos` e `aldila` si usano solo le tabelle.
- I poteri dei mostri personalizzati sono quelli elencati; gli altri vanno scritti in `note` e applicati a mano.
- Le stanze hanno sempre l'aspetto vettoriale del gioco (pavimento, griglia, pareti, porte); non si possono usare immagini proprie.
- Non c'è un editor visuale: il file si scrive a mano o con un assistente.

## Diritti

Il file contiene solo ciò che scrive l'autore. **Non copiare nei moduli testi, mappe o tabelle dei manuali** di *Four Against Darkness* o di altri giochi: sono protetti dal diritto d'autore.
Il campo `licenza` dice a chi lo scarica che cosa può farne (per esempio `CC BY 4.0`). Il programma non è affiliato né approvato dall'autore o dall'editore del gioco.
