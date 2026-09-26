import { base64ToUint8Array } from './base64';

export function packChunk(transferId: string, chunkIndex: number, rawData: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(transferId);
  const headerLen = 4 + 1 + idBytes.byteLength;
  const packet = new Uint8Array(headerLen + rawData.byteLength);
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  view.setUint32(0, chunkIndex, false);
  packet[4] = idBytes.byteLength;
  packet.set(idBytes, 5);
  packet.set(rawData, headerLen);
  return packet;
}

export function unpackChunk(packetOrPayload: unknown): {
  transferId: string;
  chunkIndex: number;
  data: Uint8Array;
} {
  if (packetOrPayload instanceof Uint8Array) {
    const view = new DataView(
      packetOrPayload.buffer,
      packetOrPayload.byteOffset,
      packetOrPayload.byteLength,
    );
    const chunkIndex = view.getUint32(0, false);
    const idLen = packetOrPayload[4];
    const dec = new TextDecoder();
    const transferId = dec.decode(packetOrPayload.subarray(5, 5 + idLen));
    const data = packetOrPayload.subarray(5 + idLen);
    return { transferId, chunkIndex, data };
  }

  // Backwards compatibility with legacy JSON / base64 object
  const legacy = packetOrPayload as {
    transferId: string;
    chunkIndex: number;
    data: string | Uint8Array;
  };
  const data = typeof legacy.data === 'string' ? base64ToUint8Array(legacy.data) : legacy.data;
  return {
    transferId: legacy.transferId,
    chunkIndex: legacy.chunkIndex,
    data,
  };
}
