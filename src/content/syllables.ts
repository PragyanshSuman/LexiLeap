/** Picture words with their syllable ("beat") count. Every word must have an entry in PICTURES. */
export const SYLLABLE_WORDS: { word: string; beats: number }[] = [
  ...['cat', 'dog', 'sun', 'fish', 'tree', 'ball', 'car', 'bird', 'frog', 'house'].map((word) => ({ word, beats: 1 })),
  ...[
    'apple', 'rabbit', 'pencil', 'monkey', 'tiger', 'rainbow', 'pizza', 'carrot', 'robot',
    'rocket', 'turtle', 'cookie', 'zebra', 'panda', 'lemon',
  ].map((word) => ({ word, beats: 2 })),
  ...[
    'banana', 'elephant', 'butterfly', 'dinosaur', 'tomato', 'computer', 'umbrella', 'kangaroo',
    'octopus', 'potato', 'broccoli', 'hamburger', 'spaghetti', 'strawberry', 'pineapple',
  ].map((word) => ({ word, beats: 3 })),
  ...['watermelon', 'caterpillar', 'alligator', 'helicopter', 'avocado', 'motorcycle', 'television'].map((word) => ({
    word,
    beats: 4,
  })),
];

/** Words split into beats, so the answer can be shown and spoken beat by beat. */
export const SYLLABLE_SPLITS: Record<string, string[]> = {
  apple: ['ap', 'ple'], rabbit: ['rab', 'bit'], pencil: ['pen', 'cil'], monkey: ['mon', 'key'],
  tiger: ['ti', 'ger'], rainbow: ['rain', 'bow'], pizza: ['piz', 'za'], carrot: ['car', 'rot'],
  robot: ['ro', 'bot'], rocket: ['rock', 'et'], turtle: ['tur', 'tle'], cookie: ['cook', 'ie'],
  zebra: ['ze', 'bra'], panda: ['pan', 'da'], lemon: ['lem', 'on'],
  banana: ['ba', 'na', 'na'], elephant: ['el', 'e', 'phant'], butterfly: ['but', 'ter', 'fly'],
  dinosaur: ['di', 'no', 'saur'], tomato: ['to', 'ma', 'to'], computer: ['com', 'pu', 'ter'],
  umbrella: ['um', 'brel', 'la'], kangaroo: ['kan', 'ga', 'roo'], octopus: ['oc', 'to', 'pus'],
  potato: ['po', 'ta', 'to'], broccoli: ['broc', 'co', 'li'], hamburger: ['ham', 'bur', 'ger'],
  spaghetti: ['spa', 'ghet', 'ti'], strawberry: ['straw', 'ber', 'ry'], pineapple: ['pine', 'ap', 'ple'],
  watermelon: ['wa', 'ter', 'mel', 'on'], caterpillar: ['cat', 'er', 'pil', 'lar'],
  alligator: ['al', 'li', 'ga', 'tor'], helicopter: ['hel', 'i', 'cop', 'ter'],
  avocado: ['av', 'o', 'ca', 'do'], motorcycle: ['mo', 'tor', 'cy', 'cle'],
  television: ['tel', 'e', 'vi', 'sion'],
};

export function beatsOf(word: string): string[] {
  return SYLLABLE_SPLITS[word] ?? [word];
}
