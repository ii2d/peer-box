import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport, resetInMemoryTransportRooms } from './in-memory-transport';

describe('InMemoryTransport Seam', () => {
  beforeEach(() => {
    resetInMemoryTransportRooms();
  });

  it('allows peers to join the same open room and discover each other', async () => {
    const peer1 = new InMemoryTransport('peer-1');
    const peer2 = new InMemoryTransport('peer-2');

    const peer1JoinedPeers: string[] = [];
    peer1.onPeerJoin((p) => peer1JoinedPeers.push(p.id));

    await peer1.joinRoom({ roomId: 'cute-dog' });
    expect(peer1.getPeers()).toEqual([]);

    await peer2.joinRoom({ roomId: 'cute-dog' });

    expect(peer1.getPeers().map((p) => p.id)).toContain('peer-2');
    expect(peer2.getPeers().map((p) => p.id)).toContain('peer-1');
    expect(peer1JoinedPeers).toContain('peer-2');
  });

  it('isolates peers when room keys do not match (AES-GCM simulation)', async () => {
    const peer1 = new InMemoryTransport('peer-1');
    const peer2 = new InMemoryTransport('peer-2');

    await peer1.joinRoom({ roomId: 'cute-dog', roomKey: 'correct-key' });
    await peer2.joinRoom({ roomId: 'cute-dog', roomKey: 'wrong-key' });

    expect(peer1.getPeers()).toEqual([]);
    expect(peer2.getPeers()).toEqual([]);
  });

  it('delivers broadcast and targeted actions between matching peers', async () => {
    const peer1 = new InMemoryTransport('peer-1');
    const peer2 = new InMemoryTransport('peer-2');
    const peer3 = new InMemoryTransport('peer-3');

    await peer1.joinRoom({ roomId: 'cute-dog', roomKey: 'pass' });
    await peer2.joinRoom({ roomId: 'cute-dog', roomKey: 'pass' });
    await peer3.joinRoom({ roomId: 'cute-dog', roomKey: 'pass' });

    const peer2Received: string[] = [];
    const peer3Received: string[] = [];

    peer2.onAction<string>('chat', (msg) => peer2Received.push(msg));
    peer3.onAction<string>('chat', (msg) => peer3Received.push(msg));

    // Broadcast
    peer1.sendAction('chat', 'hello all');
    expect(peer2Received).toEqual(['hello all']);
    expect(peer3Received).toEqual(['hello all']);

    // Targeted only to peer2
    peer1.sendAction('chat', 'secret for peer2', 'peer-2');
    expect(peer2Received).toEqual(['hello all', 'secret for peer2']);
    expect(peer3Received).toEqual(['hello all']);
  });

  it('handles peer leave cleanly and notifies remaining peers', async () => {
    const peer1 = new InMemoryTransport('peer-1');
    const peer2 = new InMemoryTransport('peer-2');

    let leftPeerId: string | null = null;
    peer1.onPeerLeave((id) => {
      leftPeerId = id;
    });

    await peer1.joinRoom({ roomId: 'cute-dog' });
    await peer2.joinRoom({ roomId: 'cute-dog' });

    peer2.leaveRoom();

    expect(peer1.getPeers()).toEqual([]);
    expect(leftPeerId).toBe('peer-2');
  });

  it('allows host and joiner to re-connect when both change to the same new room key', async () => {
    const host = new InMemoryTransport('host');
    const joiner = new InMemoryTransport('joiner');

    // Both join with initial key
    await host.joinRoom({ roomId: 'cute-dog', roomKey: 'initial-key' });
    await joiner.joinRoom({ roomId: 'cute-dog', roomKey: 'initial-key' });

    expect(host.getPeers().map((p) => p.id)).toContain('joiner');
    expect(joiner.getPeers().map((p) => p.id)).toContain('host');

    // 1. Host changes the key
    await host.joinRoom({ roomId: 'cute-dog', roomKey: 'new-key' });

    // Host should no longer see joiner while joiner is on old key
    expect(host.getPeers().map((p) => p.id)).not.toContain('joiner');

    // 2. Joiner changes to the same key
    await joiner.joinRoom({ roomId: 'cute-dog', roomKey: 'new-key' });

    // Both should now be reconnected with each other
    expect(host.getPeers().map((p) => p.id)).toContain('joiner');
    expect(joiner.getPeers().map((p) => p.id)).toContain('host');
  });
});
