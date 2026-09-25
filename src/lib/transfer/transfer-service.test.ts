import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport, resetInMemoryTransportRooms } from '../transport/in-memory-transport';
import { TransferService } from './transfer-service';

describe('TransferService', () => {
  beforeEach(() => {
    resetInMemoryTransportRooms();
  });

  it('chunks, transfers, and reassembles small files between peers', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'test-room' });
    await transport2.joinRoom({ roomId: 'test-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Sender Cat', color: '#ff0000', emoji: '🐱' },
      chunkSize: 1024, // 1KB chunks for testing
    });

    const receivedItems: unknown[] = [];
    const service2 = new TransferService({
      transport: transport2,
      persona: { name: 'Receiver Dog', color: '#00ff00', emoji: '🐶' },
      chunkSize: 1024,
    });
    service2.onTransferUpdate((item) => {
      if (item.status === 'completed') {
        receivedItems.push(item);
      }
    });

    const fileContent = 'Hello peer-to-peer chunked file transfer!'.repeat(50);
    const file = new File([fileContent], 'message.txt', { type: 'text/plain' });

    const sentItem = await service1.sendFile(file);

    // Allow async blob.text() to resolve
    await new Promise((r) => setTimeout(r, 20));

    expect(sentItem.status).toBe('completed');
    expect(sentItem.isSender).toBe(true);
    expect(sentItem.meta.totalChunks).toBeGreaterThan(1);

    expect(receivedItems.length).toBe(1);
    const received = receivedItems[0] as {
      status: string;
      meta: { name: string; size: number };
      mediaCategory: string;
      textContent?: string;
    };
    expect(received.status).toBe('completed');
    expect(received.meta.name).toBe('message.txt');
    expect(received.meta.size).toBe(file.size);
    expect(received.mediaCategory).toBe('code');
    expect(received.textContent).toBe(fileContent);

    service1.destroy();
    service2.destroy();
  });

  it('routes targeted transfers only to the chosen recipient peer', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');
    const transport3 = new InMemoryTransport('peer-3');

    await transport1.joinRoom({ roomId: 'whisper-room' });
    await transport2.joinRoom({ roomId: 'whisper-room' });
    await transport3.joinRoom({ roomId: 'whisper-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Alice', color: '#ff0000', emoji: '🐱' },
    });

    let peer2Received = false;
    const service2 = new TransferService({
      transport: transport2,
      persona: { name: 'Bob', color: '#00ff00', emoji: '🐶' },
    });
    service2.onTransferUpdate((item) => {
      if (item.status === 'completed') peer2Received = true;
    });

    let peer3Received = false;
    const service3 = new TransferService({
      transport: transport3,
      persona: { name: 'Charlie', color: '#0000ff', emoji: '🦊' },
    });
    service3.onTransferUpdate((item) => {
      if (item.status === 'completed') peer3Received = true;
    });

    const file = new File(['private message data'], 'secret.txt', { type: 'text/plain' });
    await service1.sendFile(file, { id: 'peer-2', name: 'Bob' });

    expect(peer2Received).toBe(true);
    expect(peer3Received).toBe(false);

    service1.destroy();
    service2.destroy();
    service3.destroy();
  });

  it('rejects files larger than 25MB with clear error', async () => {
    const transport = new InMemoryTransport('peer-1');
    await transport.joinRoom({ roomId: 'limit-room' });

    const service = new TransferService({
      transport,
      persona: { name: 'Sender', color: '#ff0000', emoji: '🐱' },
    });

    // Mock a large file > 25MB
    const largeFile = {
      name: 'huge.iso',
      size: 26 * 1024 * 1024,
      type: 'application/octet-stream',
      slice: () => new Blob(),
    } as unknown as File;

    await expect(service.sendFile(largeFile)).rejects.toThrow('File exceeds 25MB limit');

    service.destroy();
  });
});
