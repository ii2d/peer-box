<script lang="ts">
  import type { PeerConnectionStats } from '../transport/types';

  interface Props {
    stats?: PeerConnectionStats | null;
    onClick?: (peerId: string) => void;
  }

  const { stats = null, onClick }: Props = $props();

  function handleClick(): void {
    if (stats?.peerId) {
      onClick?.(stats.peerId);
    }
  }
</script>

<button
  type="button"
  class="latency-badge {stats?.candidateType || 'connecting'} {stats?.connectionState || ''}"
  onclick={handleClick}
  data-testid="latency-badge"
  title="Click for WebRTC Connection & ICE Diagnostics"
>
  {#if !stats || stats.connectionState === 'connecting'}
    <span class="badge-icon">⏳</span>
    <span class="badge-text">Connecting...</span>
  {:else if stats.connectionState === 'failed' || stats.connectionState === 'disconnected'}
    <span class="badge-icon">❌</span>
    <span class="badge-text">Direct Failed</span>
  {:else if stats.candidateType === 'host'}
    <span class="badge-icon">⚡</span>
    <span class="badge-text">{stats.roundTripTimeMs}ms Direct LAN</span>
  {:else}
    <span class="badge-icon">🌐</span>
    <span class="badge-text">{stats.roundTripTimeMs}ms Direct P2P</span>
  {/if}
</button>

<style>
  .latency-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
    font-variant-numeric: tabular-nums;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    font-family: inherit;
  }

  .latency-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .latency-badge.host {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34d399;
  }

  .latency-badge.host:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  .latency-badge.srflx {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.35);
    color: #60a5fa;
  }

  .latency-badge.srflx:hover {
    background: rgba(59, 130, 246, 0.25);
  }

  .latency-badge.failed {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .badge-icon {
    font-size: 9px;
  }

  .badge-text {
    white-space: nowrap;
  }
</style>
