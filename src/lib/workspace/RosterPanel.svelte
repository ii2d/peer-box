<script lang="ts">
  import ConnectionBadge from '../diagnostics/ConnectionBadge.svelte';
  import type { Persona } from '../persona/persona';
  import { buildRoomUrl } from '../room/url';
  import type { PeerConnectionStats, PeerInfo } from '../transport/types';

  interface Props {
    roomId?: string | null;
    roomKey?: string | null;
    persona: Persona;
    connectedPeers: PeerInfo[];
    peerStats: Record<string, PeerConnectionStats>;
    selectedRecipientId: string;
    isPersisted: boolean;
    isMobileOpen: boolean;
    onEditPersona: () => void;
    onChangeKey: () => void;
    onSelectRecipient: (id: string) => void;
    onOpenDiagnostics: (peerId: string) => void;
    onTogglePersistence: () => void;
    onLeave: () => void;
  }

  const {
    roomId = '',
    roomKey = null,
    persona,
    connectedPeers,
    peerStats,
    selectedRecipientId,
    isPersisted,
    isMobileOpen,
    onEditPersona,
    onChangeKey,
    onSelectRecipient,
    onOpenDiagnostics,
    onTogglePersistence,
    onLeave,
  }: Props = $props();

  let isRoomLinkCopied = $state(false);
  let roomLinkCopyTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copyRoomLink() {
    if (!roomId || typeof window === 'undefined') return;
    const baseUrl = window.location.origin;
    const path = buildRoomUrl(roomId, {
      roomKey,
      includeKey: !!roomKey,
    });
    const shareUrl = `${baseUrl}${path}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      isRoomLinkCopied = true;
      if (roomLinkCopyTimeout) clearTimeout(roomLinkCopyTimeout);
      roomLinkCopyTimeout = setTimeout(() => {
        isRoomLinkCopied = false;
      }, 2000);
    } catch {
      // Fallback
    }
  }
</script>

<aside class="roster-panel" data-testid="roster-panel" class:mobile-open={isMobileOpen}>
  <div class="roster-header">
    <div class="roster-brand">
      <span class="roster-logo">📦</span>
      <span class="roster-brand-title">PeerBox</span>
    </div>

    <div class="roster-room-info">
      <div class="roster-room-meta">
        <span class="roster-room-label">ROOM</span>
        <span class="roster-room-name" data-testid="roster-room-name">{roomId}</span>
      </div>
      <button
        type="button"
        class="btn-copy-link"
        data-testid="roster-copy-link-btn"
        onclick={copyRoomLink}
        title="Copy 1-click room link"
      >
        {isRoomLinkCopied ? '✓ Copied' : '📋 Copy Link'}
      </button>
    </div>

    <div class="roster-key-status">
      {#if roomKey}
        <span class="badge badge-encrypted">🔒 Protected</span>
      {:else}
        <span class="badge badge-open">🌐 Open</span>
      {/if}
      <button
        type="button"
        class="btn-change-key"
        data-testid="change-key-btn"
        onclick={onChangeKey}
        title="Change Room Key"
      >
        Key Settings
      </button>
    </div>
  </div>

  <!-- Persona Section -->
  <div class="roster-persona-section">
    <button
      type="button"
      class="persona-badge"
      data-testid="persona-badge"
      onclick={onEditPersona}
      title="Click to customize nickname"
    >
      <span class="persona-avatar" style:background-color={persona.color}>
        {persona.emoji}
      </span>
      <div class="persona-info">
        <span class="persona-name">{persona.name}</span>
        <span class="persona-role">You (Click to edit)</span>
      </div>
      <span class="persona-edit-icon">✏️</span>
    </button>
  </div>

  <!-- Connected Peers Presence List -->
  <div class="roster-peers-section" data-testid="presence-bar">
    <div class="roster-section-header">
      <span class="roster-section-title">Connected Peers</span>
      <span class="presence-count">{connectedPeers.length + 1}</span>
    </div>

    <div class="roster-peers-list">
      <!-- Everyone (Broadcast target) -->
      <button
        type="button"
        class="roster-peer-row roster-broadcast-row"
        class:selected={selectedRecipientId === 'everyone'}
        onclick={() => onSelectRecipient('everyone')}
        title="Broadcast message to everyone in the room"
      >
        <div class="roster-peer-info">
          <span class="peer-dot peer-dot-everyone">🌐</span>
          <span class="peer-name">Everyone</span>
        </div>
        {#if selectedRecipientId === 'everyone'}
          <span class="whisper-tag">Active</span>
        {/if}
      </button>

      <!-- Remote Connected Peers -->
      {#each connectedPeers as peer (peer.id)}
        <div
          class="roster-peer-row"
          data-testid="peer-item"
          class:selected={selectedRecipientId === peer.id}
        >
          <button
            type="button"
            class="roster-peer-btn"
            onclick={() => onSelectRecipient(peer.id)}
            title={`Direct whisper to ${peer.name || peer.id}`}
          >
            <span class="peer-dot" style:background-color={peer.color || 'var(--primary)'}></span>
            <span class="peer-name">{peer.name || peer.id}</span>
            {#if selectedRecipientId === peer.id}
              <span class="whisper-tag">Whisper</span>
            {/if}
          </button>
          <ConnectionBadge stats={peerStats[peer.id]} onClick={() => onOpenDiagnostics(peer.id)} />
        </div>
      {/each}

      {#if connectedPeers.length === 0}
        <div class="roster-alone-hint">
          <span>Waiting for peers to join...</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Roster Footer Actions -->
  <div class="roster-footer">
    <button
      type="button"
      class="btn-secondary btn-persist"
      data-testid="persist-toggle-btn"
      onclick={onTogglePersistence}
      title={isPersisted
        ? 'Local chat persistence is ON (Saved in browser)'
        : 'Chat is ephemeral (Memory only)'}
    >
      {isPersisted ? '💾 Persist: On' : '🧹 Ephemeral'}
    </button>

    <button
      type="button"
      class="btn-secondary btn-leave"
      data-testid="leave-btn"
      onclick={onLeave}
      title="Leave this room and return to portal"
    >
      🚪 Leave Room
    </button>
  </div>
</aside>

<style>
  .roster-panel {
    width: 280px;
    min-width: 280px;
    max-width: 280px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-right: 1px solid var(--card-border);
    z-index: 20;
    flex-shrink: 0;
  }

  .roster-header {
    padding: 1.25rem 1rem 1rem 1rem;
    border-bottom: 1px solid var(--card-border);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .roster-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .roster-logo {
    font-size: 1.25rem;
  }

  .roster-brand-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .roster-room-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--card-border);
    border-radius: 0.625rem;
    padding: 0.45rem 0.65rem;
  }

  .roster-room-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .roster-room-label {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .roster-room-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .btn-copy-link {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--card-border);
    border-radius: 0.375rem;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn-copy-link:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .roster-key-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .btn-change-key {
    font-size: 0.6875rem;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    font-family: inherit;
    padding: 0.2rem 0;
  }

  .btn-change-key:hover {
    color: var(--text-main);
  }

  /* Roster Persona */
  .roster-persona-section {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--card-border);
  }

  .persona-badge {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 0.75rem;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    text-align: left;
  }

  .persona-badge:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .persona-avatar {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 1.05rem;
    flex-shrink: 0;
  }

  .persona-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .persona-name {
    font-weight: 600;
    font-size: 0.8125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .persona-role {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .persona-edit-icon {
    font-size: 0.75rem;
    opacity: 0.6;
    flex-shrink: 0;
  }

  /* Roster Peers Presence Section */
  .roster-peers-section {
    flex: 1 1 0%;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .roster-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .presence-count {
    color: var(--primary);
    font-weight: 700;
    background: rgba(99, 102, 241, 0.15);
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
  }

  .roster-peers-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .roster-peer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.65rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    transition: all 0.15s;
    gap: 0.5rem;
  }

  .roster-peer-row:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .roster-peer-row.selected {
    background: rgba(99, 102, 241, 0.18);
    border-color: rgba(99, 102, 241, 0.45);
  }

  .roster-broadcast-row {
    width: 100%;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    color: var(--text-main);
  }

  .roster-peer-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .roster-peer-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 0.8125rem;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0;
  }

  .peer-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .peer-dot-everyone {
    font-size: 0.875rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  .peer-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .whisper-tag {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.25);
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }

  .roster-alone-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.75rem 0.5rem;
    text-align: center;
    font-style: italic;
  }

  /* Roster Footer */
  .roster-footer {
    padding: 0.875rem 1rem;
    border-top: 1px solid var(--card-border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn-persist,
  .btn-leave {
    width: 100%;
    text-align: center;
    justify-content: center;
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

  .btn-leave {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .btn-leave:hover {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(239, 68, 68, 0.45);
  }

  .badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }

  .badge-encrypted {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .badge-open {
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  @media (max-width: 767px) {
    .roster-panel {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 280px;
      max-width: 82vw;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .roster-panel.mobile-open {
      transform: translateX(0);
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.85);
    }
  }
</style>
