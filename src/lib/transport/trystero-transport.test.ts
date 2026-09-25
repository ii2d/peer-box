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
      makeAction: vi.fn(() => [sendMock, vi.fn()]),
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
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: transport.localPeerId }),
      'peer-remote',
    );

    // Simulate peer leaving
    const leftPeers: string[] = [];
    transport.onPeerLeave((id) => leftPeers.push(id));
    peerLeaveCb!('peer-remote');
    expect(leftPeers).toContain('peer-remote');

    // Leaving room
    transport.leaveRoom();
    expect(mockRoom.leave).toHaveBeenCalled();
  });
});
