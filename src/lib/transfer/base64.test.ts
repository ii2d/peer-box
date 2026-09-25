import { describe, expect, it } from 'vitest';
import { base64ToUint8Array, uint8ArrayToBase64 } from './base64';

describe('base64 helpers', () => {
  it('converts Uint8Array to base64 and back losslessly', () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 65, 66, 67]);
    const b64 = uint8ArrayToBase64(original);
    const roundtripped = base64ToUint8Array(b64);
    expect(roundtripped).toEqual(original);
  });

  it('handles empty byte array', () => {
    const empty = new Uint8Array(0);
    const b64 = uint8ArrayToBase64(empty);
    expect(b64).toBe('');
    expect(base64ToUint8Array(b64)).toEqual(empty);
  });
});
