import { joinRoom as joinNostrRoom } from 'trystero/nostr';
import { generatePersona, type Persona } from '../persona/persona';
import type { PeerConnectionStats, PeerInfo, RoomTransport, RoomTransportConfig } from './types';

interface TrysteroAction {
  send: (data: unknown, options?: { target?: string } | string) => Promise<unknown> | void;
  onMessage?: ((data: unknown, meta: { peerId: string }) => void) | null;
}

interface TrysteroRoom {
  onPeerJoin?: ((peerId: string) => void) | null;
  onPeerLeave?: ((peerId: string) => void) | null;
  makeAction: (
    name: string,
  ) =>
    | TrysteroAction
    | [
        (data: unknown, targetPeerId?: string) => void,
        (cb: (data: unknown, peerId: string) => void) => void,
      ];
  getPeers?: () => Record<string, RTCPeerConnection>;
  leave: () => void;
}

export interface TrysteroTransportOptions {
  appId?: string;
  joinRoomFn?: (config: { appId: string; password?: string }, roomId: string) => TrysteroRoom;
  persona?: Persona;
}

export class TrysteroTransport implements RoomTransport {
  readonly localPeerId: string;
  private _roomId: string | null = null;
  private _roomKey: string | null = null;
  private appId: string;
  private joinRoomFn: (
    config: { appId: string; password?: string },
    roomId: string,
  ) => TrysteroRoom;

  private room: TrysteroRoom | null = null;
  private peers = new Map<string, PeerInfo>();
  private localPersona: Persona;

  private peerJoinListeners = new Set<(peer: PeerInfo) => void>();
  private peerLeaveListeners = new Set<(peerId: string) => void>();
  private actionHandlers = new Map<
    string,
    {
      send: (data: unknown, targetPeerId?: string) => void;
      listeners: Set<(payload: unknown, senderId: string) => void>;
    }
  >();

  constructor(options: TrysteroTransportOptions = {}) {
    this.appId = options.appId ?? 'peer-box-ii2d';
    this.joinRoomFn = options.joinRoomFn ?? (joinNostrRoom as unknown as typeof this.joinRoomFn);
    this.localPeerId = `peer-${Math.random().toString(36).slice(2, 9)}`;
    this.localPersona = options.persona ?? generatePersona();
  }

  get currentRoomId(): string | null {
    return this._roomId;
  }

  get currentRoomKey(): string | null {
    return this._roomKey;
  }

  get persona(): Persona {
    return this.localPersona;
  }

  setPersona(persona: Persona): void {
    this.localPersona = persona;
    if (this._roomId) {
      this.sendAction('peer-presence', {
        id: this.localPeerId,
        name: persona.name,
        color: persona.color,
        emoji: persona.emoji,
      });
    }
  }

  async joinRoom(config: RoomTransportConfig): Promise<void> {
    if (this._roomId) {
      this.leaveRoom();
    }

    this._roomId = config.roomId;
    this._roomKey = config.roomKey ?? null;

    const trysteroConfig: { appId: string; password?: string } = {
      appId: this.appId,
    };
    if (this._roomKey) {
      trysteroConfig.password = this._roomKey;
    }

    this.room = this.joinRoomFn(trysteroConfig, config.roomId);

    // Setup peer presence action
    this.onAction<PeerInfo & { emoji?: string }>('peer-presence', (peerProfile, senderId) => {
      const existing = this.peers.get(senderId) ?? { id: senderId };
      const updated: PeerInfo = {
        ...existing,
        name: peerProfile.name,
        color: peerProfile.color,
      };
      this.peers.set(senderId, updated);
      for (const listener of this.peerJoinListeners) {
        listener(updated);
      }
    });

    const handlePeerJoin = (peerId: string) => {
      const peerInfo: PeerInfo = { id: peerId };
      this.peers.set(peerId, peerInfo);

      // Announce our presence to the newly joined peer
      this.sendAction(
        'peer-presence',
        {
          id: this.localPeerId,
          name: this.localPersona.name,
          color: this.localPersona.color,
          emoji: this.localPersona.emoji,
        },
        peerId,
      );

      for (const listener of this.peerJoinListeners) {
        listener(peerInfo);
      }
    };

    const rawJoin = this.room.onPeerJoin as unknown;
    if (typeof rawJoin === 'function' && (rawJoin as (...args: unknown[]) => unknown).length > 0) {
      (rawJoin as (cb: (peerId: string) => void) => void)(handlePeerJoin);
    } else {
      this.room.onPeerJoin = handlePeerJoin;
    }

    const handlePeerLeave = (peerId: string) => {
      this.peers.delete(peerId);
      for (const listener of this.peerLeaveListeners) {
        listener(peerId);
      }
    };

    const rawLeave = this.room.onPeerLeave as unknown;
    if (
      typeof rawLeave === 'function' &&
      (rawLeave as (...args: unknown[]) => unknown).length > 0
    ) {
      (rawLeave as (cb: (peerId: string) => void) => void)(handlePeerLeave);
    } else {
      this.room.onPeerLeave = handlePeerLeave;
    }
  }

  leaveRoom(): void {
    if (this.room) {
      this.room.onPeerJoin = null;
      this.room.onPeerLeave = null;
      try {
        this.room.leave();
      } catch {
        // Safe cleanup
      }
      this.room = null;
    }
    this.peers.clear();
    this.actionHandlers.clear();
    this._roomId = null;
    this._roomKey = null;
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  onPeerJoin(cb: (peer: PeerInfo) => void): () => void {
    this.peerJoinListeners.add(cb);
    return () => this.peerJoinListeners.delete(cb);
  }

  onPeerLeave(cb: (peerId: string) => void): () => void {
    this.peerLeaveListeners.add(cb);
    return () => this.peerLeaveListeners.delete(cb);
  }

  private getOrCreateAction(actionName: string) {
    if (!this.room) return null;
    let entry = this.actionHandlers.get(actionName);
    if (!entry) {
      const rawAction = this.room.makeAction(actionName);
      const listeners = new Set<(payload: unknown, senderId: string) => void>();

      let sendFn: (data: unknown, targetPeerId?: string) => void;

      if (Array.isArray(rawAction)) {
        const [send, onReceive] = rawAction;
        sendFn = send;
        onReceive((data: unknown, peerId: string) => {
          for (const listener of listeners) {
            listener(data, peerId);
          }
        });
      } else {
        sendFn = (data: unknown, targetPeerId?: string) => {
          if (targetPeerId) {
            rawAction.send(data, { target: targetPeerId });
          } else {
            rawAction.send(data);
          }
        };
        rawAction.onMessage = (data: unknown, meta: { peerId: string }) => {
          const senderId = meta?.peerId ?? '';
          for (const listener of listeners) {
            listener(data, senderId);
          }
        };
      }

      entry = { send: sendFn, listeners };
      this.actionHandlers.set(actionName, entry);
    }
    return entry;
  }

  sendAction<T>(actionName: string, payload: T, targetPeerId?: string): void {
    const action = this.getOrCreateAction(actionName);
    if (!action) return;

    if (targetPeerId) {
      action.send(payload, targetPeerId);
    } else {
      action.send(payload);
    }
  }

  onAction<T>(actionName: string, cb: (payload: T, senderId: string) => void): () => void {
    const action = this.getOrCreateAction(actionName);
    const handler = cb as (payload: unknown, senderId: string) => void;
    if (action) {
      action.listeners.add(handler);
    }
    return () => {
      action?.listeners.delete(handler);
    };
  }

  async getPeerStats(peerId: string): Promise<PeerConnectionStats | null> {
    if (!this.room) return null;
    try {
      const rawPeers = this.room.getPeers?.() || {};
      const pc = rawPeers[peerId];
      if (pc && typeof pc.getStats === 'function') {
        const stats = await pc.getStats();
        let rtt = 20;
        let type: 'host' | 'srflx' = 'srflx';
        let localCandType = 'srflx';
        let remoteCandType = 'srflx';
        let protocol = 'udp';
        let packetsLost = 0;
        let bytesSent = 0;
        let bytesReceived = 0;

        stats.forEach((report: RTCStats) => {
          const rep = report as unknown as {
            type: string;
            state?: string;
            currentRoundTripTime?: number;
            candidateType?: string;
            protocol?: string;
            packetsLost?: number;
            bytesSent?: number;
            bytesReceived?: number;
          };
          if (rep.type === 'candidate-pair' && rep.state === 'succeeded') {
            if (rep.currentRoundTripTime !== undefined) {
              rtt = Math.round(rep.currentRoundTripTime * 1000);
            }
            if (rep.bytesSent !== undefined) bytesSent = rep.bytesSent;
            if (rep.bytesReceived !== undefined) bytesReceived = rep.bytesReceived;
          }
          if (rep.type === 'local-candidate') {
            if (rep.candidateType) localCandType = rep.candidateType;
            if (rep.protocol) protocol = rep.protocol;
          }
          if (rep.type === 'remote-candidate') {
            if (rep.candidateType) {
              remoteCandType = rep.candidateType;
              if (rep.candidateType === 'host') {
                type = 'host';
              }
            }
          }
          if (rep.type === 'inbound-rtp' && rep.packetsLost !== undefined) {
            packetsLost += rep.packetsLost;
          }
        });

        const state = (pc.connectionState ||
          pc.iceConnectionState ||
          'connected') as PeerConnectionStats['connectionState'];

        return {
          peerId,
          roundTripTimeMs: rtt,
          candidateType: type,
          localCandidateType: localCandType,
          remoteCandidateType: remoteCandType,
          protocol,
          packetsLost,
          bytesSent,
          bytesReceived,
          connectionState: state === 'failed' || state === 'disconnected' ? 'failed' : 'connected',
        };
      }
    } catch {
      // Fallback
    }

    return {
      peerId,
      roundTripTimeMs: 25,
      candidateType: 'srflx',
      connectionState: 'connected',
    };
  }
}
