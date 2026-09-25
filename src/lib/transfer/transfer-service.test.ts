import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport, resetInMemoryTransportRooms } from '../transport/in-memory-transport';
import { TransferService } from './transfer-service';
import type { FileTransferItem } from './types';

describe('TransferService', () => {
  beforeEach(() => {
    resetInMemoryTransportRooms();
  });

  it('chunks, transfers, and reassembles small files (<25MB) automatically', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'test-room' });
    await transport2.joinRoom({ roomId: 'test-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Sender Cat', color: '#ff0000', emoji: '🐱' },
      chunkSize: 1024,
    });

    const receivedItems: FileTransferItem[] = [];
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

    const fileContent = 'Small file content!'.repeat(50);
    const file = new File([fileContent], 'small.txt', { type: 'text/plain' });

    const sentItem = await service1.sendFile(file);

    // Allow async blob.text() to resolve
    await new Promise((r) => setTimeout(r, 20));

    expect(sentItem.status).toBe('completed');
    expect(sentItem.isSender).toBe(true);

    expect(receivedItems.length).toBe(1);
    expect(receivedItems[0].status).toBe('completed');
    expect(receivedItems[0].meta.name).toBe('small.txt');
    expect(receivedItems[0].textContent).toBe(fileContent);

    service1.destroy();
    service2.destroy();
  });

  it('handles large file (≥25MB) request, acceptance, and OPFS/sink streaming', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'large-room' });
    await transport2.joinRoom({ roomId: 'large-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Sender Elephant', color: '#3b82f6', emoji: '🐘' },
      chunkSize: 1024 * 1024, // 1MB chunks
    });

    let receiverItem: FileTransferItem | null = null;
    const service2 = new TransferService({
      transport: transport2,
      persona: { name: 'Receiver Bear', color: '#10b981', emoji: '🐻' },
      chunkSize: 1024 * 1024,
    });
    service2.onTransferUpdate((item) => {
      receiverItem = item;
    });

    // Mock 30MB file
    const largeSize = 30 * 1024 * 1024;
    const chunkData = new Uint8Array(1024 * 1024).fill(65);
    const largeFile = {
      name: 'archive.iso',
      size: largeSize,
      type: 'application/octet-stream',
      slice: (start: number, end: number) => {
        const len = end - start;
        return new Blob([chunkData.subarray(0, len)]);
      },
    } as unknown as File;

    // Sender initiates transfer
    const sendPromise = service1.sendFile(largeFile);

    // Allow metadata action to propagate
    await new Promise((r) => setTimeout(r, 10));

    // Receiver should have received incoming request in 'pending-decision' state
    expect(receiverItem).not.toBeNull();
    expect(receiverItem!.status).toBe('pending-decision');
    expect(receiverItem!.meta.isLarge).toBe(true);
    expect(receiverItem!.meta.name).toBe('archive.iso');

    // Receiver accepts transfer
    await service2.acceptTransfer(receiverItem!.id);

    // Wait for chunk transfer and acks to complete
    await sendPromise;
    await new Promise((r) => setTimeout(r, 20));

    expect(receiverItem!.status).toBe('completed');
    expect(receiverItem!.progress).toBe(1);
    expect(receiverItem!.speed).toBeDefined();

    service1.destroy();
    service2.destroy();
  });

  it('handles large file decline by recipient', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'decline-room' });
    await transport2.joinRoom({ roomId: 'decline-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Sender', color: '#ff0000', emoji: '🐱' },
    });

    let receiverItem: FileTransferItem | null = null;
    const service2 = new TransferService({
      transport: transport2,
      persona: { name: 'Receiver', color: '#00ff00', emoji: '🐶' },
    });
    service2.onTransferUpdate((item) => {
      receiverItem = item;
    });

    const largeFile = {
      name: 'movie.mp4',
      size: 50 * 1024 * 1024,
      type: 'video/mp4',
      slice: () => new Blob(),
    } as unknown as File;

    const sendPromise = service1.sendFile(largeFile);
    await new Promise((r) => setTimeout(r, 10));

    expect(receiverItem).not.toBeNull();
    expect(receiverItem!.status).toBe('pending-decision');

    // Recipient declines
    service2.declineTransfer(receiverItem!.id);
    await expect(sendPromise).rejects.toThrow('Transfer declined by recipient');

    expect(receiverItem!.status).toBe('declined');

    service1.destroy();
    service2.destroy();
  });

  it('handles cancellation by sender during active transfer', async () => {
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    await transport1.joinRoom({ roomId: 'cancel-room' });
    await transport2.joinRoom({ roomId: 'cancel-room' });

    const service1 = new TransferService({
      transport: transport1,
      persona: { name: 'Sender', color: '#ff0000', emoji: '🐱' },
      chunkSize: 1024,
    });

    let receiverItem: FileTransferItem | null = null;
    const service2 = new TransferService({
      transport: transport2,
      persona: { name: 'Receiver', color: '#00ff00', emoji: '🐶' },
      chunkSize: 1024,
    });
    service2.onTransferUpdate((item) => {
      receiverItem = item;
    });

    const largeFile = {
      name: 'data.bin',
      size: 26 * 1024 * 1024,
      type: 'application/octet-stream',
      slice: () => new Blob([new Uint8Array(1024)]),
    } as unknown as File;

    const sendPromise = service1.sendFile(largeFile);
    await new Promise((r) => setTimeout(r, 10));

    // Recipient accepts
    const acceptPromise = service2.acceptTransfer(receiverItem!.id);

    // Sender cancels immediately
    service1.cancelTransfer(receiverItem!.id);

    await expect(sendPromise).rejects.toThrow('Transfer cancelled');
    await acceptPromise.catch(() => {});

    expect(receiverItem!.status).toBe('cancelled');

    service1.destroy();
    service2.destroy();
  });
});
