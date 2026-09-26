<script lang="ts">
  import { encode } from 'uqr';
  import { buildRoomUrl } from '../room/url';

  interface Props {
    roomId: string;
    roomKey?: string | null;
    onClose: () => void;
  }

  const { roomId, roomKey = null, onClose }: Props = $props();

  // svelte-ignore state_referenced_locally
  let includeKey = $state(!!roomKey);
  let isCopied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://peer-box.ii2d.com';

  const shareUrl = $derived.by(() => {
    const shouldInclude = includeKey && !!roomKey;
    return buildRoomUrl(roomId, { origin: baseUrl, roomKey, includeKey: shouldInclude });
  });

  const qrData = $derived.by(() => {
    try {
      return encode(shareUrl);
    } catch {
      return null;
    }
  });

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      isCopied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch {
      // Fallback
    }
  }

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

<div class="modal-backdrop" onclick={handleOverlayClick} role="presentation">
  <div
    class="share-modal"
    data-testid="share-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="share-modal-title"
  >
    <div class="modal-header">
      <div class="header-icon-title">
        <span class="share-icon">🔗</span>
        <div>
          <h2 id="share-modal-title" class="modal-title">Share Room</h2>
          <span class="modal-subtitle">Invite peers with direct link or instant QR code</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        onclick={onClose}
        data-testid="close-share-modal-btn"
        aria-label="Close share dialog"
      >
        ✕
      </button>
    </div>

    <div class="modal-body">
      <div class="qr-section">
        <div class="qr-card" data-testid="qr-code">
          {#if qrData}
            <svg
              viewBox="0 0 {qrData.size} {qrData.size}"
              class="qr-svg"
              xmlns="http://www.w3.org/2000/svg"
              shape-rendering="crispEdges"
            >
              <rect width={qrData.size} height={qrData.size} fill="#ffffff" />
              {#each qrData.data as row, y (y)}
                {#each row as cell, x (x)}
                  {#if cell}
                    <rect {x} {y} width="1" height="1" fill="#000000" />
                  {/if}
                {/each}
              {/each}
            </svg>
          {/if}
        </div>
        <span class="qr-hint">Scan with mobile camera to join immediately</span>
      </div>

      {#if roomKey}
        <div class="key-toggle-card">
          <label class="toggle-label">
            <input
              type="checkbox"
              bind:checked={includeKey}
              data-testid="toggle-include-key"
              class="toggle-checkbox"
            />
            <div class="toggle-text">
              <span class="toggle-title">Include Room Key in link</span>
              <span class="toggle-desc">
                {includeKey
                  ? 'Peers will join and decrypt automatically without typing key'
                  : 'Room link only (Share the key separately for zero-trust security)'}
              </span>
            </div>
          </label>
        </div>
      {/if}

      <div class="url-copy-box">
        <div class="url-display" data-testid="share-url-text">
          {shareUrl}
        </div>
        <button type="button" class="btn-copy" data-testid="copy-link-btn" onclick={handleCopy}>
          {isCopied ? '✓ Copied!' : '📋 Copy Link'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
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

  .share-modal {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-icon-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .share-icon {
    font-size: 22px;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
  }

  .modal-subtitle {
    font-size: 11px;
    color: #94a3b8;
  }

  .btn-close {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .modal-body {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    align-items: center;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .qr-card {
    background: #ffffff;
    padding: 12px;
    border-radius: 12px;
    width: 180px;
    height: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.qr-card svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .qr-hint {
    font-size: 11px;
    color: #94a3b8;
  }

  .key-toggle-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
    box-sizing: border-box;
  }

  .toggle-label {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    cursor: pointer;
  }

  .toggle-checkbox {
    margin-top: 3px;
    cursor: pointer;
    accent-color: #6366f1;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-title {
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .toggle-desc {
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .url-copy-box {
    width: 100%;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .url-display {
    flex: 1;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    font-family: monospace;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-copy {
    background: #6366f1;
    border: none;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease;
  }

  .btn-copy:hover {
    background: #4f46e5;
  }
</style>
