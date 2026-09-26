import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DiagnosticsDrawer from './DiagnosticsDrawer.svelte';
import type { PeerConnectionStats } from '../transport/types';

describe('DiagnosticsDrawer', () => {
  const dummyStats: PeerConnectionStats = {
    peerId: 'peer-abc',
    roundTripTimeMs: 18,
    candidateType: 'host',
    localCandidateType: 'host',
    remoteCandidateType: 'host',
    protocol: 'udp',
    packetsLost: 0,
    connectionState: 'connected',
  };

  it('renders peer connection metrics and zero-TURN explainer', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(DiagnosticsDrawer, {
      target,
      props: {
        peerName: 'Sunny Fox',
        peerEmoji: '🦊',
        peerColor: '#f97316',
        stats: dummyStats,
        onClose: vi.fn(),
      },
    });

    expect(target.querySelector('[data-testid="diagnostics-drawer"]')).toBeTruthy();
    expect(target.textContent).toContain('Sunny Fox');
    expect(target.textContent).toContain('18ms');
    expect(target.textContent).toContain('host');
    expect(target.textContent).toContain('Zero-TURN Architecture');
    expect(target.textContent).toContain('WebRTC IP Disclosure');

    unmount(component);
    target.remove();
  });

  it('fires onClose callback when close button clicked', () => {
    const onClose = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(DiagnosticsDrawer, {
      target,
      props: {
        peerName: 'Sunny Fox',
        stats: dummyStats,
        onClose,
      },
    });

    const closeBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="close-diagnostics-btn"]',
    );
    closeBtn?.click();
    flushSync();

    expect(onClose).toHaveBeenCalled();

    unmount(component);
    target.remove();
  });

  it('displays symmetric NAT explanation when connection state is failed', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const failedStats: PeerConnectionStats = {
      peerId: 'peer-fail',
      roundTripTimeMs: 0,
      candidateType: 'srflx',
      connectionState: 'failed',
    };

    const component = mount(DiagnosticsDrawer, {
      target,
      props: {
        peerName: 'Blocked Peer',
        stats: failedStats,
        onClose: vi.fn(),
      },
    });

    expect(target.textContent).toContain('Symmetric NAT');

    unmount(component);
    target.remove();
  });
});
