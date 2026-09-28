<script lang="ts">
  import type { PeerInfo } from '../transport/types';
  import VoiceNoteRecorder from '../voice/VoiceNoteRecorder.svelte';
  import type { VoiceRecorderStatus } from '../voice/types';

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

  let voiceStatus = $state<VoiceRecorderStatus>('idle');
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

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

  function handleTextareaInput() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textareaEl.scrollHeight, 44), 140);
    textareaEl.style.height = `${nextHeight}px`;
  }

  $effect(() => {
    if (!chatInput && textareaEl) {
      textareaEl.style.height = '44px';
    } else if (textareaEl) {
      handleTextareaInput();
    }
  });
</script>

<footer class="composer-container" class:voice-active={voiceStatus !== 'idle'}>
  <div class="composer-inner" class:voice-active={voiceStatus !== 'idle'}>
    <div class="composer-toolbar" class:voice-active={voiceStatus !== 'idle'}>
      <div class="composer-toolbar-left" class:voice-active={voiceStatus !== 'idle'}>
        <div class="recipient-selector-wrapper" class:hidden-when-voice={voiceStatus !== 'idle'}>
          <span class="recipient-label">Send to:</span>
          <select
            class="recipient-select"
            data-testid="recipient-select"
            bind:value={selectedRecipientId}
            aria-label="Select message recipient"
          >
            <option value="everyone">🌐 Everyone</option>
            {#each connectedPeers as peer (peer.id)}
              <option value={peer.id}>
                🔒 {peer.name || peer.id}
              </option>
            {/each}
          </select>
        </div>

        <label
          class="btn-attach"
          class:hidden-when-voice={voiceStatus !== 'idle'}
          title="Attach file (<25MB)"
          data-testid="attach-file-btn"
        >
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

        <VoiceNoteRecorder
          recipientName={recipientDisplayName}
          onSend={onSendVoiceNote}
          bind:status={voiceStatus}
        />

        <button
          type="button"
          class="btn-screengrab"
          class:hidden-when-voice={voiceStatus !== 'idle'}
          data-testid="screengrab-btn"
          title="Capture Screen Grab"
          onclick={onCaptureScreenGrab}
          aria-label="Capture Screen Grab"
        >
          <span class="screengrab-icon">📸</span>
          <span class="screengrab-text">Screen Grab</span>
        </button>
      </div>
    </div>

    <div class="composer-input-row" class:hidden-when-voice={voiceStatus !== 'idle'}>
      <textarea
        bind:this={textareaEl}
        class="composer-textarea"
        data-testid="message-input"
        placeholder="Type a message..."
        rows="1"
        bind:value={chatInput}
        oninput={handleTextareaInput}
        onkeydown={handleChatKeydown}
        aria-label="Message input"></textarea>

      <button
        type="button"
        class="btn-primary btn-send"
        data-testid="send-btn"
        onclick={onSendMessage}
        disabled={!chatInput.trim()}
        aria-label="Send message"
      >
        <span class="send-text">Send</span>
        <span class="send-icon" aria-hidden="true">➤</span>
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
    width: 100%;
  }

  .composer-toolbar.voice-active {
    width: 100%;
  }

  .composer-toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    max-width: 100%;
    padding: 0.1rem 0;
  }

  .composer-toolbar-left.voice-active {
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }

  .hidden-when-voice {
    display: none !important;
  }

  .composer-toolbar-left::-webkit-scrollbar {
    display: none;
  }

  .recipient-selector-wrapper {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .recipient-select {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    padding: 0.3rem 0.55rem;
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
    max-width: 150px;
  }

  .recipient-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  .btn-attach {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    flex-shrink: 0;
  }

  .btn-attach:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-screengrab {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    color: var(--text-main);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    font-family: inherit;
    flex-shrink: 0;
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
    align-items: flex-end;
  }

  .composer-textarea {
    width: 100%;
    resize: none;
    box-sizing: border-box;
    padding: 0.65rem 0.85rem;
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid var(--card-border);
    border-radius: 0.75rem;
    color: var(--text-main);
    font-size: 0.875rem;
    font-family: inherit;
    height: 44px;
    min-height: 44px;
    max-height: 140px;
    line-height: 1.4;
    overflow-y: auto;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .composer-textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0 1.15rem;
    height: 44px;
    border-radius: 0.75rem;
    border: none;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
    color: #ffffff;
    box-shadow: 0 4px 14px 0 var(--primary-glow);
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px 0 var(--primary-glow);
  }

  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .send-icon {
    font-size: 0.8125rem;
  }

  @media (max-width: 767px) {
    .composer-container {
      padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom, 0px)) 0.75rem;
    }

    .composer-toolbar-left {
      gap: 0.45rem;
    }
  }

  @media (max-width: 600px) {
    .recipient-label {
      display: none;
    }

    .btn-attach {
      padding: 0.35rem 0.5rem;
    }

    .attach-text {
      display: none;
    }

    .btn-screengrab {
      padding: 0.35rem 0.5rem;
    }

    .screengrab-text {
      display: none;
    }

    .composer-textarea {
      font-size: 0.875rem;
      padding: 0.6rem 0.75rem;
    }

    .btn-send {
      padding: 0 0.9rem;
    }
  }
</style>
