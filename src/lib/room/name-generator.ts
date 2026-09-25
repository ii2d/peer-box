const ADJECTIVES = [
  'bold',
  'calm',
  'cool',
  'cosmic',
  'cute',
  'eager',
  'gentle',
  'happy',
  'jolly',
  'kind',
  'lively',
  'lucky',
  'neat',
  'noble',
  'proud',
  'quick',
  'sharp',
  'silent',
  'sunny',
  'swift',
  'warm',
  'wild',
  'wise',
  'zen',
];

const NOUNS = [
  'badger',
  'bear',
  'beaver',
  'breeze',
  'comet',
  'deer',
  'dog',
  'dolphin',
  'eagle',
  'falcon',
  'fox',
  'glider',
  'harbor',
  'hawk',
  'island',
  'koala',
  'lynx',
  'otter',
  'panda',
  'puma',
  'river',
  'robin',
  'tiger',
  'wolf',
];

export function generateRoomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}

export function sanitizeRoomName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
