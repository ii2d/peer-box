<script lang="ts">
  import type { PeerConnectionStats } from '../transport/types';

  interface Props {
    peerName: string;
    peerEmoji?: string;
    peerColor?: string;
    stats: PeerConnectionStats;
    onClose: () => void;
  }

  const { peerName, peerEmoji = '👤', peerColor = '#6366f1', stats, onClose }: Props = $props();

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="diagnostics-overlay" onclick={handleOverlayClick} role="presentation">
  <div
    class="diagnostics-drawer"
    data-testid="diagnostics-drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="drawer-title"
  >
    <div class="drawer-header">
      <div class="peer-identity">
        <span class="peer-avatar" style="background: {peerColor};">
          {peerEmoji}
        </span>
        <div>
          <h3 id="drawer-title" class="peer-title">{peerName}</h3>
          <span class="peer-subtitle">WebRTC Connection & ICE Diagnostics</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        onclick={onClose}
        data-testid="close-diagnostics-btn"
        aria-label="Close diagnostics"
      >
        ✕
      </button>
    </div>

    <div class="drawer-body">
      {#if stats.connectionState === 'failed' || stats.connectionState === 'disconnected'}
        <div class="failure-alert" role="alert">
          <div class="failure-icon">⚠️</div>
          <div class="failure-text">
            <strong>Direct Connection Failed (Symmetric NAT Firewall)</strong>
            <p>
              PeerBox operates on a strict Zero-TURN architecture without relay servers. A symmetric
              NAT firewall between you and this peer blocked direct STUN/ICE traversal.
            </p>
          </div>
        </div>
      {/if}

      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">Round-Trip Latency</span>
          <span class="metric-val">{stats.roundTripTimeMs}ms</span>
          <span class="metric-sub">
            {stats.roundTripTimeMs < 30
              ? 'Excellent'
              : stats.roundTripTimeMs < 100
                ? 'Good'
                : 'Fair'}
          </span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Connection Type</span>
          <span class="metric-val">
            {stats.candidateType === 'host' ? '⚡ Direct LAN' : '🌐 Direct P2P'}
          </span>
          <span class="metric-sub">
            {stats.candidateType === 'host' ? 'Local host candidate' : 'Public STUN srflx'}
          </span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Protocol</span>
          <span class="metric-val">{stats.protocol?.toUpperCase() || 'UDP'}</span>
          <span class="metric-sub">WebRTC DataChannel</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Packet Loss</span>
          <span class="metric-val">{stats.packetsLost || 0}</span>
          <span class="metric-sub">Packets dropped</span>
        </div>
      </div>

      <div class="candidates-table-wrap">
        <h4 class="section-title">ICE Candidate Pair</h4>
        <div class="candidates-table">
          <div class="candidate-row">
            <span class="cand-type">Local Candidate:</span>
            <span class="cand-val font-mono">{stats.localCandidateType || stats.candidateType}</span
            >
          </div>
          <div class="candidate-row">
            <span class="cand-type">Remote Candidate:</span>
            <span class="cand-val font-mono"
              >{stats.remoteCandidateType || stats.candidateType}</span
            >
          </div>
          <div class="candidate-row">
            <span class="cand-type">ICE State:</span>
            <span class="cand-val capitalize font-mono">{stats.connectionState}</span>
          </div>
        </div>
      </div>

      <div class="architecture-notices">
        <div class="notice-card">
          <span class="notice-tag">🛡️ Zero-TURN Architecture</span>
          <p class="notice-text">
            PeerBox does not operate or configure TURN relay servers (ADR-0001). Traffic flows
            directly peer-to-peer. No intermediate server relays, caches, or inspects your files or
            messages.
          </p>
        </div>

        <div class="notice-card">
          <span class="notice-tag">👁️ WebRTC IP Disclosure</span>
          <p class="notice-text">
            Direct peer-to-peer WebRTC connections inherently exchange public network IP addresses
            between peers in the same room (ADR-0004). Use a VPN if you require IP address masking.
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .diagnostics-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .diagnostics-drawer {
    width: 100%;
    max-width: 480px;
    height: 100vh;
    background: #0f172a;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .peer-identity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .peer-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .peer-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f8fafc;
  }

  .peer-subtitle {
    font-size: 11px;
    color: #94a3b8;
  }

  .btn-close {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .drawer-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .failure-alert {
    display: flex;
    gap: 12px;
    padding: 14px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 12px;
  }

  .failure-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .failure-text p {
    margin: 4px 0 0;
    color: #f87171;
    line-height: 1.4;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .metric-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .metric-val {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .metric-sub {
    font-size: 10px;
    color: #64748b;
  }

  .section-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .candidates-table {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .candidate-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .cand-type {
    color: #94a3b8;
  }

  .cand-val {
    color: #38bdf8;
  }

  .font-mono {
    font-family: monospace;
  }

  .capitalize {
    text-transform: capitalize;
  }

  .architecture-notices {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .notice-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px;
  }

  .notice-tag {
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
    display: block;
    margin-bottom: 6px;
  }

  .notice-text {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: #94a3b8;
  }
</style>
