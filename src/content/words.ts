import type { Level } from '@/engine/types';

/** Picture for every word used in picture-based activities. Only widely supported emoji. */
export const PICTURES: Record<string, string> = {
  // animals
  cat: '🐱', dog: '🐶', pig: '🐷', fox: '🦊', bug: '🐛', bat: '🦇', ant: '🐜', owl: '🦉',
  frog: '🐸', fish: '🐟', duck: '🦆', crab: '🦀', bear: '🐻', lion: '🦁', goat: '🐐',
  snake: '🐍', horse: '🐴', mouse: '🐭', sheep: '🐑', tiger: '🐯', zebra: '🦓', panda: '🐼',
  rabbit: '🐰', monkey: '🐵', turtle: '🐢', bird: '🐦', bee: '🐝', snail: '🐌', rat: '🐀',
  elephant: '🐘', butterfly: '🦋', dinosaur: '🦕', kangaroo: '🦘', octopus: '🐙',
  alligator: '🐊', caterpillar: '🐛', whale: '🐳',
  // food
  egg: '🥚', cake: '🎂', milk: '🥛', apple: '🍎', pizza: '🍕', bread: '🍞', lemon: '🍋',
  melon: '🍈', carrot: '🥕', cookie: '🍪', banana: '🍌', tomato: '🍅', potato: '🥔',
  broccoli: '🥦', hamburger: '🍔', spaghetti: '🍝', strawberry: '🍓', pineapple: '🍍',
  watermelon: '🍉', avocado: '🥑', pear: '🍐', chip: '🍟',
  // things
  sun: '☀️', hat: '🎩', bed: '🛏️', bus: '🚌', box: '📦', map: '🗺️', pen: '🖊️', web: '🕸️',
  net: '🥅', ship: '🚢', star: '⭐', drum: '🥁', bell: '🔔', tent: '⛺', hand: '✋', flag: '🚩',
  moon: '🌙', ring: '💍', sock: '🧦', coat: '🧥', boat: '⛵', tree: '🌳', book: '📖', door: '🚪',
  rain: '🌧️', train: '🚆', cloud: '☁️', house: '🏠', robot: '🤖', plant: '🌱', clock: '🕰️',
  smile: '😊', shell: '🐚', spoon: '🥄', crown: '👑', heart: '❤️', ball: '⚽', car: '🚗',
  pencil: '✏️', rainbow: '🌈', rocket: '🚀', flower: '🌸', computer: '💻', umbrella: '☂️',
  helicopter: '🚁', motorcycle: '🏍️', television: '📺', key: '🔑', lip: '👄', man: '👨',
  van: '🚐', pan: '🍳', can: '🥫', king: '👑', lock: '🔒', lake: '🏞️', mail: '📬', nail: '💅',
  light: '💡', night: '🌃', chain: '⛓️', mug: '☕', hair: '💇', guitar: '🎸', balloon: '🎈',
  sled: '🛷', dish: '🍽️', wish: '🌠', three: '3️⃣', sing: '🎤', run: '🏃', fog: '🌫️',
};

export function pictureFor(word: string): string {
  return PICTURES[word.toLowerCase()] ?? '';
}

/** Sight words by level (adapted from common Dolch lists). */
export const SIGHT_WORDS: Record<Level, string[]> = {
  1: [
    'a', 'and', 'away', 'big', 'blue', 'can', 'come', 'down', 'find', 'for', 'funny', 'go',
    'help', 'here', 'in', 'is', 'it', 'jump', 'little', 'look', 'make', 'me', 'my', 'not',
    'one', 'play', 'red', 'run', 'said', 'see', 'the', 'three', 'to', 'two', 'up', 'we',
    'where', 'yellow', 'you',
  ],
  2: [
    'all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came', 'did', 'do',
    'eat', 'four', 'get', 'good', 'have', 'he', 'into', 'like', 'must', 'new', 'no', 'now',
    'on', 'our', 'out', 'please', 'pretty', 'ran', 'ride', 'saw', 'say', 'she', 'so', 'soon',
    'that', 'there', 'they', 'this', 'too', 'under', 'want', 'was', 'well', 'went', 'what',
    'white', 'who', 'will', 'with', 'yes',
  ],
  3: [
    'after', 'again', 'any', 'ask', 'by', 'could', 'every', 'fly', 'from', 'give', 'going',
    'had', 'has', 'her', 'him', 'his', 'how', 'just', 'know', 'let', 'live', 'may', 'of',
    'old', 'once', 'open', 'over', 'put', 'round', 'some', 'stop', 'take', 'thank', 'them',
    'then', 'think', 'walk', 'were', 'when', 'always', 'around', 'because', 'been', 'before',
    'both', 'does', 'first', 'found', 'goes', 'many', 'pull', 'their', 'these', 'those',
    'very', 'which', 'would', 'write', 'your',
  ],
};

/** Words to build from tiles, by level (all have pictures). */
export const SPELLING_WORDS: Record<Level, string[]> = {
  1: ['cat', 'dog', 'sun', 'pig', 'bus', 'hat', 'bed', 'fox', 'map', 'box', 'bug', 'pen', 'web', 'egg', 'ant', 'bat', 'net', 'owl'],
  2: ['frog', 'ship', 'fish', 'duck', 'crab', 'star', 'drum', 'milk', 'bell', 'tent', 'hand', 'flag', 'moon', 'ring', 'sock', 'cake', 'bear', 'lion', 'coat', 'boat', 'goat', 'tree', 'book', 'door'],
  3: ['snake', 'train', 'cloud', 'apple', 'house', 'horse', 'mouse', 'sheep', 'pizza', 'tiger', 'robot', 'bread', 'plant', 'clock', 'smile', 'zebra', 'panda', 'shell', 'lemon', 'melon', 'spoon', 'crown', 'heart'],
};

/** Words to read aloud, by level (all have pictures). */
export const SPEAKING_WORDS: Record<Level, string[]> = {
  1: ['cat', 'dog', 'sun', 'pig', 'hat', 'bed', 'bus', 'fox', 'box', 'bug', 'pen', 'map', 'net', 'egg'],
  2: ['frog', 'ship', 'fish', 'duck', 'crab', 'star', 'drum', 'milk', 'tent', 'hand', 'flag', 'clock', 'train', 'snake'],
  3: ['rainbow', 'tiger', 'apple', 'rabbit', 'pencil', 'monkey', 'turtle', 'robot', 'rocket', 'pizza', 'banana', 'butterfly', 'flower', 'elephant'],
};

/**
 * Words speech recognisers commonly return instead of a target word. A child saying
 * the target correctly should not be marked wrong because of the recogniser.
 */
export const SPEECH_ALTERNATES: Record<string, string[]> = {
  sun: ['son'],
  pen: ['pin'],
  bug: ['bugs'],
  box: ['bucks', 'blocks'],
  fox: ['fax'],
  net: ['knit'],
  egg: ['eggs', 'ag'],
  map: ['mop'],
  bus: ['boss'],
  milk: ['melk'],
  hand: ['and'],
  star: ['stars'],
  tent: ['ten', 'tint'],
  flag: ['flagg'],
  crab: ['crabs'],
  duck: ['dock'],
  ship: ['sheep', 'chip'],
  fish: ['fesh'],
  drum: ['drums', 'from'],
  frog: ['frogs'],
  clock: ['clocks', 'glock'],
  train: ['trains'],
  snake: ['snakes'],
};
