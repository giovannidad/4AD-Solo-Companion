// Nomi evocativi per i dungeon.
const LUOGHI = ['Le Cripte', 'I Sotterranei', 'Le Catacombe', 'La Fortezza Sepolta', 'Il Labirinto', 'Le Caverne', 'La Torre Crollata', 'L’Abisso', 'Il Santuario Profanato', 'Le Gallerie', 'La Necropoli', 'Le Miniere Maledette', 'Il Tempio Sommerso', 'La Tomba', 'Il Covo', 'Le Segrete', 'L’Ossario', 'Le Profondità'];
const DI = ['del Re Dimenticato', 'delle Ombre Sussurranti', 'della Luna Nera', 'del Sangue Antico', 'dei Mille Lamenti', 'del Silenzio Rosso', 'dell’Ultimo Stregone', 'della Fiamma Spenta', 'dei Corvi Mutilati', 'dell’Eclissi', 'di Cenere e Ossa', 'del Verme Eterno', 'del Cuore di Pietra', 'delle Anime Perdute', 'del Drago Dormiente', 'della Regina Pallida', 'dei Sette Sigilli', 'del Gelo Eterno', 'della Notte Senza Stelle', 'del Dio Strangolato', 'delle Campane Spezzate', 'del Cavaliere Senza Volto'];
const pick = a => a[Math.floor(Math.random() * a.length)];
export function nomeDungeon(escludi = '') {
  let n; do { n = `${pick(LUOGHI)} ${pick(DI)}`; } while (n === escludi);
  return n;
}
