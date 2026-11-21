# Mostri delle tabelle utilizzabili nei moduli

File generato da `tools/elenco-mostri.js`: non modificarlo a mano. Per ogni set (campo `set` del modulo) sono elencate le voci che si possono richiamare con
`{"tipo": "mostri", "tabella": "…", "id": "…"}`. Le voci del manuale base («base») valgono sempre, anche negli altri set. «LIV» e «PV» sono quelli stampati
nella tabella; per le voci con formule (livello del gruppo, grado) il gioco calcola i valori al momento della creazione.

## Four Against Darkness (livelli 1-2)

`"set": "base"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `ratti` | Ratti | 1 | 1 | 3d6 |
| `pipistrelli` | Pipistrelli vampiro | 1 | 1 | 3d6 |
| `goblin-sciamanti` | Goblin sciamanti | 3 | 1 | 2d6 |
| `millepiedi` | Millepiedi giganti | 3 | 1 | 1d6 |
| `rane` | Rane vampiro | 4 | 1 | 1d6 |
| `ratti-scheletrici` | Ratti scheletrici | 3 | 1 | 2d6 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `scheletri-zombi` | Scheletri o zombi | 3 | 1 | (scelta interna: non utilizzabile, usa un mostro personalizzato) |
| `goblin` | Goblin | 3 | 1 | 1d6+3 |
| `hobgoblin` | Hobgoblin | 4 | 1 | 1d6 |
| `orchi` | Orchi | 4 | 1 | 1d6+1 |
| `troll` | Troll | 5 | 1 | 1d3 |
| `fungoidi` | Fungoidi | 3 | 1 | 2d6 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `minotauro` | Minotauro | 5 | 4 | 1 |
| `ferrofago` | Ferrofago | 3 | 4 | 1 |
| `chimera` | Chimera | 5 | 6 | 1 |
| `catoblepa` | Catoblepa | 4 | 4 | 1 |
| `ragno` | Ragno gigante | 5 | 3 | 1 |
| `gremlin` | Gremlin invisibili | 0 | 0 | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `mummia` | Mummia | 5 | 4 | 1 |
| `orco-bruto` | Orco bruto | 5 | 5 | 1 |
| `ogre` | Ogre | 5 | 6 | 1 |
| `medusa` | Medusa | 4 | 4 | 1 |
| `signore-caos` | Signore del caos | 6 | 4 | 1 |
| `piccolo-drago` | Piccolo drago | 6 | 5 | 1 |

## Nemici diabolici (livelli 3-5)

`"set": "diabolici"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `d-ragni` | Ragni | 3 | 1 | 3d6+3 |
| `d-uccelli` | Uccelli stigei | 4 | 1 | 2d6+2 |
| `d-serpenti` | Serpenti giganti | 5 | 1 | 1d6+4 |
| `d-rospi` | Rospi giganti | 5 | 1 | 1d6+4 |
| `d-scheletri-corazzati` | Scheletri corazzati | 5 | 1 | 2d3+4 |
| `d-uomini-capra` | Uomini capra | 6 | 1 | 2d3+1 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `d-orchi` | Orchi saccheggiatori | 5 | 1 | 1d6+6 |
| `d-coccatrici` | Coccatrici | 5 | 1 | 1d3+4 |
| `d-nani-posseduti` | Nani posseduti | 5 | 1 | 1d6+3 |
| `d-gnoll` | Gnoll | 6 | 1 | 2d3+4 |
| `d-maestri-hobgoblin` | Maestri di spada hobgoblin | 6 | 1 | 2d3+2 |
| `d-schiavisti` | Schiavisti del caos | 7 | 1 | 2d3+2 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `d-doppelganger` | Doppelganger | 5 | 5 | 1 |
| `d-manto` | Manto predatore | 6 | 5 | 1 |
| `d-melma` | Melma verde | 6 | 8 | 1 |
| `d-cubo` | Cubo gelatinoso | 6 | 6 | 1 |
| `d-golem` | Golem di carne | 7 | 8 | 1 |
| `d-scimitarra` | Mostro scimitarra | 8 | 12 | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `d-signore-caos` | Signore oscuro del caos | 6 | 7 | 1 |
| `d-demone` | Demone scheletrico | 7 | 8 | 1 |
| `d-capo-hobgoblin` | Capo hobgoblin | 7 | 8 | 1 |
| `d-spettro` | Spettro | 7 | 6 | 1 |
| `d-troll` | Grosso troll | 8 | 7 | 1 |
| `d-drago` | Giovane drago rosso | 9 | 8 | 1 |

## Contro il Caos (livelli 3-6)

`"set": "caos"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `c-accoliti` | Accoliti del caos | 2 | 1 | 2d6 |
| `c-ratti` | Ratti mutanti | 3 | 1 | 1d8 |
| `c-serpenti` | Uomini serpente guerrieri di Ssiklis | 4 | 1 | 1d6+1 |
| `c-capra` | Uomini capra del caos | 6 | 1 | 1d6+3 |
| `c-vespe` | Sciame di vespe del caos | 6 | 1 | 1 |
| `c-gremlin` | Gremlin del caos | 5 | 1 | 1d6+3 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `c-goblin` | Goblin del caos | 5 | 1 | 4d6 |
| `c-bestie` | Bestie del caos | 4 | 1 | 2d6 |
| `c-nani` | Nani del caos | 7 | 1 | 1d6 |
| `c-scheletri` | Scheletri del caos | 9 | 1 | 1d6 |
| `c-ratti-uomini` | Uomini ratto del caos + leader | 3 | 1 | 2d6 |
| `c-fanatici` | Fanatici del caos | 5 | 1 | 1d6+3 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `c-liquame` | Liquame nero | 3 | 12 | 1 |
| `c-manticora` | Manticora nera | 5 | 5 | 1 |
| `c-melma-grigia` | Melma grigia | 5 | 6 | 1 |
| `c-progenie` | Progenie di Xichtul | 6 | 6 | 1 |
| `c-dinosauro` | Dinosauro di Ssiklis | 5 | 8 | 1 |
| `c-chimera` | Chimera del caos | 5 | 5 | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `c-campione` | Campione del caos | 4 | 9 | 1 |
| `c-psionico` | Psionico del caos | 6 | 5 | 1 |
| `c-tentacolato` | Mutante tentacolato | 6 | 7 | 1 |
| `c-lucertola` | Uomo lucertola del caos | 4 | 8 | 1 |
| `c-carnefice` | Carnefice del caos | 5 | 8 | 1 |
| `c-avatar` | Avatar di Xichtul | 6 | 12 | 1 |

## Acque Oscure (livelli 1-4)

`"set": "acque"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `q-anguille-elettriche` | Anguille elettriche | 3 | 1 | 1d6+3 |
| `q-meduse-urticanti` | Meduse urticanti | 3 | 1 | 1d6+2 |
| `q-granchi-giganti` | Granchi giganti | 4 | 1 | 1d6 |
| `q-piovre-giganti` | Piovre giganti | 4 | 1 | 1d3 |
| `q-pesci-carnivori` | Pesci carnivori | 1 | 1 | 3d6 |
| `q-spiritelli-di-mare` | Spiritelli di mare | 3 | 1 | 1d6+1 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `q-demoni-abissali` | Demoni abissali | 4 | 1 | 1d6+3 |
| `q-uomini-pesce` | Uomini pesce | 3 | 1 | 2d6 |
| `q-sirene` | Sirene | 3 | 1 | 1d3 |
| `q-squali-di-barriera` | Squali di barriera | 4 | 1 | 1d3 |
| `q-barracuda` | Barracuda | 3 | 1 | 2d6 |
| `q-zombi-annegati` | Zombi annegati | 4 | 1 | 2d6 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `q-golem-di-corallo` | Golem di corallo | 5 | 5 | 1 |
| `q-melma-abissale` | Melma abissale | 5 | 8 | 1 |
| `q-leone-marino` | Leone marino | 4 | 4 | 1 |
| `q-cecaelia` | Cecaelia | 4 | 4 | 1 |
| `q-dragone-tartaruga` | Dragone tartaruga | 6 | 5 | 1 |
| `q-idra-di-mare` | Idra di mare | 5 | 5 | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `q-megera-marina` | Megera marina | 4 | 4 | 1 |
| `q-serpente-marino` | Serpente marino | 5 | 5 | 1 |
| `q-signore-demoni-abissali` | Signore dei demoni abissali | 6 | 4 | 1 |
| `q-demone-abissale-stregone` | Demone abissale stregone | 4 | 4 | 1 |
| `q-grande-squalo` | Grande squalo | 5 | 6 | 1 |
| `q-kraken` | Kraken | 6 | 5 | 1 |

## Schiavisti Coboldi (livelli 1-2)

`"set": "coboldi"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `k-ratti` | Ratti | 1 | 1 | 2d6 |
| `k-coboldi-scheletri` | Coboldi scheletri | 3 | 1 | 1d6 |
| `k-coboldi` | Coboldi | 3 | 1 | 2d6+1 |
| `k-millepiedi-giganti` | Millepiedi giganti | 3 | 1 | 1d6+1 |
| `k-mastini-coboldi` | Mastini da guardia dei coboldi | 4 | 1 | 1d6 |
| `k-rapaci-sanguinari` | Rapaci sanguinari | 3 | 1 | 2d6+2 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `k-pipistrelli-vampiro` | Pipistrelli vampiro | 1 | 1 | 4d6 |
| `k-scheletri-o-zombi` | Scheletri o zombi | 3 | 1 | (scelta interna: non utilizzabile, usa un mostro personalizzato) |
| `k-adoratori-demoni` | Adoratori dei demoni | 3 | 1 | 1d6+3 |
| `k-coboldi-demoniaci` | Coboldi demoniaci | 3 | 1 | 1d6+3 |
| `k-demoni-minori` | Demoni minori | 5 | 1 | 1d3 |
| `k-guerrieri-caos` | Guerrieri del caos | 4 | 1 | 1d6+2 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `k-lupo-mannaro-demoniaco` | Lupo mannaro demoniaco | 5 | 5 | 1 |
| `k-fanghiglia-amorfa` | Fanghiglia amorfa | 5 | 8 | 1 |
| `k-orco-demoniaco` | Orco demoniaco | 5 | 4 | 1 |
| `k-wight` | Wight | 4 | 4 | 1 |
| `k-signore-supremo-caos` | Signore supremo del caos | 6 | 6 | 1 |
| `k-demone-maggiore` | Demone maggiore | 6 | 10 | 1 |

## Contro l'Abisso (livelli 5-9)

`"set": "abisso"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `a-orchi-neri` | Orchi neri banditi | 6 | 1 | 2d6 |
| `a-funghi-stridenti` | Funghi stridenti | 6 | 1 | 1d6+2 |
| `a-ssiklis` | Campioni di Ssiklis, uomini serpente guerrieri | 8 | 1 | 2d6 |
| `a-uomini-formica` | Uomini formica guerrieri | 7 | 1 | 1d6+3 |
| `a-coboldi-ghoul` | Coboldi ghoul | 7 | 1 | 1d6+1 |
| `a-brounie` | Brounie | 8 | 1 | 1d6+3 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `a-goblin-irsuti` | Goblin irsuti | 6 | 1 | 4d6 |
| `a-ghoul` | Ghoul | 8 | 1 | 2d6+1 |
| `a-nani-oscuri` | Nani oscuri | 8 | 1 | 2d6-1 |
| `a-teschi-volanti` | Teschi volanti | 9 | 1 | 1d6 |
| `a-uomini-ratto` | Uomini ratto del caos + leader | 7 | 1 | 2d6 |
| `a-fanatici` | Fanatici del caos | 7 | 1 | 1d6+4 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `a-minotauro-zombie` | Minotauro zombie | 6 | 10 | 1 |
| `a-serpente-costrittore` | Serpente gigante costrittore | 7 | 6 | 1 |
| `a-vampiro-minore` | Vampiro minore | 8 | 6 | 1 |
| `a-lupo-mannaro` | Lupo mannaro | 8 | 8 | 1 |
| `a-pantera-distorcente` | Pantera distorcente | 7 | 5 | 1 |
| `a-lich` | Lich | 10 | 8 | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `a-draconico` | Draconico | 9 | 8 | 1 |
| `a-urlatore-mentale` | Urlatore mentale | 10 | 9 | 1 |
| `a-cervello-tentacolato` | Cervello tentacolato | 9 | 8 | 1 |
| `a-re-ghoul` | Re dei ghoul | 10 | 10 | 1 |
| `a-signore-oscuro` | Signore oscuro di Xichtul | 11 | 12 | 1 |
| `a-vampiro-maggiore` | Vampiro maggiore | 10 | 11 | 1 |

**Tabella `draghi`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `a-drago-viola` | Drago viola | 10 | 8 | 1 |
| `a-drago-miraggi` | Drago dei miraggi | 9 | 7 | 1 |
| `a-fortundrago` | Fortundrago | 9 | 10 | 1 |
| `a-drago-ghoul` | Drago ghoul | 10 | 8 | 1 |
| `a-drago-oscuro` | Drago oscuro | 10 | 12 | 1 |
| `a-drago-caos` | Giovane drago del caos | 11 | 10 | 1 |

## Orrori dall'Aldilà (livelli 6-9)

`"set": "aldila"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-occhi-littore` | Occhi del littore | 7 | 1 | 1d6 |
| `o-bestie-scheletriche` | Bestie scheletriche | 6 | 1 | 2d6 |
| `o-anime-lacerate` | Anime lacerate | 7 | 1 | 2d6 |
| `o-spettri-fetidi` | Spettri fetidi | 5 | 1 | 2d6 |
| `o-vermi-rigonfi` | Vermi rigonfi | 2 | 1 | 3d6 |
| `o-poligono-gelatinoso` | Poligono gelatinoso | 4 | 8 | 1 |

**Tabella `nonMorti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-orda-infinita` | Orda infinita | 5 | 1 | 2d6 |
| `o-abitanti-cimiteri` | Abitanti dei cimiteri | 5 | 1 | 1d6+6 |
| `o-scheletri-zombi` | Scheletri o zombi | 6 | 1 | (scelta interna: non utilizzabile, usa un mostro personalizzato) |
| `o-mummie-minori` | Mummie minori | 8 | 1 | 1d6+2 |
| `o-pallidi` | I pallidi | 7 | 1 | 2d6 |

**Tabella `umanoidi`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-nani-indemoniati` | Nani indemoniati | 9 | 1 | 1d8+5 |
| `o-cambioni` | Cambioni | 8 | 1 | 1d6+3 |
| `o-uomini-salamandra` | Uomini salamandra (Iracondi) | 7 | 1 | 2d6+3 |

**Tabella `demoniaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-orrori-risvegliati` | Orrori risvegliati | formula | 1 | 1d3+1 |
| `o-pire-destino` | Pire del destino | 7 | 1 | 1d6+1 |
| `o-demoni-campanari` | Demoni campanari | 9 | 1 | 1d3+2 |
| `o-mefitici-garruli` | Mefitici garruli | 10 | 1 | 1d3 |
| `o-demoni-disperazione` | Demoni della disperazione | 8 | 1 | 1d6+2 |
| `o-uomini-verme` | Uomini verme | 9 | 1 | 1d3+2 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-assetati-null` | Assetati di Null | 7 | 1 | 1d3 |
| `o-divoratore-tempo` | Divoratore del tempo | 9 | 9 | 1 |
| `o-cervello-psionico` | Cervello psionico esplosivo | formula | formula | 1 |
| `o-traghettatore-morte` | Traghettatore della morte | 8 | formula | 1 |
| `o-occhio-fiamma` | Occhio di fiamma terrificante | 11 | 4 | 1 |
| `o-oracolo-salamandra` | Oracolo salamandra | 10 | formula | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `o-littore` | Littore | 9 | 9 | 1 |
| `o-morfico-sepolcri` | Morfico dei sepolcri | 10 | formula | 1 |
| `o-progenie-amorfa` | Progenie amorfa | 11 | formula | 1 |
| `o-saccheggiatore-tentacolato` | Saccheggiatore tentacolato | formula | formula | 1 |
| `o-avatar-dimenticato` | Avatar dimenticato | 12 |  | 1 |
| `o-blasfemo` | Blasfemo | formula | formula | 1 |

## Contro le Profondità Dimenticate (livelli 10-19)

`"set": "profondita"`

**Tabella `infestanti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-pipistrelli-ombra` | Pipistrelli-ombra delle profondità | formula | 1 | 3d6 |
| `p-ematovermi` | Ematovermi | formula | 1 | 2d6+2 |
| `p-sporagni` | Sporagni | formula | 1 | 1d6+3 |
| `p-litolumache` | Litolumache | formula | 1 | 2d6 |
| `p-piovre-terricole` | Piovre terricole minuscole | formula | 1 | 1d6+3 |
| `p-ragni-caverne` | Ragni delle caverne profonde | formula | 1 | 2d6+1 |

**Tabella `seguaci`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-troll-profondita` | Troll delle profondità | formula | 1 | 2d6+1 |
| `p-hobgoblin-profondita` | Hobgoblin delle profondità | formula | 1 | 2d6+2 |
| `p-accoliti-caos` | Accoliti del caos | formula | 1 | 1d6+3 |
| `p-balestrieri-elfi-oscuri` | Balestrieri elfi oscuri | formula | 1 | 1d6+4 |
| `p-uomini-lucertola-profondita` | Uomini lucertola delle profondità | formula | 1 | 2d6 |
| `p-goblin-profondita` | Goblin delle profondità | formula | 1 | 2d6+1 |

**Tabella `orde`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-orda-troll` | Orda di troll delle profondità | formula | formula | 1 |
| `p-orda-hobgoblin` | Orda di hobgoblin delle profondità | formula | formula | 1 |
| `p-orda-accoliti-caos` | Orda di accoliti del caos | formula | formula | 1 |
| `p-orda-balestrieri-elfi-oscuri` | Orda di balestrieri elfi oscuri | formula | 10 | 1 |
| `p-orda-uomini-lucertola` | Orda di uomini lucertola delle profondità | formula | formula | 1 |
| `p-orda-goblin` | Orda di goblin delle profondità | formula | formula | 1 |

**Tabella `aberranti`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-falena-bestiale` | Falena bestiale del caos | formula | formula | 1 |
| `p-leviatano-profondita` | Leviatano delle profondità | formula | formula | 1 |
| `p-uccello-agnas` | Uccello agnas | formula | formula | 1 |
| `p-verme-profondita` | Verme delle profondità | formula | formula | 1 |
| `p-pedinatore-profondita` | Pedinatore delle profondità | formula | formula | 1 |
| `p-fanghiglia-fungina` | Fanghiglia fungina delle profondità | formula | formula | 1 |

**Tabella `aberrantiCittadella`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-regina-falene` | Regina delle falene bestiali del caos | formula | formula | 1 |
| `p-leviatano-non-morto` | Leviatano delle profondità non-morto | formula | formula | 1 |
| `p-testadizucca` | Testadizucca delle profondità | formula | formula | 1 |
| `p-verme-colossale` | Verme colossale delle profondità | formula | formula | 1 |
| `p-pedinatore-selvaggio` | Pedinatore selvaggio delle profondità | formula | formula | 1 |
| `p-fanghiglia-gigante` | Fanghiglia fungina delle profondità gigante | formula | formula | 1 |

**Tabella `boss`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-troll-corazzato` | Troll corazzato delle profondità | formula | formula | 1 |
| `p-campione-hobgoblin` | Campione degli hobgoblin delle profondità | formula | 7 | 1 |
| `p-campione-uomini-leone` | Campione degli uomini leone del caos | formula | formula | 1 |
| `p-maestro-psionico` | Maestro psionico delle caverne | formula | 10 | 1 |
| `p-strega-elfa-oscura` | Strega elfa oscura | formula | 12 | 1 |
| `p-stregone-elfo-oscuro` | Stregone elfo oscuro | formula | 12 | 1 |

**Tabella `incontriFluviali`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-troll-fiume` | Troll di fiume | formula | 1 | 2d6+1 |
| `p-hobgoblin-zombi` | Hobgoblin zombi | formula | 1 | 2d6+6 |
| `p-cubo-caos` | Cubo del caos | formula | formula | 1 |
| `p-balestrieri-fiume` | Balestrieri elfi oscuri (fiume) | formula | 1 | 1d6+4 |
| `p-uomini-rana` | Uomini rana degli abissi | formula | 1 | 2d6 |
| `p-goblin-mutato-maggiore` | Goblin mutato maggiore | formula | formula | 1 |

**Tabella `creatureExtra`**

| id | nome | LIV | PV | numero |
|---|---|---|---|---|
| `p-idolo-che-cammina` | Idolo che cammina | formula | formula | 1 |
| `p-barcaiolo-umano` | Barcaiolo umano | 9 | formula | 1 |
| `p-traghettatore-scheletrico` | Traghettatore non-morto scheletrico | 9 | formula | 1 |
| `p-barcaiolo-automa` | Barcaiolo automa metallico | 9 | formula | 1 |
| `p-barcaiolo-elfo-oscuro` | Barcaiolo elfo oscuro | 9 | formula | 1 |
| `p-barcaiolo-hobgoblin` | Barcaiolo hobgoblin delle profondità | 9 | formula | 1 |
