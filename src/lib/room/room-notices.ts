import type { PeerInfo } from '../transport/types';

export interface RoomNotice {
  id: string;
  kind: 'join' | 'leave';
  peerId: string;
  personaName: string;
  personaEmoji?: string;
  personaColor?: string;
  timestamp: number;
}

export interface RoomNoticeManagerOptions {
  quietPeriodMs?: number;
  leaveGracePeriodMs?: number;
  personaTimeoutMs?: number;
}

export class RoomNoticeManager {
  private notices: RoomNotice[] = [];
  private quietPeriodMs: number;
  private leaveGracePeriodMs: number;
  private personaTimeoutMs: number;
  private isQuiet = true;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private knownPeers = new Map<string, PeerInfo>();
  private pendingPersonaTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingLeaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subscribers = new Set<(notices: RoomNotice[]) => void>();

  constructor(options?: RoomNoticeManagerOptions) {
    this.quietPeriodMs = options?.quietPeriodMs ?? 2000;
    this.leaveGracePeriodMs = options?.leaveGracePeriodMs ?? 5000;
    this.personaTimeoutMs = options?.personaTimeoutMs ?? 1500;

    if (this.quietPeriodMs > 0) {
      this.quietTimer = setTimeout(() => {
        this.isQuiet = false;
        this.quietTimer = null;
      }, this.quietPeriodMs);
    } else {
      this.isQuiet = false;
    }
  }

  handlePeerJoin(peer: PeerInfo): void {
    const existing = this.knownPeers.get(peer.id);
    const updated: PeerInfo = {
      ...existing,
      ...peer,
    };
    this.knownPeers.set(peer.id, updated);

    // If there was a pending leave timer for this peer, cancel it (reconnection debounce)
    const pendingLeave = this.pendingLeaveTimers.get(peer.id);
    if (pendingLeave) {
      clearTimeout(pendingLeave);
      this.pendingLeaveTimers.delete(peer.id);
      return;
    }

    // If we are still in the initial quiet window, mark peer as present without emitting notice
    if (this.isQuiet) {
      return;
    }

    // If peer already had a join notice emitted, do not re-emit
    if (this.hasJoinNotice(peer.id)) {
      return;
    }

    if (updated.name || this.personaTimeoutMs <= 0) {
      this.cancelPendingPersonaTimer(peer.id);
      this.emitNotice({
        id: `notice-join-${peer.id}-${Date.now()}`,
        kind: 'join',
        peerId: peer.id,
        personaName: updated.name || updated.id,
        personaEmoji: updated.emoji,
        personaColor: updated.color,
        timestamp: Date.now(),
      });
    } else if (!this.pendingPersonaTimers.has(peer.id)) {
      const timer = setTimeout(() => {
        this.pendingPersonaTimers.delete(peer.id);
        const latest = this.knownPeers.get(peer.id) ?? peer;
        this.emitNotice({
          id: `notice-join-${peer.id}-${Date.now()}`,
          kind: 'join',
          peerId: peer.id,
          personaName: latest.name || latest.id,
          personaEmoji: latest.emoji,
          personaColor: latest.color,
          timestamp: Date.now(),
        });
      }, this.personaTimeoutMs);
      this.pendingPersonaTimers.set(peer.id, timer);
    }
  }

  handlePeerLeave(peerId: string, peerInfo?: PeerInfo): void {
    const info = peerInfo ?? this.knownPeers.get(peerId) ?? { id: peerId };
    this.cancelPendingPersonaTimer(peerId);

    // If leave debounce is active, wait for grace period
    if (this.leaveGracePeriodMs > 0) {
      const existing = this.pendingLeaveTimers.get(peerId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.pendingLeaveTimers.delete(peerId);
        this.knownPeers.delete(peerId);
        this.emitNotice({
          id: `notice-leave-${peerId}-${Date.now()}`,
          kind: 'leave',
          peerId,
          personaName: info.name || peerId,
          personaEmoji: info.emoji,
          personaColor: info.color,
          timestamp: Date.now(),
        });
      }, this.leaveGracePeriodMs);
      this.pendingLeaveTimers.set(peerId, timer);
    } else {
      this.knownPeers.delete(peerId);
      this.emitNotice({
        id: `notice-leave-${peerId}-${Date.now()}`,
        kind: 'leave',
        peerId,
        personaName: info.name || peerId,
        personaEmoji: info.emoji,
        personaColor: info.color,
        timestamp: Date.now(),
      });
    }
  }

  getNotices(): RoomNotice[] {
    return [...this.notices];
  }

  subscribe(callback: (notices: RoomNotice[]) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getNotices());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  reset(): void {
    this.clearAllTimers();
    this.notices = [];
    this.knownPeers.clear();
    this.isQuiet = this.quietPeriodMs > 0;
    if (this.isQuiet) {
      this.quietTimer = setTimeout(() => {
        this.isQuiet = false;
        this.quietTimer = null;
      }, this.quietPeriodMs);
    }
    this.notifySubscribers();
  }

  destroy(): void {
    this.clearAllTimers();
    this.subscribers.clear();
  }

  private hasJoinNotice(peerId: string): boolean {
    return this.notices.some((n) => n.kind === 'join' && n.peerId === peerId);
  }

  private cancelPendingPersonaTimer(peerId: string) {
    const timer = this.pendingPersonaTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.pendingPersonaTimers.delete(peerId);
    }
  }

  private clearAllTimers() {
    if (this.quietTimer) {
      clearTimeout(this.quietTimer);
      this.quietTimer = null;
    }
    for (const timer of this.pendingPersonaTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingPersonaTimers.clear();
    for (const timer of this.pendingLeaveTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingLeaveTimers.clear();
  }

  private emitNotice(notice: RoomNotice) {
    this.notices = [...this.notices, notice];
    this.notifySubscribers();
  }

  private notifySubscribers() {
    const current = this.getNotices();
    for (const sub of this.subscribers) {
      sub(current);
    }
  }
}
