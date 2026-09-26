import { describe, expect, it } from 'vitest';
import { APP_VERSION, getVersionUrl } from './version';

describe('version utilities', () => {
  it('defines APP_VERSION as a non-empty string', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it('generates release URL for exact release tag', () => {
    expect(getVersionUrl('v0.1.0')).toBe('https://github.com/ii2d/peer-box/releases/tag/v0.1.0');
  });

  it('generates commit URL for tagged commits with git distance', () => {
    expect(getVersionUrl('v0.1.0-4-g68d101b')).toBe(
      'https://github.com/ii2d/peer-box/commit/68d101b',
    );
    expect(getVersionUrl('v0.1.0-4-g68d101b-dirty')).toBe(
      'https://github.com/ii2d/peer-box/commit/68d101b',
    );
  });

  it('generates tree URL for standalone commit hash or branch', () => {
    expect(getVersionUrl('68d101b')).toBe('https://github.com/ii2d/peer-box/tree/68d101b');
    expect(getVersionUrl('68d101b-dirty')).toBe('https://github.com/ii2d/peer-box/tree/68d101b');
  });
});
