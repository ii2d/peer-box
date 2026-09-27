import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomNoticeManager } from './room-notices';
import type { PeerInfo } from '../transport/types';

describe('RoomNoticeManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a join notice when a peer with persona joins after the quiet window', () => {
    const manager = new RoomNoticeManager({ quietPeriodMs: 1000 });

    // Advance past initial room quiet period
    vi.advanceTimersByTime(1001);

    const peer: PeerInfo = {
      id: 'peer-1',
      name: 'Starlight Fox',
      color: '#ff5500',
      emoji: '🦊',
    };

    manager.handlePeerJoin(peer);

    const notices = manager.getNotices();
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      kind: 'join',
      peerId: 'peer-1',
      personaName: 'Starlight Fox',
      personaColor: '#ff5500',
      personaEmoji: '🦊',
    });
  });

  it('suppresses join notices for peers discovered during the initial quiet window', () => {
    const manager = new RoomNoticeManager({ quietPeriodMs: 2000 });

    // Peer joins immediately upon room entry (during quiet window)
    manager.handlePeerJoin({
      id: 'initial-peer-1',
      name: 'Cosmic Bear',
      color: '#3b82f6',
      emoji: '🐻',
    });

    expect(manager.getNotices()).toHaveLength(0);

    // After quiet window expires, still no retroactive notice for peers already in the room
    vi.advanceTimersByTime(2500);
    expect(manager.getNotices()).toHaveLength(0);

    // But a peer joining AFTER the quiet window DOES trigger a notice
    manager.handlePeerJoin({
      id: 'late-peer-2',
      name: 'Solar Hawk',
      color: '#10b981',
      emoji: '🦅',
    });

    expect(manager.getNotices()).toHaveLength(1);
    expect(manager.getNotices()[0].peerId).toBe('late-peer-2');
  });

  it('waits for persona update before emitting join notice', () => {
    const manager = new RoomNoticeManager({ quietPeriodMs: 1000 });
    vi.advanceTimersByTime(1001);

    // Step 1: Raw connection without name
    manager.handlePeerJoin({ id: 'peer-async' });
    expect(manager.getNotices()).toHaveLength(0);

    // Step 2: 150ms later persona arrives
    vi.advanceTimersByTime(150);
    manager.handlePeerJoin({
      id: 'peer-async',
      name: 'Nebula Owl',
      emoji: '🦉',
      color: '#8b5cf6',
    });

    expect(manager.getNotices()).toHaveLength(1);
    expect(manager.getNotices()[0]).toMatchObject({
      kind: 'join',
      peerId: 'peer-async',
      personaName: 'Nebula Owl',
      personaEmoji: '🦉',
    });

    // Advance past persona timeout, ensure no duplicate notice is emitted
    vi.advanceTimersByTime(2000);
    expect(manager.getNotices()).toHaveLength(1);
  });

  it('falls back to peer ID if persona never arrives within timeout', () => {
    const manager = new RoomNoticeManager({
      quietPeriodMs: 1000,
      personaTimeoutMs: 1500,
    });
    vi.advanceTimersByTime(1001);

    manager.handlePeerJoin({ id: 'peer-anonymous' });
    expect(manager.getNotices()).toHaveLength(0);

    // Advance past timeout
    vi.advanceTimersByTime(1501);

    expect(manager.getNotices()).toHaveLength(1);
    expect(manager.getNotices()[0]).toMatchObject({
      kind: 'join',
      peerId: 'peer-anonymous',
      personaName: 'peer-anonymous',
    });
  });

  it('debounces peer leave events by grace period', () => {
    const manager = new RoomNoticeManager({
      quietPeriodMs: 0,
      leaveGracePeriodMs: 5000,
    });

    const peer: PeerInfo = {
      id: 'peer-leaving',
      name: 'Drifting Comet',
      emoji: '☄️',
      color: '#ec4899',
    };

    manager.handlePeerJoin(peer);
    expect(manager.getNotices()).toHaveLength(1); // join notice

    // Peer leaves
    manager.handlePeerLeave('peer-leaving');

    // Not emitted immediately
    expect(manager.getNotices()).toHaveLength(1);

    // 4.9 seconds later: still waiting
    vi.advanceTimersByTime(4900);
    expect(manager.getNotices()).toHaveLength(1);

    // 5.1 seconds: leave notice emitted
    vi.advanceTimersByTime(200);
    const notices = manager.getNotices();
    expect(notices).toHaveLength(2);
    expect(notices[1]).toMatchObject({
      kind: 'leave',
      peerId: 'peer-leaving',
      personaName: 'Drifting Comet',
      personaEmoji: '☄️',
    });
  });

  it('cancels pending leave notice when peer reconnects within grace period', () => {
    const manager = new RoomNoticeManager({
      quietPeriodMs: 0,
      leaveGracePeriodMs: 5000,
    });

    const peer: PeerInfo = {
      id: 'peer-flapping',
      name: 'Flapping Falcon',
      emoji: '🦅',
    };

    manager.handlePeerJoin(peer);
    expect(manager.getNotices()).toHaveLength(1); // initial join

    // Peer disconnects
    manager.handlePeerLeave('peer-flapping');

    // 2 seconds later, peer reconnects
    vi.advanceTimersByTime(2000);
    manager.handlePeerJoin(peer);

    // Advance past original 5s grace period
    vi.advanceTimersByTime(4000);

    // Notice count should still be 1 (only the initial join notice, no leave notice)
    expect(manager.getNotices()).toHaveLength(1);
    expect(manager.getNotices()[0].kind).toBe('join');
  });

  it('notifies subscribers and supports unsubscribe and reset', () => {
    const manager = new RoomNoticeManager({ quietPeriodMs: 0 });
    const subscriber = vi.fn();
    const unsub = manager.subscribe(subscriber);

    expect(subscriber).toHaveBeenCalledWith([]);

    manager.handlePeerJoin({ id: 'p1', name: 'Alpha' });
    expect(subscriber).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ peerId: 'p1', personaName: 'Alpha' })]),
    );

    manager.reset();
    expect(manager.getNotices()).toHaveLength(0);
    expect(subscriber).toHaveBeenLastCalledWith([]);

    unsub();
    manager.handlePeerJoin({ id: 'p2', name: 'Beta' });
    // Subscriber should not be called after unsub
    expect(subscriber).toHaveBeenCalledTimes(3);
  });
});
