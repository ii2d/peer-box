<script lang="ts">
  import type { PeerInfo } from '../transport/types';
  import VoiceNoteRecorder from '../voice/VoiceNoteRecorder.svelte';

  interface Props {
    chatInput?: string;
    selectedRecipientId?: string;
    connectedPeers: PeerInfo[];
    onSendMessage: () => void;
    onAttachFiles: (files: FileList) => void;
    onSendVoiceNote: (file: File) => void;
    onCaptureScreenGrab: () => void;
  }

  let {
    chatInput = $bindable(''),
    selectedRecipientId = $bindable('everyone'),
    connectedPeers,
    onSendMessage,
    onAttachFiles,
    onSendVoiceNote,
    onCaptureScreenGrab,
  }: Props = $props();

  const recipientDisplayName = $derived(
    selectedRecipientId === 'everyone'
      ? 'Everyone'
      : connectedPeers.find((p) => p.id === selectedRecipientId)?.name || 'Selected Peer',
  );

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      onAttachFiles(input.files);
      input.value = '';
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  }
</script>

<footer class="composer-container">
  <div class="composer-inner">
    <div class="composer-toolbar">
      <div class="composer-toolbar-left">
        <div class="recipient-selector-wrapper">
          <span class="recipient-label">Send to:</span>
          <select
            class="recipient-select"
            data-testid="recipient-select"
            bind:value={selectedRecipientId}
          >
            <option value="everyone">🌐 Everyone</option>
            {#each connectedPeers as peer (peer.id)}
              <option value={peer.id}>
                🔒 {peer.name || peer.id}
              </option>
            {/each}
          </select>
        </div>

        <label class="btn-attach" title="Attach file (<25MB)" data-testid="attach-file-btn">
          <span class="attach-icon">📎</span>
          <span class="attach-text">Attach</span>
          <input
            type="file"
            multiple
            class="hidden-file-input"
            data-testid="file-input"
            onchange={handleFileInputChange}
          />
        </label>

        <VoiceNoteRecorder recipientName={recipientDisplayName} onSend={onSendVoiceNote} />

        <button
          type="button"
          class="btn-screengrab"
          data-testid="screengrab-btn"
          title="Capture Screen Grab"
          onclick={onCaptureScreenGrab}
        >
          <span class="screengrab-icon">📸</span>
          <span class="screengrab-text">Screen Grab</span>
        </button>
      </div>
    </div>

    <div class="composer-input-row">
      <textarea
        class="composer-textarea"
        data-testid="message-input"
        placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
        rows="1"
        bind:value={chatInput}
        onkeydown={handleChatKeydown}></textarea>

      <button
        type="button"
        class="btn-primary btn-send"
        data-testid="send-btn"
        onclick={onSendMessage}
        disabled={!chatInput.trim()}
      >
        Send
      </button>
    </div>
  </div>
</footer>

<style>
  .composer-container {
    border-top: 1px solid var(--card-border);
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    padding: 0.75rem 1.5rem calc(0.75rem + env(safe-area-inset-bottom, 0px)) 1.5rem;
    flex-shrink: 0;
  }

  .composer-inner {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .composer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .composer-toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .recipient-selector-wrapper {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .recipient-select {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
  }

  .recipient-select:focus {
    outline: none;
    border-color: var(--primary);
  }

  .btn-attach {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }

  .btn-attach:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-screengrab {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    font-family: inherit;
  }

  .btn-screengrab:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .hidden-file-input {
    display: none;
  }

  .composer-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .composer-textarea {
    width: 100%;
    resize: none;
    padding: 0.65rem 0.85rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid var(--card-border);
    border-radius: 0.625rem;
    color: var(--text-main);
    font-size: 0.875rem;
    font-family: inherit;
    height: 44px;
    max-height: 120px;
    transition: all 0.15s ease;
  }

  .composer-textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0 1.25rem;
    height: 44px;
    border-radius: 0.625rem;
    border: none;
    background-color: var(--primary);
    color: #ffffff;
    box-shadow: 0 4px 14px 0 var(--primary-glow);
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 767px) {
    .composer-container {
      padding: 0.65rem 0.85rem calc(0.65rem + env(safe-area-inset-bottom, 0px)) 0.85rem;
    }
  }
</style>
