import type { PeerConnectionStats, PeerInfo, RoomTransport, RoomTransportConfig } from './types';

interface RoomState {
  peers: Set<InMemoryTransport>;
}

const activeRooms = new Map<string, RoomState>();

export function resetInMemoryTransportRooms(): void {
  for (const room of activeRooms.values()) {
    room.peers.clear();
  }
  activeRooms.clear();
}

export class InMemoryTransport implements RoomTransport {
  readonly localPeerId: string;
  private _roomId: string | null = null;
  private _roomKey: string | null = null;

  private peerJoinListeners = new Set<(peer: PeerInfo) => void>();
  private peerLeaveListeners = new Set<(peerId: string) => void>();
  private actionListeners = new Map<string, Set<(payload: unknown, senderId: string) => void>>();

  constructor(peerId?: string) {
    this.localPeerId = peerId ?? `peer-${Math.random().toString(36).slice(2, 9)}`;
  }

  get currentRoomId(): string | null {
    return this._roomId;
  }

  get currentRoomKey(): string | null {
    return this._roomKey;
  }

  async joinRoom(config: RoomTransportConfig): Promise<void> {
    if (this._roomId) {
      this.leaveRoom();
    }

    this._roomId = config.roomId;
    this._roomKey = config.roomKey ?? null;

    let room = activeRooms.get(config.roomId);
    if (!room) {
      room = {
        peers: new Set(),
      };
      activeRooms.set(config.roomId, room);
    }

    room.peers.add(this);

    // Trystero encryption key isolation:
    // Only peers with matching room keys discover each other
    for (const peer of room.peers) {
      if (peer !== this && (peer.currentRoomKey ?? null) === (this._roomKey ?? null)) {
        peer._dispatchPeerJoin({ id: this.localPeerId });
        this._dispatchPeerJoin({ id: peer.localPeerId });
      }
    }
  }

  leaveRoom(): void {
    if (!this._roomId) return;

    const room = activeRooms.get(this._roomId);
    if (room && room.peers.has(this)) {
      room.peers.delete(this);
      for (const peer of room.peers) {
        if ((peer.currentRoomKey ?? null) === (this._roomKey ?? null)) {
          peer._dispatchPeerLeave(this.localPeerId);
        }
      }
      if (room.peers.size === 0) {
        activeRooms.delete(this._roomId);
      }
    }

    this._roomId = null;
    this._roomKey = null;
  }

  getPeers(): PeerInfo[] {
    if (!this._roomId) return [];
    const room = activeRooms.get(this._roomId);
    if (!room || !room.peers.has(this)) return [];

    const result: PeerInfo[] = [];
    for (const peer of room.peers) {
      if (peer !== this && (peer.currentRoomKey ?? null) === (this._roomKey ?? null)) {
        result.push({ id: peer.localPeerId });
      }
    }
    return result;
  }

  onPeerJoin(cb: (peer: PeerInfo) => void): () => void {
    this.peerJoinListeners.add(cb);
    return () => this.peerJoinListeners.delete(cb);
  }

  onPeerLeave(cb: (peerId: string) => void): () => void {
    this.peerLeaveListeners.add(cb);
    return () => this.peerLeaveListeners.delete(cb);
  }

  sendAction<T>(actionName: string, payload: T, targetPeerId?: string): void {
    if (!this._roomId) return;
    const room = activeRooms.get(this._roomId);
    if (!room || !room.peers.has(this)) return;

    for (const peer of room.peers) {
      if (peer === this) continue;
      // Key isolation: only peers with matching key receive actions
      if ((peer.currentRoomKey ?? null) !== (this._roomKey ?? null)) continue;
      if (targetPeerId && peer.localPeerId !== targetPeerId) continue;
      peer._receiveAction(actionName, payload, this.localPeerId);
    }
  }

  onAction<T>(actionName: string, cb: (payload: T, senderId: string) => void): () => void {
    let set = this.actionListeners.get(actionName);
    if (!set) {
      set = new Set();
      this.actionListeners.set(actionName, set);
    }
    const handler = cb as (payload: unknown, senderId: string) => void;
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  private customPeerStats = new Map<string, PeerConnectionStats>();

  setMockPeerStats(peerId: string, stats: PeerConnectionStats): void {
    this.customPeerStats.set(peerId, stats);
  }

  async getPeerStats(peerId: string): Promise<PeerConnectionStats | null> {
    if (this.customPeerStats.has(peerId)) {
      return this.customPeerStats.get(peerId)!;
    }
    if (!this.getPeers().some((p) => p.id === peerId)) {
      return null;
    }
    return {
      peerId,
      roundTripTimeMs: 12,
      candidateType: 'host',
      localCandidateType: 'host',
      remoteCandidateType: 'host',
      protocol: 'udp',
      packetsLost: 0,
      connectionState: 'connected',
    };
  }

  _dispatchPeerJoin(peer: PeerInfo): void {
    for (const listener of this.peerJoinListeners) {
      listener(peer);
    }
  }

  _dispatchPeerLeave(peerId: string): void {
    for (const listener of this.peerLeaveListeners) {
      listener(peerId);
    }
  }

  _receiveAction(actionName: string, payload: unknown, senderId: string): void {
    const listeners = this.actionListeners.get(actionName);
    if (listeners) {
      for (const listener of listeners) {
        listener(payload, senderId);
      }
    }
  }
}
