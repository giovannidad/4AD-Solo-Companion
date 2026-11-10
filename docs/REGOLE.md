# Regole implementate

L'app segue il regolamento italiano di *Four Against Darkness*. È un **assistente**: tira i dadi, applica i
modificatori e tiene i conti, ma le decisioni (chi attacca, quando ritirarsi, dove mettere la stanza) restano al giocatore.
Tutto può essere corretto a mano (PV, mostri rimasti, oggetti, posizione dei segnalini).

## Automatico

- Tiri con **6 esplosivo** e **1 = fallimento automatico** (attacco, difesa, salvezza, ES).
- **Creazione eroi** con ricchezza iniziale tirata, vita `base + livello`, equipaggiamento di partenza.
- **Stanza d'ingresso (d6)**, **nuova stanza (d66)**, **contenuto (2d6)**, caratteristiche, eventi, trappole.
- **Tesori** (con modificatore del mostro, moltiplicatori, tesoro doppio nelle stanze segrete, boss finale ×3 / 2 oggetti magici),
  pergamene, oggetti magici, armi magiche.
- **Perquisire** (d6, −1 nei corridoi; il mezzuomo può ritirare con un punto fortuna), porta segreta (scorciatoia con 6), tesoro nascosto con complicazioni, indizi (3 = segreto + tiro ES).
- **Mostri**: tabelle infestanti, seguaci, aberranti, boss; boss finale (`1d6 + maggiori sconfitti ≥ 6`).
- **Reazioni dei mostri**, corruzione (oro, oro degli stolti; non con 2+ nani), missioni.
- **Attacco**: modificatori per classe, livello, arma (leggera −1, due mani +1, fionda −1), contundente vs scheletri,
  nano vs goblin, elfo vs orchi, chierico vs non-morti, furfante in superiorità, lanterna assente (−2), zoppia, bonus del gruppo.
  Mostri minori: `floor(totale / LIV)` uccisi; maggiori: ferite, livello −1 sotto la metà dei PV.
- **Incantesimi**: Fulmine Magico, Palla di Fuoco, Sonno, Protezione, Benedizione, Fuga; Guarigione del chierico; attacco furioso del barbaro.
- **Difesa**: armatura, scudo, furfante, nano/mezzuomo contro giganti e troll, ritirata (+1), fuga, sorpresa, maledizione, lanterna;
  6 naturale = successo, 1 naturale = fallimento.
- **Morale** (minori sotto la metà, maggiori sotto la metà dei PV), ritirata/fuga con rientro nella stanza.
- **Abilità speciali**: infezione dei ratti, veleni (millepiedi, fungoidi, ragno), soffio di chimera e drago, sguardi di catoblepa e medusa,
  poteri del signore del caos, ferrofago, minotauro.
- **Esperienza**: tiri ES per maggiori sconfitti, 10 incontri con seguaci (−1), indizi; limiti di livello 5.

## Manuale (non automatizzato)

- Missioni di soccorso, rituale di resurrezione, vendita di oggetti (solo promemoria).
- Rigenerazione dei troll, sedare/legare i mostri, trasporto di compagni caduti o pietrificati.
- Più di un tipo di nemico nella stessa stanza (si gestisce un incontro alla volta con la coda).
- Tabelle avanzate "Nemici diabolici" e modalità cooperativa/competitiva.
- Le uscite delle tessere non sono codificate: il giocatore le fa combaciare a mano.

## Fedeltà al manuale

I dati in `data/rules/` riportano le tabelle del manuale: in caso di dubbio **fa fede il libro**.
Segnala le differenze aprendo una issue.
