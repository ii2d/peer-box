import { describe, expect, it } from 'vitest';
import { buildRoomUrl, parseRoomLocation } from './url';

describe('Room URL Parser & Builder', () => {
  it('extracts roomId and roomKey from a standard clean path with hash key', () => {
    const parsed = parseRoomLocation({
      pathname: '/cute-dog',
      hash: '#key=secret123',
      search: '',
    });

    expect(parsed.roomId).toBe('cute-dog');
    expect(parsed.roomKey).toBe('secret123');
  });

  it('extracts roomId without key when no hash is present', () => {
    const parsed = parseRoomLocation({
      pathname: '/swift-panda',
      hash: '',
      search: '',
    });

    expect(parsed.roomId).toBe('swift-panda');
    expect(parsed.roomKey).toBeNull();
  });

  it('handles SPA 404 redirect fallback with ?p= parameter and preserves hash key', () => {
    const parsed = parseRoomLocation({
      pathname: '/',
      hash: '#key=shh',
      search: '?p=/cosmic-fox',
    });

    expect(parsed.roomId).toBe('cosmic-fox');
    expect(parsed.roomKey).toBe('shh');
  });

  it('returns null roomId for root landing page', () => {
    const parsed = parseRoomLocation({
      pathname: '/',
      hash: '',
      search: '',
    });

    expect(parsed.roomId).toBeNull();
    expect(parsed.roomKey).toBeNull();
  });

  it('builds full shareable room URL with hash key when includeKey is true', () => {
    const url = buildRoomUrl('cute-dog', {
      origin: 'https://peer-box.ii2d.com',
      roomKey: 'mypassword',
      includeKey: true,
    });

    expect(url).toBe('https://peer-box.ii2d.com/cute-dog#key=mypassword');
  });

  it('builds clean room URL without key when includeKey is false', () => {
    const url = buildRoomUrl('cute-dog', {
      origin: 'https://peer-box.ii2d.com',
      roomKey: 'mypassword',
      includeKey: false,
    });

    expect(url).toBe('https://peer-box.ii2d.com/cute-dog');
  });
});
