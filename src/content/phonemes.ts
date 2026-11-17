import type { Level } from '@/engine/types';

/**
 * Picture words split into their individual sounds, written as the letters that spell
 * each sound (graphemes). Used for "Sound Boxes" (Elkonin boxes): the child hears the
 * word, counts its sounds, then sees how each sound is spelled, e.g. sh · i · p.
 * Every word must have an entry in PICTURES.
 */
export const SOUND_WORDS: Record<Level, Record<string, string[]>> = {
  1: {
    bee: ['b', 'ee'],
    key: ['k', 'ey'],
    egg: ['e', 'gg'],
    cat: ['c', 'a', 't'],
    dog: ['d', 'o', 'g'],
    sun: ['s', 'u', 'n'],
    pig: ['p', 'i', 'g'],
    bus: ['b', 'u', 's'],
    hat: ['h', 'a', 't'],
    bed: ['b', 'e', 'd'],
    map: ['m', 'a', 'p'],
    pen: ['p', 'e', 'n'],
    net: ['n', 'e', 't'],
    web: ['w', 'e', 'b'],
    bug: ['b', 'u', 'g'],
  },
  2: {
    ship: ['sh', 'i', 'p'],
    fish: ['f', 'i', 'sh'],
    duck: ['d', 'u', 'ck'],
    sock: ['s', 'o', 'ck'],
    bell: ['b', 'e', 'll'],
    moon: ['m', 'oo', 'n'],
    book: ['b', 'oo', 'k'],
    sheep: ['sh', 'ee', 'p'],
    star: ['s', 't', 'ar'],
    frog: ['f', 'r', 'o', 'g'],
    crab: ['c', 'r', 'a', 'b'],
    drum: ['d', 'r', 'u', 'm'],
    flag: ['f', 'l', 'a', 'g'],
    hand: ['h', 'a', 'n', 'd'],
    tent: ['t', 'e', 'n', 't'],
    milk: ['m', 'i', 'l', 'k'],
  },
  3: {
    clock: ['c', 'l', 'o', 'ck'],
    bread: ['b', 'r', 'ea', 'd'],
    train: ['t', 'r', 'ai', 'n'],
    spoon: ['s', 'p', 'oo', 'n'],
    crown: ['c', 'r', 'ow', 'n'],
    tiger: ['t', 'i', 'g', 'er'],
    plant: ['p', 'l', 'a', 'n', 't'],
    robot: ['r', 'o', 'b', 'o', 't'],
    lemon: ['l', 'e', 'm', 'o', 'n'],
    melon: ['m', 'e', 'l', 'o', 'n'],
    panda: ['p', 'a', 'n', 'd', 'a'],
    zebra: ['z', 'e', 'b', 'r', 'a'],
    rocket: ['r', 'o', 'ck', 'e', 't'],
    carrot: ['c', 'a', 'rr', 'o', 't'],
  },
};

/** Inclusive range of sound counts per level. */
export const SOUND_COUNT_RANGE: Record<Level, [number, number]> = { 1: [2, 3], 2: [3, 4], 3: [4, 5] };
