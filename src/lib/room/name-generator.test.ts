import { describe, expect, it } from 'vitest';
import { generateRoomName, sanitizeRoomName } from './name-generator';

describe('Room Name Generator', () => {
  it('generates an adjective-noun pair separated by a hyphen', () => {
    const name = generateRoomName();
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('generates non-empty names across multiple invocations', () => {
    const names = new Set(Array.from({ length: 20 }, () => generateRoomName()));
    expect(names.size).toBeGreaterThan(1);
  });

  it('sanitizes user-entered room names into clean slug format', () => {
    expect(sanitizeRoomName('Cute Dog!')).toBe('cute-dog');
    expect(sanitizeRoomName('  swift_panda  ')).toBe('swift-panda');
    expect(sanitizeRoomName('room#123/test')).toBe('room-123-test');
    expect(sanitizeRoomName('---double--hyphen---')).toBe('double-hyphen');
  });
});
