export interface Persona {
  name: string;
  emoji: string;
  color: string;
}

const EMOJIS = ['⚡', '🎨', '🚀', '🌟', '🦊', '🐼', '🐬', '🦉', '🦁', '🌿', '💎', '🔥'];

const ADJECTIVES = [
  'Bold',
  'Calm',
  'Cosmic',
  'Cool',
  'Eager',
  'Gentle',
  'Happy',
  'Jolly',
  'Lucky',
  'Noble',
  'Proud',
  'Quick',
  'Sharp',
  'Silent',
  'Sunny',
  'Swift',
  'Warm',
  'Wise',
];

const ANIMALS = [
  'Badger',
  'Bear',
  'Beaver',
  'Comet',
  'Deer',
  'Dolphin',
  'Eagle',
  'Falcon',
  'Fox',
  'Koala',
  'Lynx',
  'Otter',
  'Panda',
  'Puma',
  'Robin',
  'Tiger',
  'Wolf',
];

const COLORS = [
  '#818cf8', // Indigo
  '#34d399', // Emerald
  '#f472b6', // Pink
  '#fbbf24', // Amber
  '#60a5fa', // Blue
  '#a78bfa', // Purple
  '#38bdf8', // Sky
  '#f87171', // Red
  '#4ade80', // Green
  '#fb923c', // Orange
];

const NICKNAME_STORAGE_KEY = 'peerbox_persona_nickname';

export function getStoredNickname(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const val = localStorage.getItem(NICKNAME_STORAGE_KEY)?.trim();
  return val || null;
}

export function setStoredNickname(nickname: string): void {
  if (typeof localStorage === 'undefined') return;
  const clean = nickname.trim();
  if (clean) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, clean);
  } else {
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
  }
}

export function generatePersona(): Persona {
  const storedName = getStoredNickname();
  const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  if (storedName) {
    return {
      name: storedName,
      emoji,
      color,
    };
  }

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

  return {
    name: `${adj} ${animal}`,
    emoji,
    color,
  };
}
