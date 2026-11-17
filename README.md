# Four Against Darkness – tavolo da gioco

Assistente web/desktop per giocare in solitario a **Four Against Darkness** (edizione italiana, di Andrea Sfiligoi):
gestione del gruppo di eroi, mappa su foglio quadrettato con effetto matita, dadi 3D con fisica reale e tabelle
del regolamento automatizzate. Tutti i dati sono salvati in **file di testo** (JSON / TXT) leggibili e modificabili a mano.

> Progetto non ufficiale e senza scopo di lucro, non affiliato né approvato dall'autore o dall'editore del gioco.
> Serve il manuale originale per giocare: **non è incluso** nel repository.

## Funzioni

- **Gruppo:** 8 classi (barbaro, chierico, elfo, furfante, guerriero, mago, mezzuomo, nano), schede complete,
  equipaggiamento, negozio, ordine di marcia, lanterna, incantesimi preparati, indizi, riposo.
- **Mappa:** foglio quadrettato che parte da 20×28 e si espande con il dungeon. Il d66 sceglie la tessera, che si adatta ai quadretti e si disegna "a matita".
  Si può ruotare (R), specchiare (F), trascinare liberamente, zoomare e spostare il foglio.
- **Segnalini:** un pedone per eroe, che segue il gruppo di stanza in stanza; si possono dividere trascinandoli.
- **Dadi 3D:** i dadi rotolano sopra la mappa (three.js + cannon-es). Il valore è letto dalla faccia superiore.
- **Dungeon:** contenuto delle stanze (2d6), caratteristiche, eventi, trappole, tesori, perquisire, porte segrete,
  mostri erranti, boss finale, missioni e ricompense epiche.
- **Incontri:** reazioni, attacco (con tutti i modificatori), incantesimi, difese, morale, ritirata/fuga, bottino,
  tiri esperienza, abilità speciali dei mostri.
- **Salvataggio:** una cartella per campagna con `party.json`, `avventura.json`, `registro.txt`.

Cosa è automatico e cosa no è descritto in [docs/REGOLE.md](docs/REGOLE.md): l'app è un **assistente al tavolo**,
le scelte restano al giocatore.

## Su telefono (versione web installabile)

Indirizzo: **https://giovannidad.github.io/4AD-Solo-Companion/**

- **Android (Chrome):** apri l'indirizzo, poi menu ⋮ → «Installa app» (o «Aggiungi a schermata Home»).
- **iPhone (Safari):** apri l'indirizzo, poi Condividi → «Aggiungi alla schermata Home» (deve essere Safari).
- **PC:** Chrome ed Edge mostrano l'icona di installazione nella barra dell'indirizzo.

Questa versione non usa il server: le campagne si salvano nella memoria del browser del dispositivo e, dopo il primo caricamento, funziona anche offline.
Il browser può cancellare quei dati (soprattutto su iPhone): ogni tanto usa «Esporta campagna» nelle Impostazioni; con «Importa campagna» la ritrovi su un altro dispositivo.
La cooperativa online richiede il server e non è disponibile. L'interfaccia per telefono (barra in basso, mappa al tocco) è stata provata finora solo
nel browser del computer, con la finestra ridimensionata: non su un telefono vero. Dettagli in `docs/ARCHITETTURA.md`.

## Avvio rapido (sviluppo)

Requisiti: Node.js 18 o superiore.

```bash
npm install
npm start            # server su http://localhost:3000
npm run desktop      # stessa cosa in una finestra Electron
```

## App per Mac e Windows

```bash
npm run dist:mac     # dist/*.dmg: uno per Intel (x64) e uno per Apple Silicon (arm64: M1, M2, M3…)
npm run dist:win     # dist/*-win.zip
```

**Quale pacchetto scaricare.** Mac con processore Intel: `Four.Against.Darkness-X.Y.Z.dmg`. Mac con chip Apple (M1, M2, M3…):
`Four.Against.Darkness-X.Y.Z-arm64.dmg` (menu  → *Informazioni su questo Mac*: «Chip» = Apple, «Processore» = Intel).

I pacchetti non sono notarizzati da Apple (nessun certificato a pagamento). Le app per Mac hanno però una **firma locale
("ad-hoc")**: serve a macOS su Apple Silicon, che rifiuta i programmi senza una firma valida (messaggio «l'app è danneggiata»).
Al primo avvio:

- **macOS:** copia l'app in *Applicazioni*, poi tasto destro → "Apri" → "Apri". Se compare ancora «danneggiata», rimuovi la
  quarantena con `xattr -cr "/Applications/Four Against Darkness.app"` e riprova.
- **Windows:** SmartScreen mostra un avviso: "Ulteriori informazioni" → "Esegui comunque".

I salvataggi dell'app installata stanno nella cartella dati dell'utente (menu *File → Apri cartella dei salvataggi*).

## Documentazione

- [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md) – struttura del codice e dei dati
- [docs/REGOLE.md](docs/REGOLE.md) – regole implementate e semplificazioni
- [docs/ASSET.md](docs/ASSET.md) – come sono state ricavate le tessere e le misure della griglia
- [CONTRIBUIRE.md](CONTRIBUIRE.md) – come collaborare

## Struttura

```
server.js            server Node senza dipendenze (API + file statici)
electron/main.js     guscio desktop
public/              frontend (ES modules, nessun bundler)
  js/map2d.js        mappa 2D, matita, segnalini
  js/table3d.js      dadi 3D (three.js + cannon-es)
  js/dice.js         tutti i tiri passano da qui
  js/rules.js        modificatori e tabelle
  js/game.js         avventura, stanze, contenuti, tesori, esperienza
  js/combat.js       incontri e combattimento
  js/party.js, ui.js pannelli dell'interfaccia
data/rules/*.json    classi, mostri, tabelle, misure delle tessere
assets/              tessere delle stanze e ingressi
build/icon.png       icona dell'app
```

## Licenza

Il codice è rilasciato con licenza **GNU GPL v3** (vedi [LICENSE](LICENSE)): chiunque può usarlo, studiarlo,
modificarlo e ridistribuirlo, a patto che le versioni derivate restino con la stessa licenza.
Tabelle, immagini e nome del gioco **non** sono coperti dalla licenza: vedi [NOTICE](NOTICE).
