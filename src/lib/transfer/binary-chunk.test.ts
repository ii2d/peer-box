import { describe, expect, it } from 'vitest';
import { uint8ArrayToBase64 } from './base64';
import { packChunk, unpackChunk } from './binary-chunk';

describe('binary-chunk pack and unpack', () => {
  it('correctly packs and unpacks raw binary chunks with zero-copy data views', () => {
    const rawData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const transferId = 'transfer_abc_123';
    const chunkIndex = 42;

    const packet = packChunk(transferId, chunkIndex, rawData);
    expect(packet instanceof Uint8Array).toBe(true);

    const unpacked = unpackChunk(packet);
    expect(unpacked.transferId).toBe(transferId);
    expect(unpacked.chunkIndex).toBe(chunkIndex);
    expect(unpacked.data).toEqual(rawData);
  });

  it('unpacks legacy JSON / base64 chunk objects for backwards compatibility', () => {
    const rawData = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = uint8ArrayToBase64(rawData);
    const legacy = {
      transferId: 'legacy_trans_999',
      chunkIndex: 7,
      data: b64,
    };

    const unpacked = unpackChunk(legacy);
    expect(unpacked.transferId).toBe('legacy_trans_999');
    expect(unpacked.chunkIndex).toBe(7);
    expect(unpacked.data).toEqual(rawData);
  });
});
