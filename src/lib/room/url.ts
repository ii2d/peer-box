import { sanitizeRoomName } from './name-generator';

export interface ParsedRoomLocation {
  roomId: string | null;
  roomKey: string | null;
}

export interface BuildRoomUrlOptions {
  roomKey?: string | null;
  includeKey?: boolean;
  origin?: string;
}

export function parseRoomLocation(loc: {
  pathname: string;
  hash: string;
  search: string;
}): ParsedRoomLocation {
  let targetPath = loc.pathname;

  // Handle SPA 404 redirect fallback (e.g. /?p=/cute-dog)
  if (loc.search) {
    const searchParams = new URLSearchParams(loc.search);
    const p = searchParams.get('p');
    if (p) {
      targetPath = p;
    }
  }

  // Remove leading and trailing slashes
  const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
  const roomId = cleanPath ? sanitizeRoomName(cleanPath) : null;

  // Parse hash (e.g. #key=secret or #/cute-dog#key=secret)
  let roomKey: string | null = null;
  if (loc.hash) {
    const rawHash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
    const hashParams = new URLSearchParams(rawHash);
    const key = hashParams.get('key');
    if (key) {
      roomKey = key;
    }
  }

  return {
    roomId: roomId || null,
    roomKey,
  };
}

export function buildRoomUrl(roomId: string, options: BuildRoomUrlOptions = {}): string {
  const origin = options.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanRoomId = sanitizeRoomName(roomId);
  const base = origin ? `${origin}/${cleanRoomId}` : `/${cleanRoomId}`;

  if (options.includeKey && options.roomKey) {
    const hashParams = new URLSearchParams();
    hashParams.set('key', options.roomKey);
    return `${base}#${hashParams.toString()}`;
  }

  return base;
}
