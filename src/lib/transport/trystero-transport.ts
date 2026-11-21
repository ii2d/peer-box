import { joinRoom as joinNostrRoom } from 'trystero';
import { generatePersona, type Persona } from '../persona/persona';
import type { PeerConnectionStats, PeerInfo, RoomTransport, RoomTransportConfig } from './types';

interface TrysteroAction {
  send: (data: unknown, options?: { target?: string } | string) => Promise<unknown> | void;
  onMessage?:
    | ((cb: (data: unknown, meta?: { peerId?: string }) => void) => () => void)
    | ((data: unknown, meta: { peerId: string }) => void)
    | unknown;
}

interface TrysteroRoom {
  onPeerJoin?:
    | ((handler: (context: { peerId: string } | string) => void) => () => void)
    | ((peerId: string) => void)
    | unknown;
  onPeerLeave?:
    | ((handler: (context: { peerId: string } | string) => void) => () => void)
    | ((peerId: string) => void)
    | unknown;
  makeAction: (
    name: string,
  ) =>
    | TrysteroAction
    | [
        (data: unknown, targetPeerId?: string) => void,
        (cb: (data: unknown, peerId: string) => void) => void,
      ];
  getPeers?: () => Record<string, RTCPeerConnection | { connection?: RTCPeerConnection | null }>;
  leave: () => Promise<void> | void;
}

export interface TrysteroTransportOptions {
  appId?: string;
  joinRoomFn?: (config: { appId: string; password?: string }, roomId: string) => TrysteroRoom;
  persona?: Persona;
}

function subscribeOrAssign<T extends object, K extends keyof T>(
  target: T,
  prop: K,
  handler: unknown,
): (() => void) | null {
  const desc = Object.getOwnPropertyDescriptor(target, prop);
  if (desc && typeof desc.set === 'function') {
    try {
      (target as Record<K, unknown>)[prop] = handler;
      return null;
    } catch {
      // Locked method in Trystero 0.27+
      const fn = (target as Record<K, unknown>)[prop];
      if (typeof fn === 'function') {
        const unsub = (fn as (cb: unknown) => unknown)(handler);
        return typeof unsub === 'function' ? (unsub as () => void) : null;
      }
    }
  } else {
    const fn = (target as Record<K, unknown>)[prop];
    if (typeof fn === 'function') {
      const unsub = (fn as (cb: unknown) => unknown)(handler);
      return typeof unsub === 'function' ? (unsub as () => void) : null;
    } else {
      try {
        (target as Record<K, unknown>)[prop] = handler;
      } catch {
        // Safe fallback
      }
    }
  }
  return null;
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

  private unsubPeerJoin: (() => void) | null = null;
  private unsubPeerLeave: (() => void) | null = null;

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
      void this.sendAction('peer-presence', {
        id: this.localPeerId,
        name: persona.name,
        color: persona.color,
        emoji: persona.emoji,
      });
    }
  }

  async joinRoom(config: RoomTransportConfig): Promise<void> {
    if (this._roomId) {
      await this.leaveRoom();
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
        emoji: peerProfile.emoji,
      };
      this.peers.set(senderId, updated);
      for (const listener of this.peerJoinListeners) {
        listener(updated);
      }
    });

    const handlePeerJoin = (peerOrContext: unknown) => {
      const peerId =
        typeof peerOrContext === 'string'
          ? peerOrContext
          : (peerOrContext as { peerId?: string } | null | undefined)?.peerId;
      if (!peerId) return;

      const peerInfo: PeerInfo = { id: peerId };
      this.peers.set(peerId, peerInfo);

      // Announce our presence to the newly joined peer
      void this.sendAction(
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

    this.unsubPeerJoin = subscribeOrAssign(this.room, 'onPeerJoin', handlePeerJoin);

    const handlePeerLeave = (peerOrContext: unknown) => {
      const peerId =
        typeof peerOrContext === 'string'
          ? peerOrContext
          : (peerOrContext as { peerId?: string } | null | undefined)?.peerId;
      if (!peerId) return;

      this.peers.delete(peerId);
      for (const listener of this.peerLeaveListeners) {
        listener(peerId);
      }
    };

    this.unsubPeerLeave = subscribeOrAssign(this.room, 'onPeerLeave', handlePeerLeave);
  }

  async leaveRoom(): Promise<void> {
    if (this.unsubPeerJoin) {
      try {
        this.unsubPeerJoin();
      } catch {
        // Safe cleanup
      }
      this.unsubPeerJoin = null;
    }
    if (this.unsubPeerLeave) {
      try {
        this.unsubPeerLeave();
      } catch {
        // Safe cleanup
      }
      this.unsubPeerLeave = null;
    }

    if (this.room) {
      const roomToLeave = this.room;
      this.room = null;
      try {
        if (typeof roomToLeave.onPeerJoin !== 'function') {
          (roomToLeave as unknown as Record<string, unknown>).onPeerJoin = null;
        }
      } catch {
        // Safe cleanup
      }
      try {
        if (typeof roomToLeave.onPeerLeave !== 'function') {
          (roomToLeave as unknown as Record<string, unknown>).onPeerLeave = null;
        }
      } catch {
        // Safe cleanup
      }
      try {
        const leaveResult = roomToLeave.leave();
        if (leaveResult && typeof (leaveResult as Promise<void>).then === 'function') {
          await Promise.race([leaveResult, new Promise((resolve) => setTimeout(resolve, 150))]);
        }
      } catch {
        // Safe cleanup
      }
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

      let sendFn: (data: unknown, targetPeerId?: string) => Promise<unknown> | void;

      if (Array.isArray(rawAction)) {
        const [send, onReceive] = rawAction;
        sendFn = (data: unknown, targetPeerId?: string) => send(data, targetPeerId);
        onReceive((data: unknown, peerId: string) => {
          for (const listener of listeners) {
            listener(data, peerId);
          }
        });
      } else {
        sendFn = (data: unknown, targetPeerId?: string) => {
          if (targetPeerId) {
            return rawAction.send(data, { target: targetPeerId });
          } else {
            return rawAction.send(data);
          }
        };

        const handleIncoming = (data: unknown, meta?: { peerId?: string } | string) => {
          const senderId = (typeof meta === 'string' ? meta : meta?.peerId) ?? '';
          for (const listener of listeners) {
            listener(data, senderId);
          }
        };

        subscribeOrAssign(rawAction, 'onMessage', handleIncoming);
      }

      entry = { send: sendFn, listeners };
      this.actionHandlers.set(actionName, entry);
    }
    return entry;
  }

  async sendAction<T>(actionName: string, payload: T, targetPeerId?: string): Promise<void> {
    const action = this.getOrCreateAction(actionName);
    if (!action) return;

    try {
      if (targetPeerId) {
        await action.send(payload, targetPeerId);
      } else {
        await action.send(payload);
      }
    } catch {
      // Safe fallback if target peer disconnected or send failed
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
      const rawPeers = (this.room.getPeers?.() || {}) as Record<string, unknown>;
      const rawPeer = rawPeers[peerId];
      const pc = (rawPeer && typeof rawPeer === 'object' && 'connection' in rawPeer
        ? (rawPeer as { connection?: RTCPeerConnection | null }).connection
        : rawPeer) as RTCPeerConnection | null;

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
