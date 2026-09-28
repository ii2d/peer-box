<script lang="ts">
  import type { PeerInfo } from '../transport/types';

  interface Props {
    roomId?: string | null;
    peersCount: number;
    selectedRecipientId: string;
    connectedPeers: PeerInfo[];
    onToggleMobileRoster: () => void;
    onResetRecipient: () => void;
    onOpenTrustModal: () => void;
    onOpenShareModal: () => void;
  }

  const {
    roomId = '',
    peersCount,
    selectedRecipientId,
    connectedPeers,
    onToggleMobileRoster,
    onResetRecipient,
    onOpenTrustModal,
    onOpenShareModal,
  }: Props = $props();

  const targetPeer = $derived(
    selectedRecipientId !== 'everyone'
      ? connectedPeers.find((p) => p.id === selectedRecipientId) || null
      : null,
  );
</script>

<header class="workspace-header">
  <div class="workspace-header-left">
    <button
      type="button"
      class="btn-roster-toggle"
      data-testid="roster-toggle-btn"
      onclick={onToggleMobileRoster}
      aria-label="Toggle peers roster"
    >
      <span class="roster-toggle-icon">👥</span>
      <span class="roster-toggle-label">Peers</span>
      <span class="roster-toggle-count">({peersCount})</span>
    </button>

    <div class="workspace-room-heading">
      <span class="room-hash" aria-hidden="true">#</span>
      <h2 class="workspace-room-title" data-testid="current-room-name" title={roomId}>{roomId}</h2>
    </div>

    <!-- Recipient Indicator (Rendered and visible across desktop and mobile) -->
    <div class="workspace-recipient-badge">
      {#if selectedRecipientId !== 'everyone'}
        <div class="recipient-indicator recipient-whispering" data-testid="recipient-indicator">
          <span class="indicator-icon">🔒</span>
          <span class="indicator-label"
            >Whispering to <strong>{targetPeer?.name || selectedRecipientId}</strong></span
          >
          <button
            type="button"
            class="btn-reset-recipient"
            data-testid="reset-recipient-btn"
            onclick={onResetRecipient}
            title="Switch to Everyone"
            aria-label="Switch recipient to everyone"
          >
            ✕
          </button>
        </div>
      {:else}
        <div class="recipient-indicator indicator-everyone" data-testid="recipient-indicator">
          <span class="indicator-icon">🌐</span>
          <span class="indicator-label">Talking to <strong>Everyone</strong></span>
        </div>
      {/if}
    </div>
  </div>

  <div class="workspace-header-actions">
    <button
      type="button"
      class="btn-secondary btn-trust"
      data-testid="trust-guarantee-btn"
      onclick={onOpenTrustModal}
      title="View PeerBox Trust Guarantee & Privacy Assurances"
      aria-label="View PeerBox Trust Guarantee & Privacy Assurances"
    >
      <span class="btn-icon">🛡️</span>
      <span class="btn-label-desktop">Private & Ephemeral</span>
      <span class="btn-label-mobile">Ephemeral</span>
    </button>

    <button
      type="button"
      class="btn-secondary btn-share"
      data-testid="share-room-btn"
      onclick={onOpenShareModal}
      title="Share room link or QR code"
      aria-label="Share room link or QR code"
    >
      <span class="btn-icon">🔗</span>
      <span class="btn-label">Share</span>
    </button>
  </div>
</header>

<style>
  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--card-border);
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    flex-shrink: 0;
    gap: 0.75rem;
    position: relative;
    z-index: 10;
  }

  .workspace-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1 1 auto;
  }

  .btn-roster-toggle {
    display: none;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.4rem 0.65rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 0.5rem;
    color: #a5b4fc;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    align-items: center;
    gap: 0.35rem;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .btn-roster-toggle:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
    color: #ffffff;
  }

  .workspace-room-heading {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    flex-shrink: 1;
  }

  .room-hash {
    color: var(--primary);
    font-weight: 700;
    font-size: 1rem;
    opacity: 0.7;
    user-select: none;
  }

  .workspace-room-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .workspace-recipient-badge {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .recipient-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 9999px;
    padding: 0.25rem 0.65rem;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .recipient-whispering {
    background: rgba(236, 72, 153, 0.12);
    border-color: rgba(236, 72, 153, 0.35);
    color: #f472b6;
  }

  .recipient-whispering strong {
    color: #fbcfe8;
  }

  .recipient-indicator strong {
    color: #ffffff;
  }

  .btn-reset-recipient {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0 0.15rem;
    font-size: 0.75rem;
    line-height: 1;
    font-family: inherit;
    opacity: 0.7;
    transition: opacity 0.15s;
    margin-left: 0.15rem;
  }

  .btn-reset-recipient:hover {
    opacity: 1;
  }

  .workspace-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-secondary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.45rem 0.8rem;
    border-radius: 0.5rem;
    border: 1px solid var(--card-border);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    transition: all 0.15s ease;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-label-mobile {
    display: none;
  }

  @media (max-width: 890px) {
    .btn-label-desktop {
      display: none;
    }
    .btn-label-mobile {
      display: inline;
    }
  }

  @media (max-width: 767px) {
    .workspace-header {
      padding: 0.55rem 0.75rem;
      gap: 0.5rem;
    }

    .workspace-header-left {
      gap: 0.5rem;
    }

    .btn-roster-toggle {
      display: inline-flex;
      padding: 0.35rem 0.55rem;
      font-size: 0.75rem;
    }

    .workspace-room-title {
      font-size: 0.9375rem;
      max-width: 110px;
    }

    .indicator-everyone {
      display: none;
    }

    .recipient-whispering {
      padding: 0.2rem 0.45rem;
      font-size: 0.6875rem;
    }

    .btn-secondary {
      padding: 0.35rem 0.6rem;
      font-size: 0.75rem;
    }
  }

  @media (max-width: 520px) {
    .roster-toggle-label {
      display: none;
    }

    .btn-trust .btn-label-mobile,
    .btn-share .btn-label {
      display: none;
    }

    .btn-secondary {
      padding: 0.35rem 0.5rem;
    }
  }
</style>
