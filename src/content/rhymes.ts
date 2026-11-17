/** Groups of picture words that rhyme. Every word must have an entry in PICTURES. */
export const RHYME_FAMILIES: string[][] = [
  ['cat', 'hat', 'bat', 'rat'],
  ['dog', 'frog', 'fog'],
  ['man', 'van', 'pan', 'can'],
  ['ship', 'lip', 'chip'],
  ['sun', 'run'],
  ['bee', 'tree', 'three'],
  ['ring', 'king', 'sing'],
  ['sock', 'clock', 'lock'],
  ['cake', 'snake', 'lake'],
  ['box', 'fox'],
  ['snail', 'mail', 'nail'],
  ['light', 'night'],
  ['rain', 'train', 'chain'],
  ['boat', 'goat', 'coat'],
  ['bug', 'mug'],
  ['bear', 'pear', 'hair'],
  ['bell', 'shell'],
  ['car', 'star', 'guitar'],
  ['house', 'mouse'],
  ['moon', 'spoon', 'balloon'],
  ['bed', 'sled'],
  ['fish', 'dish', 'wish'],
];

export function rhymeFamilyOf(word: string): string[] | undefined {
  return RHYME_FAMILIES.find((family) => family.includes(word));
}

export function rhymesWith(a: string, b: string): boolean {
  return a !== b && (rhymeFamilyOf(a)?.includes(b) ?? false);
}
