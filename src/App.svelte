<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { generatePersona, setStoredNickname, type Persona } from './lib/persona/persona';
  import { generateRoomName, sanitizeRoomName } from './lib/room/name-generator';
  import { buildRoomUrl, parseRoomLocation } from './lib/room/url';
  import { InMemoryTransport } from './lib/transport/in-memory-transport';
  import type { PeerInfo, RoomTransport } from './lib/transport/types';

  interface Props {
    transport?: RoomTransport;
  }

  let { transport = new InMemoryTransport() }: Props = $props();

  let currentRoomId = $state<string | null>(null);
  let currentRoomKey = $state<string | null>(null);
  let inputRoomName = $state('');
  let inputRoomKey = $state('');
  let errorMessage = $state<string | null>(null);

  // Persona State
  let localPersona = $state<Persona>(generatePersona());
  let isEditingNickname = $state(false);
  let editNicknameValue = $state('');

  // Presence State
  let connectedPeers = $state<PeerInfo[]>([]);
  let isAloneDiagnosticVisible = $state(false);
  let aloneTimer: ReturnType<typeof setTimeout> | null = null;

  // Change Key Modal
  let isChangingKey = $state(false);
  let newKeyInput = $state('');

  let unsubs: Array<() => void> = [];

  onMount(() => {
    unsubs.push(
      transport.onPeerJoin((peer) => {
        const existingIdx = connectedPeers.findIndex((p) => p.id === peer.id);
        if (existingIdx >= 0) {
          connectedPeers[existingIdx] = peer;
        } else {
          connectedPeers = [...connectedPeers, peer];
        }
        resetAloneTimer();
      }),
    );

    unsubs.push(
      transport.onPeerLeave((peerId) => {
        connectedPeers = connectedPeers.filter((p) => p.id !== peerId);
        if (connectedPeers.length === 0) {
          startAloneTimer();
        }
      }),
    );

    if (typeof window !== 'undefined') {
      const loc = parseRoomLocation(window.location);
      if (loc.roomId) {
        join(loc.roomId, loc.roomKey);
      }

      const handlePopState = () => {
        const updated = parseRoomLocation(window.location);
        if (updated.roomId) {
          join(updated.roomId, updated.roomKey, false);
        } else {
          leave(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  });

  onDestroy(() => {
    for (const u of unsubs) u();
    if (aloneTimer) clearTimeout(aloneTimer);
  });

  function startAloneTimer() {
    if (aloneTimer) clearTimeout(aloneTimer);
    isAloneDiagnosticVisible = false;
    aloneTimer = setTimeout(() => {
      if (connectedPeers.length === 0 && currentRoomId) {
        isAloneDiagnosticVisible = true;
      }
    }, 10000);
  }

  function resetAloneTimer() {
    if (aloneTimer) {
      clearTimeout(aloneTimer);
      aloneTimer = null;
    }
    isAloneDiagnosticVisible = false;
  }

  function handleRandomName() {
    inputRoomName = generateRoomName();
    errorMessage = null;
  }

  async function handleJoinSubmit(e: SubmitEvent) {
    e.preventDefault();
    const clean = sanitizeRoomName(inputRoomName);
    if (!clean) {
      errorMessage = 'Please enter or generate a room name.';
      return;
    }
    errorMessage = null;
    await join(clean, inputRoomKey || null, true);
  }

  async function join(roomId: string, roomKey: string | null, updateHistory = true) {
    try {
      await transport.joinRoom({ roomId, roomKey });
      currentRoomId = roomId;
      currentRoomKey = roomKey;
      connectedPeers = transport.getPeers();

      if (connectedPeers.length === 0) {
        startAloneTimer();
      } else {
        resetAloneTimer();
      }

      if (updateHistory && typeof window !== 'undefined') {
        const newUrl = buildRoomUrl(roomId, { roomKey, includeKey: !!roomKey });
        window.history.pushState({ roomId, roomKey }, '', newUrl);
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : 'Failed to join room';
    }
  }

  function leave(updateHistory = true) {
    transport.leaveRoom();
    currentRoomId = null;
    currentRoomKey = null;
    inputRoomName = '';
    inputRoomKey = '';
    errorMessage = null;
    connectedPeers = [];
    resetAloneTimer();

    if (updateHistory && typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  }

  function startEditingNickname() {
    editNicknameValue = localPersona.name;
    isEditingNickname = true;
  }

  function saveNickname() {
    const clean = editNicknameValue.trim();
    if (clean) {
      setStoredNickname(clean);
      localPersona = {
        ...localPersona,
        name: clean,
      };
      const customTransport = transport as unknown as { setPersona?: (p: Persona) => void };
      if (typeof customTransport.setPersona === 'function') {
        customTransport.setPersona(localPersona);
      }
    }
    isEditingNickname = false;
  }

  function cancelEditingNickname() {
    isEditingNickname = false;
  }

  function openChangeKeyModal() {
    newKeyInput = currentRoomKey || '';
    isChangingKey = true;
  }

  async function saveNewKey() {
    if (!currentRoomId) return;
    const updatedKey = newKeyInput.trim() || null;
    isChangingKey = false;
    await join(currentRoomId, updatedKey, true);
  }
</script>

<main class="container">
  {#if !currentRoomId}
    <div class="card landing-card">
      <div class="header">
        <div class="logo-badge">
          <span class="logo-icon">📦</span>
          <span class="logo-text">Peer-to-Peer</span>
        </div>
        <h1 class="title">PeerBox</h1>
        <p class="subtitle">
          Direct, encrypted browser-to-browser rooms. Zero servers, zero uploads, zero tracking.
        </p>
      </div>

      <form class="join-form" onsubmit={handleJoinSubmit}>
        <div class="form-group">
          <label for="room-name">Room Name</label>
          <div class="input-with-action">
            <input
              id="room-name"
              data-testid="room-input"
              type="text"
              placeholder="e.g. cute-dog"
              bind:value={inputRoomName}
              autocomplete="off"
              spellcheck="false"
            />
            <button
              type="button"
              class="btn-secondary btn-icon"
              data-testid="random-btn"
              onclick={handleRandomName}
              title="Generate Random Name"
            >
              🎲 Random
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="room-key">
            Room Key <span class="label-optional">(optional secret)</span>
          </label>
          <input
            id="room-key"
            data-testid="key-input"
            type="password"
            placeholder="Derives client-side AES-GCM encryption key"
            bind:value={inputRoomKey}
            autocomplete="new-password"
          />
        </div>

        {#if errorMessage}
          <div class="error-banner" data-testid="error-banner">
            {errorMessage}
          </div>
        {/if}

        <button type="submit" class="btn-primary btn-block" data-testid="join-btn">
          Join Room
        </button>
      </form>

      <div class="trust-chips">
        <span class="trust-chip">🔒 End-to-End Encrypted</span>
        <span class="trust-chip">⚡ Direct P2P (No Servers)</span>
        <span class="trust-chip">🧹 Zero Logs & Cookies</span>
      </div>
    </div>
  {:else}
    <div class="card room-card" data-testid="room-view">
      <div class="room-header">
        <div class="room-meta">
          <div class="room-info">
            <div class="room-tag-row">
              <span class="room-tag">Room</span>
              {#if currentRoomKey}
                <span class="badge badge-encrypted">🔒 Protected</span>
              {:else}
                <span class="badge badge-open">🌐 Open</span>
              {/if}
            </div>
            <h2 class="room-title" data-testid="current-room-name">{currentRoomId}</h2>
          </div>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="persona-badge"
            data-testid="persona-badge"
            onclick={startEditingNickname}
            title="Click to customize nickname"
          >
            <span class="persona-avatar" style:background-color={localPersona.color}>
              {localPersona.emoji}
            </span>
            <span class="persona-name">{localPersona.name}</span>
            <span class="persona-edit-icon">✏️</span>
          </button>

          <button
            type="button"
            class="btn-secondary btn-leave"
            data-testid="leave-btn"
            onclick={() => leave(true)}
          >
            Leave
          </button>
        </div>
      </div>

      <!-- Nickname Edit Modal / Popover -->
      {#if isEditingNickname}
        <div class="edit-modal-backdrop">
          <div class="edit-modal">
            <h3>Edit Your Nickname</h3>
            <p class="modal-hint">This nickname will be visible to other peers in the room.</p>
            <input
              type="text"
              data-testid="nickname-edit-input"
              bind:value={editNicknameValue}
              placeholder="e.g. Swift Panda"
              maxlength="32"
            />
            <div class="modal-buttons">
              <button
                type="button"
                class="btn-secondary"
                data-testid="nickname-cancel-btn"
                onclick={cancelEditingNickname}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn-primary"
                data-testid="nickname-save-btn"
                onclick={saveNickname}
              >
                Save Nickname
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Change Room Key Modal -->
      {#if isChangingKey}
        <div class="edit-modal-backdrop">
          <div class="edit-modal">
            <h3>Change Room Key</h3>
            <p class="modal-hint">
              Enter the exact secret key used by other peers to connect to this room.
            </p>
            <input
              type="password"
              data-testid="change-key-input"
              bind:value={newKeyInput}
              placeholder="Room Key"
            />
            <div class="modal-buttons">
              <button type="button" class="btn-secondary" onclick={() => (isChangingKey = false)}>
                Cancel
              </button>
              <button
                type="button"
                class="btn-primary"
                data-testid="save-new-key-btn"
                onclick={saveNewKey}
              >
                Update Key
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Alone / Mismatch Diagnostic Banner -->
      {#if isAloneDiagnosticVisible}
        <div class="diagnostic-banner" data-testid="alone-diagnostic">
          <div class="diagnostic-content">
            <span class="diagnostic-icon">ℹ️</span>
            <div>
              <strong>Waiting for peers to join...</strong>
              <p>If this room is protected, ensure other peers have the exact matching Room Key.</p>
            </div>
          </div>
          <button
            type="button"
            class="btn-secondary btn-sm"
            data-testid="change-key-btn"
            onclick={openChangeKeyModal}
          >
            Change Room Key
          </button>
        </div>
      {/if}

      <!-- In-Room Peer List Bar -->
      <div class="presence-bar" data-testid="presence-bar">
        <span class="presence-count">
          Peers ({connectedPeers.length + 1})
        </span>

        <div class="peers-list">
          <!-- Self -->
          <div class="peer-pill peer-self" title="You">
            <span class="peer-dot" style:background-color={localPersona.color}></span>
            <span class="peer-name">{localPersona.name} (You)</span>
          </div>

          <!-- Connected Peers -->
          {#each connectedPeers as peer (peer.id)}
            <div class="peer-pill" data-testid="peer-item">
              <span class="peer-dot" style:background-color={peer.color || 'var(--primary)'}></span>
              <span class="peer-name">{peer.name || peer.id}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="room-body">
        {#if connectedPeers.length === 0}
          <div class="waiting-card">
            <div class="waiting-pulse"></div>
            <p class="waiting-title">Waiting for peers to connect...</p>
            <p class="waiting-subtitle">
              Share this room URL with someone to begin direct, encrypted messaging and transfers.
            </p>
          </div>
        {:else}
          <div class="chat-placeholder">
            <p class="chat-placeholder-text">
              ✨ Connected to {connectedPeers.length} peer{connectedPeers.length > 1 ? 's' : ''}.
              Ready for real-time messaging.
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>

<style>
  .container {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    backdrop-filter: blur(20px);
    border-radius: 1.25rem;
    padding: 2.5rem;
    width: 100%;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.45),
      0 8px 10px -6px rgba(0, 0, 0, 0.35);
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid var(--badge-border);
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .logo-icon {
    font-size: 1rem;
  }

  .logo-text {
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--badge-text);
  }

  .title {
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
  }

  label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .label-optional {
    color: var(--text-muted);
    font-weight: 400;
  }

  .input-with-action {
    display: flex;
    gap: 0.5rem;
  }

  input[type='text'],
  input[type='password'] {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid var(--card-border);
    border-radius: 0.625rem;
    color: var(--text-main);
    font-size: 0.9375rem;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0.8125rem 1.5rem;
    border-radius: 0.625rem;
    border: none;
    background-color: var(--primary);
    color: #ffffff;
    box-shadow: 0 4px 14px 0 var(--primary-glow);
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid var(--card-border);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .btn-sm {
    font-size: 0.75rem;
    padding: 0.4rem 0.75rem;
  }

  .btn-block {
    width: 100%;
  }

  .error-banner {
    padding: 0.625rem 0.875rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    color: #fca5a5;
    font-size: 0.8125rem;
  }

  .trust-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    border-top: 1px solid var(--card-border);
    padding-top: 1.5rem;
  }

  .trust-chip {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.04);
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
  }

  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--card-border);
    padding-bottom: 1.25rem;
    margin-bottom: 1rem;
  }

  .room-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .room-tag-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .room-tag {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 700;
  }

  .room-title {
    font-size: 1.35rem;
    font-weight: 700;
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .persona-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 9999px;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    font-size: 0.8125rem;
  }

  .persona-badge:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .persona-avatar {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.8125rem;
  }

  .persona-name {
    font-weight: 600;
  }

  .persona-edit-icon {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .diagnostic-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.75rem;
    margin-bottom: 1rem;
    color: #fcd34d;
    font-size: 0.8125rem;
  }

  .diagnostic-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .diagnostic-content p {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  .presence-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--card-border);
    margin-bottom: 1.5rem;
    font-size: 0.8125rem;
  }

  .presence-count {
    color: var(--text-muted);
    font-weight: 600;
  }

  .peers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .peer-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.65rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 9999px;
  }

  .peer-self {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.08);
  }

  .peer-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .peer-name {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .waiting-card {
    text-align: center;
    padding: 3.5rem 1.5rem;
    background: rgba(15, 23, 42, 0.4);
    border: 1px dashed var(--card-border);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .waiting-pulse {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.2);
    border: 2px solid var(--primary);
    margin-bottom: 1.25rem;
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes pulse {
    0% {
      transform: scale(0.9);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5);
    }
    70% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
    }
    100% {
      transform: scale(0.9);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
  }

  .waiting-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .waiting-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    max-width: 400px;
  }

  .chat-placeholder {
    padding: 2.5rem 1.5rem;
    text-align: center;
    background: rgba(15, 23, 42, 0.3);
    border-radius: 0.75rem;
  }

  .chat-placeholder-text {
    color: var(--text-main);
    font-size: 0.875rem;
  }

  .edit-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1.5rem;
  }

  .edit-modal {
    background: #1e293b;
    border: 1px solid var(--card-border);
    border-radius: 1rem;
    padding: 1.75rem;
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .edit-modal h3 {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .modal-hint {
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
