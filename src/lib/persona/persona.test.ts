import { beforeEach, describe, expect, it } from 'vitest';
import { generatePersona, getStoredNickname, setStoredNickname } from './persona';

describe('Persona Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a persona with emoji, name, and valid hex color', () => {
    const persona = generatePersona();
    expect(persona.name).toMatch(/^.+ [A-Z][a-z]+$/);
    expect(persona.emoji).toBeTruthy();
    expect(persona.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('persists and retrieves custom nickname in localStorage', () => {
    expect(getStoredNickname()).toBeNull();

    setStoredNickname('Alice');
    expect(getStoredNickname()).toBe('Alice');

    setStoredNickname('  Bob  ');
    expect(getStoredNickname()).toBe('Bob');

    setStoredNickname('');
    expect(getStoredNickname()).toBeNull();
  });

  it('generates persona respecting stored nickname if present', () => {
    setStoredNickname('Custom Captain');
    const persona = generatePersona();
    expect(persona.name).toBe('Custom Captain');
    expect(persona.emoji).toBeTruthy();
    expect(persona.color).toBeTruthy();
  });
});
