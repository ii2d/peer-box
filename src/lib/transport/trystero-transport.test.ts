import { describe, expect, it, vi } from 'vitest';
import { TrysteroTransport } from './trystero-transport';

describe('TrysteroTransport Adapter', () => {
  it('calls joinRoom with appId and optional password and wires peer presence', async () => {
    let peerJoinCb: ((peerId: string) => void) | null = null;
    let peerLeaveCb: ((peerId: string) => void) | null = null;
    const sendMock = vi.fn();

    const mockRoom = {
      onPeerJoin: vi.fn((cb) => {
        peerJoinCb = cb;
      }),
      onPeerLeave: vi.fn((cb) => {
        peerLeaveCb = cb;
      }),
      makeAction: vi.fn(() => ({
        send: sendMock,
        onMessage: null,
      })),
      getPeers: vi.fn(() => ({ 'peer-remote': {} })),
      leave: vi.fn(),
    };

    const mockJoinRoomFn = vi.fn().mockReturnValue(mockRoom);

    const transport = new TrysteroTransport({
      joinRoomFn: mockJoinRoomFn,
      appId: 'test-app',
    });

    await transport.joinRoom({ roomId: 'cute-dog', roomKey: 'secretpass' });

    expect(mockJoinRoomFn).toHaveBeenCalledWith(
      {
        appId: 'test-app',
        password: 'secretpass',
      },
      'cute-dog',
    );

    expect(mockRoom.onPeerJoin).toHaveBeenCalled();
    expect(mockRoom.onPeerLeave).toHaveBeenCalled();

    // Verify peer join announcement
    const joinedPeers: string[] = [];
    transport.onPeerJoin((p) => joinedPeers.push(p.id));

    // Simulate remote peer joining
    peerJoinCb!('peer-remote');
    expect(joinedPeers).toContain('peer-remote');
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ id: transport.localPeerId }), {
      target: 'peer-remote',
    });

    // Simulate peer leaving
    const leftPeers: string[] = [];
    transport.onPeerLeave((id) => leftPeers.push(id));
    peerLeaveCb!('peer-remote');
    expect(leftPeers).toContain('peer-remote');

    // Leaving room
    transport.leaveRoom();
    expect(mockRoom.leave).toHaveBeenCalled();
  });

  it('correctly handles Trystero v0.25+ object action API for sending and receiving', async () => {
    let onMessageFn: ((data: unknown, meta: { peerId: string }) => void) | null = null;
    const sendMock = vi.fn();

    const mockAction = {
      send: sendMock,
      get onMessage() {
        return onMessageFn;
      },
      set onMessage(fn) {
        onMessageFn = fn;
      },
    };

    const mockRoom = {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      makeAction: vi.fn(() => mockAction),
      leave: vi.fn(),
    };

    const transport = new TrysteroTransport({
      joinRoomFn: vi.fn().mockReturnValue(mockRoom),
    });

    await transport.joinRoom({ roomId: 'test-room' });

    const received: Array<{ data: unknown; senderId: string }> = [];
    transport.onAction<{ text: string }>('chat', (data, senderId) => {
      received.push({ data, senderId });
    });

    // Simulate incoming action message
    expect(onMessageFn).not.toBeNull();
    onMessageFn!({ text: 'hello' }, { peerId: 'peer-abc' });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual({
      data: { text: 'hello' },
      senderId: 'peer-abc',
    });

    // Send action broadcast
    transport.sendAction('chat', { text: 'world' });
    expect(sendMock).toHaveBeenCalledWith({ text: 'world' });

    // Send directed action
    transport.sendAction('chat', { text: 'direct' }, 'peer-abc');
    expect(sendMock).toHaveBeenCalledWith({ text: 'direct' }, { target: 'peer-abc' });

    transport.leaveRoom();
  });
});
