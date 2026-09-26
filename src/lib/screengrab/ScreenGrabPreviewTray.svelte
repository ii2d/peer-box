<script lang="ts">
  import { formatFileSize } from '../transfer/media-type';

  interface PeerOption {
    id: string;
    name?: string;
  }

  interface Props {
    file: File;
    previewUrl: string;
    peers: PeerOption[];
    initialRecipientId?: string;
    onSend: (file: File, caption: string, recipientId: string) => void;
    onCancel: () => void;
  }

  const {
    file,
    previewUrl,
    peers,
    initialRecipientId = 'everyone',
    onSend,
    onCancel,
  }: Props = $props();

  let caption = $state('');
  // svelte-ignore state_referenced_locally
  let selectedRecipient = $state(initialRecipientId);

  function handleSend(): void {
    onSend(file, caption.trim(), selectedRecipient);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<div
  class="screengrab-tray"
  data-testid="screengrab-tray"
  role="dialog"
  aria-label="Screen Grab Preview"
>
  <div class="tray-content">
    <div class="tray-preview-col">
      <div class="thumbnail-wrapper" data-testid="screengrab-preview">
        <img src={previewUrl} alt="Captured Screen Grab" class="thumbnail-img" />
        <span class="file-badge">{formatFileSize(file.size)}</span>
      </div>
    </div>

    <div class="tray-form-col">
      <div class="tray-header">
        <span class="tray-title">📸 Screen Grab Preview</span>
        <div class="recipient-picker">
          <label for="screengrab-recipient" class="recipient-label">To:</label>
          <select
            id="screengrab-recipient"
            class="recipient-select"
            bind:value={selectedRecipient}
            data-testid="screengrab-recipient-select"
          >
            <option value="everyone">🌐 Everyone</option>
            {#each peers as peer (peer.id)}
              <option value={peer.id}>
                🔒 {peer.name || peer.id}
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="caption-row">
        <input
          type="text"
          class="caption-input"
          placeholder="Add an optional caption..."
          bind:value={caption}
          onkeydown={handleKeydown}
          data-testid="screengrab-caption-input"
        />
      </div>

      <div class="tray-actions">
        <button
          type="button"
          class="btn-cancel"
          onclick={onCancel}
          data-testid="screengrab-cancel-btn"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-send"
          onclick={handleSend}
          data-testid="screengrab-send-btn"
        >
          Send Screen Grab
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .screengrab-tray {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    padding: 14px 18px;
    margin-bottom: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    width: 100%;
    box-sizing: border-box;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tray-content {
    display: flex;
    gap: 16px;
    align-items: stretch;
  }

  .tray-preview-col {
    flex-shrink: 0;
  }

  .thumbnail-wrapper {
    position: relative;
    width: 120px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .file-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: #cbd5e1;
    font-size: 10px;
    padding: 2px 5px;
    border-radius: 4px;
  }

  .tray-form-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .tray-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .tray-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .recipient-picker {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .recipient-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .recipient-select {
    background: rgba(15, 23, 42, 0.7);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .caption-row {
    width: 100%;
  }

  .caption-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .caption-input:focus {
    border-color: #6366f1;
  }

  .tray-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-send {
    background: #6366f1;
    border: none;
    color: #ffffff;
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-send:hover {
    background: #4f46e5;
  }
</style>
