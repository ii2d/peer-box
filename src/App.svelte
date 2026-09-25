<script lang="ts">
  import { onMount } from 'svelte';
  import { generateRoomName, sanitizeRoomName } from './lib/room/name-generator';
  import { buildRoomUrl, parseRoomLocation } from './lib/room/url';
  import { InMemoryTransport } from './lib/transport/in-memory-transport';
  import type { RoomTransport } from './lib/transport/types';

  interface Props {
    transport?: RoomTransport;
  }

  let { transport = new InMemoryTransport() }: Props = $props();

  let currentRoomId = $state<string | null>(null);
  let currentRoomKey = $state<string | null>(null);
  let inputRoomName = $state('');
  let inputRoomKey = $state('');
  let errorMessage = $state<string | null>(null);

  onMount(() => {
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

    if (updateHistory && typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
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
          <span class="room-tag">Room</span>
          <h2 class="room-title" data-testid="current-room-name">{currentRoomId}</h2>
          {#if currentRoomKey}
            <span class="badge badge-encrypted">🔒 Protected</span>
          {:else}
            <span class="badge badge-open">🌐 Open</span>
          {/if}
        </div>

        <button
          type="button"
          class="btn-secondary btn-leave"
          data-testid="leave-btn"
          onclick={() => leave(true)}
        >
          Leave Room
        </button>
      </div>

      <div class="room-body">
        <div class="waiting-card">
          <p class="waiting-title">Connected to room</p>
          <p class="waiting-subtitle">
            Invite peers to this room to start chatting and transferring files.
          </p>
        </div>
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
    margin-bottom: 1.5rem;
  }

  .room-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    padding: 0.2rem 0.5rem;
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

  .waiting-card {
    text-align: center;
    padding: 3rem 1.5rem;
    background: rgba(15, 23, 42, 0.4);
    border: 1px dashed var(--card-border);
    border-radius: 0.75rem;
  }

  .waiting-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .waiting-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
</style>
