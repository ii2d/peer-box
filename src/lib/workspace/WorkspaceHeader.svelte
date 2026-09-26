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
      👥 Peers ({peersCount})
    </button>

    <div class="workspace-room-heading">
      <h2 class="workspace-room-title" data-testid="current-room-name">{roomId}</h2>
    </div>

    <!-- Recipient Indicator -->
    <div class="workspace-recipient-badge">
      {#if selectedRecipientId !== 'everyone'}
        <div class="recipient-indicator" data-testid="recipient-indicator">
          <span class="indicator-icon">🔒</span>
          <span>Whispering to <strong>{targetPeer?.name || selectedRecipientId}</strong></span>
          <button
            type="button"
            class="btn-reset-recipient"
            data-testid="reset-recipient-btn"
            onclick={onResetRecipient}
            title="Switch to Everyone"
          >
            ✕
          </button>
        </div>
      {:else}
        <div class="recipient-indicator indicator-everyone">
          <span class="indicator-icon">🌐</span>
          <span>Talking to <strong>Everyone</strong></span>
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
    >
      🛡️ Private & Ephemeral
    </button>

    <button
      type="button"
      class="btn-secondary btn-share"
      data-testid="share-room-btn"
      onclick={onOpenShareModal}
      title="Share room link or QR code"
    >
      🔗 Share
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
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    flex-shrink: 0;
    gap: 1rem;
  }

  .workspace-header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-width: 0;
  }

  .btn-roster-toggle {
    display: none;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 0.5rem;
    color: #a5b4fc;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .workspace-room-heading {
    display: flex;
    align-items: center;
    min-width: 0;
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
  }

  .recipient-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 9999px;
    padding: 0.2rem 0.6rem;
    white-space: nowrap;
  }

  .recipient-indicator strong {
    color: #ffffff;
  }

  .btn-reset-recipient {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0 0.15rem;
    font-size: 0.75rem;
    line-height: 1;
    font-family: inherit;
  }

  .btn-reset-recipient:hover {
    color: #ffffff;
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
    padding: 0.5rem 0.875rem;
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
  }

  @media (max-width: 767px) {
    .workspace-header {
      padding: 0.65rem 1rem;
    }

    .btn-roster-toggle {
      display: inline-flex;
    }

    .workspace-recipient-badge {
      display: none;
    }
  }
</style>
