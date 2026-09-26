import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ConnectionBadge from './ConnectionBadge.svelte';
import type { PeerConnectionStats } from '../transport/types';

describe('ConnectionBadge', () => {
  it('renders Direct LAN for host candidates', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const stats: PeerConnectionStats = {
      peerId: 'peer-1',
      roundTripTimeMs: 12,
      candidateType: 'host',
      connectionState: 'connected',
    };

    const component = mount(ConnectionBadge, {
      target,
      props: { stats, onClick: vi.fn() },
    });

    const badge = target.querySelector('[data-testid="latency-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('12ms');
    expect(badge?.textContent).toContain('Direct LAN');

    unmount(component);
    target.remove();
  });

  it('renders Direct P2P for srflx candidates', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const stats: PeerConnectionStats = {
      peerId: 'peer-2',
      roundTripTimeMs: 65,
      candidateType: 'srflx',
      connectionState: 'connected',
    };

    const component = mount(ConnectionBadge, {
      target,
      props: { stats, onClick: vi.fn() },
    });

    const badge = target.querySelector('[data-testid="latency-badge"]');
    expect(badge?.textContent).toContain('65ms');
    expect(badge?.textContent).toContain('Direct P2P');

    unmount(component);
    target.remove();
  });

  it('triggers onClick callback when badge is clicked', () => {
    const onClick = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const stats: PeerConnectionStats = {
      peerId: 'peer-3',
      roundTripTimeMs: 40,
      candidateType: 'srflx',
      connectionState: 'connected',
    };

    const component = mount(ConnectionBadge, {
      target,
      props: { stats, onClick },
    });

    const badge = target.querySelector<HTMLButtonElement>('[data-testid="latency-badge"]');
    badge?.click();
    flushSync();

    expect(onClick).toHaveBeenCalledWith('peer-3');

    unmount(component);
    target.remove();
  });
});
