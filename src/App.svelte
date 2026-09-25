<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { ChatService } from './lib/chat/chat-service';
  import {
    createMessageStore,
    getPersistencePreference,
    setPersistencePreference,
    type ChatMessage,
  } from './lib/chat/message-store';
  import { generatePersona, setStoredNickname, type Persona } from './lib/persona/persona';
  import { generateRoomName, sanitizeRoomName } from './lib/room/name-generator';
  import { buildRoomUrl, parseRoomLocation } from './lib/room/url';
  import MediaLightbox from './lib/transfer/MediaLightbox.svelte';
  import { TransferService } from './lib/transfer/transfer-service';
  import TransferMessage from './lib/transfer/TransferMessage.svelte';
  import type { FileTransferItem } from './lib/transfer/types';
  import { InMemoryTransport } from './lib/transport/in-memory-transport';
  import type { PeerInfo, RoomTransport } from './lib/transport/types';
  import VoiceNoteRecorder from './lib/voice/VoiceNoteRecorder.svelte';

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

  // Chat State
  let chatService: ChatService | null = null;
  let messages = $state<ChatMessage[]>([]);
  let chatInput = $state('');
  let selectedRecipientId = $state('everyone');
  let isPersisted = $state(getPersistencePreference());
  let messagesContainer: HTMLDivElement | null = $state(null);

  // File Transfer State
  let transferService: TransferService | null = null;
  let transfers = $state<FileTransferItem[]>([]);
  let transferError = $state<string | null>(null);
  let isDraggingOver = $state(false);
  let dragCounter = 0;
  let activeLightbox = $state<{ src: string; name: string; size: number } | null>(null);

  type TimelineItem =
    | { type: 'chat'; id: string; timestamp: number; message: ChatMessage }
    | { type: 'transfer'; id: string; timestamp: number; transfer: FileTransferItem };

  const timelineItems = $derived<TimelineItem[]>(
    [
      ...messages.map((m) => ({
        type: 'chat' as const,
        id: m.id,
        timestamp: m.timestamp,
        message: m,
      })),
      ...transfers.map((t) => ({
        type: 'transfer' as const,
        id: t.id,
        timestamp: t.meta.timestamp,
        transfer: t,
      })),
    ].sort((a, b) => a.timestamp - b.timestamp),
  );

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
        if (selectedRecipientId === peerId) {
          selectedRecipientId = 'everyone';
        }
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
      window.addEventListener('dragenter', handleWindowDragEnter);
      window.addEventListener('dragover', handleWindowDragOver);
      window.addEventListener('dragleave', handleWindowDragLeave);
      window.addEventListener('drop', handleWindowDrop);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('dragenter', handleWindowDragEnter);
        window.removeEventListener('dragover', handleWindowDragOver);
        window.removeEventListener('dragleave', handleWindowDragLeave);
        window.removeEventListener('drop', handleWindowDrop);
      };
    }
  });

  onDestroy(() => {
    for (const u of unsubs) u();
    if (aloneTimer) clearTimeout(aloneTimer);
    if (chatService) chatService.destroy();
    if (transferService) transferService.destroy();
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
      if (chatService) {
        chatService.destroy();
        chatService = null;
      }
      if (transferService) {
        transferService.destroy();
        transferService = null;
      }

      await transport.joinRoom({ roomId, roomKey });
      currentRoomId = roomId;
      currentRoomKey = roomKey;
      connectedPeers = transport.getPeers();

      // Initialize Chat Service
      const store = createMessageStore(roomId, isPersisted);
      chatService = new ChatService({
        transport,
        store,
        persona: localPersona,
      });
      messages = chatService.getMessages();

      chatService.onNewMessage((msg) => {
        messages = [...messages, msg];
        scrollToBottom();
      });

      // Initialize Transfer Service
      transferService = new TransferService({
        transport,
        persona: localPersona,
      });
      transfers = transferService.getTransfers();

      transferService.onTransferUpdate((item) => {
        const idx = transfers.findIndex((t) => t.id === item.id);
        if (idx >= 0) {
          const updated = [...transfers];
          updated[idx] = item;
          transfers = updated;
        } else {
          transfers = [...transfers, item];
        }
        scrollToBottom();
      });

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
    if (chatService) {
      chatService.destroy();
      chatService = null;
    }
    if (transferService) {
      transferService.destroy();
      transferService = null;
    }

    transport.leaveRoom();
    currentRoomId = null;
    currentRoomKey = null;
    inputRoomName = '';
    inputRoomKey = '';
    errorMessage = null;
    connectedPeers = [];
    messages = [];
    transfers = [];
    transferError = null;
    isDraggingOver = false;
    dragCounter = 0;
    activeLightbox = null;
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
      if (chatService) {
        chatService.setPersona(localPersona);
      }
      if (transferService) {
        transferService.setPersona(localPersona);
      }
      const customTransport = transport as unknown as { setPersona?: (p: Persona) => void };
      if (typeof customTransport.setPersona === 'function') {
        customTransport.setPersona(localPersona);
      }
    }
    isEditingNickname = false;
  }

  async function handleSendFiles(files: FileList | File[]) {
    if (!transferService || !currentRoomId) return;

    let targetRecipient: { id: string; name?: string } | null = null;
    if (selectedRecipientId !== 'everyone') {
      const peer = connectedPeers.find((p) => p.id === selectedRecipientId);
      targetRecipient = {
        id: selectedRecipientId,
        name: peer?.name || selectedRecipientId,
      };
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await transferService.sendFile(file, targetRecipient);
      } catch (err: unknown) {
        transferError = err instanceof Error ? err.message : 'File transfer failed';
        setTimeout(() => {
          transferError = null;
        }, 5000);
      }
    }
  }

  async function handleSendVoiceNote(file: File) {
    await handleSendFiles([file]);
  }

  function handleAcceptTransfer(transferId: string) {
    transferService?.acceptTransfer(transferId);
  }

  function handleDeclineTransfer(transferId: string) {
    transferService?.declineTransfer(transferId);
  }

  function handleCancelTransfer(transferId: string) {
    transferService?.cancelTransfer(transferId);
  }

  function handleExportTransfer(transferId: string) {
    transferService?.exportTransfer(transferId);
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleSendFiles(input.files);
      input.value = '';
    }
  }

  function handleWindowDragEnter(e: DragEvent) {
    if (!currentRoomId) return;
    e.preventDefault();
    dragCounter++;
    isDraggingOver = true;
  }

  function handleWindowDragOver(e: DragEvent) {
    if (!currentRoomId) return;
    e.preventDefault();
  }

  function handleWindowDragLeave(e: DragEvent) {
    if (!currentRoomId) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      isDraggingOver = false;
    }
  }

  function handleWindowDrop(e: DragEvent) {
    if (!currentRoomId) return;
    e.preventDefault();
    dragCounter = 0;
    isDraggingOver = false;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSendFiles(e.dataTransfer.files);
    }
  }

  function openLightbox(src: string, name: string, size: number) {
    activeLightbox = { src, name, size };
  }

  function closeLightbox() {
    activeLightbox = null;
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

  function togglePersistence() {
    isPersisted = !isPersisted;
    setPersistencePreference(isPersisted);
    if (currentRoomId) {
      // Recreate store with new persistence mode
      const store = createMessageStore(currentRoomId, isPersisted);
      if (chatService) {
        chatService.destroy();
      }
      chatService = new ChatService({
        transport,
        store,
        persona: localPersona,
      });
      messages = chatService.getMessages();
      chatService.onNewMessage((msg) => {
        messages = [...messages, msg];
        scrollToBottom();
      });
    }
  }

  function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || !chatService) return;

    let targetRecipient: { id: string; name?: string } | null = null;
    if (selectedRecipientId !== 'everyone') {
      const peer = connectedPeers.find((p) => p.id === selectedRecipientId);
      targetRecipient = {
        id: selectedRecipientId,
        name: peer?.name || selectedRecipientId,
      };
    }

    try {
      chatService.sendMessage(text, targetRecipient);
      chatInput = '';
      scrollToBottom();
    } catch {
      // Silent error handling for empty sends
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            class="btn-secondary btn-icon-persist"
            data-testid="persist-toggle-btn"
            onclick={togglePersistence}
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

      <!-- Chat & Transfer Timeline -->
      <div class="chat-timeline" bind:this={messagesContainer} data-testid="chat-timeline">
        {#if timelineItems.length === 0}
          <div class="empty-timeline">
            <p class="empty-title">Room conversation started</p>
            <p class="empty-subtitle">
              Messages and files sent here are end-to-end encrypted directly between peers.
            </p>
          </div>
        {:else}
          {#each timelineItems as item (item.id)}
            {#if item.type === 'chat'}
              {@const isSelf = item.message.senderId === transport.localPeerId}
              <div class="message-wrapper" class:message-self={isSelf} data-testid="message-item">
                <div class="message-meta">
                  {#if !isSelf}
                    <span class="sender-avatar" style:background-color={item.message.senderColor}>
                      {item.message.senderEmoji}
                    </span>
                    <span class="sender-name">{item.message.senderName}</span>
                  {/if}
                  <span class="message-time">{formatTimestamp(item.message.timestamp)}</span>
                  {#if item.message.isPrivate}
                    <span class="badge badge-private">
                      🔒 Private {isSelf && item.message.recipientName
                        ? `to ${item.message.recipientName}`
                        : ''}
                    </span>
                  {/if}
                </div>

                <div class="message-bubble" class:bubble-self={isSelf}>
                  <p class="message-text">{item.message.content}</p>
                </div>
              </div>
            {:else if item.type === 'transfer'}
              {@const isSelf = item.transfer.meta.senderId === transport.localPeerId}
              <TransferMessage
                transfer={item.transfer}
                {isSelf}
                onOpenImage={openLightbox}
                onAccept={handleAcceptTransfer}
                onDecline={handleDeclineTransfer}
                onCancel={handleCancelTransfer}
                onExport={handleExportTransfer}
              />
            {/if}
          {/each}
        {/if}
      </div>

      {#if transferError}
        <div class="transfer-error-toast" data-testid="transfer-error">
          ⚠️ {transferError}
        </div>
      {/if}

      <!-- Composer & Recipient Selector -->
      <div class="composer-container">
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

            <VoiceNoteRecorder
              recipientName={selectedRecipientId === 'everyone'
                ? 'Everyone'
                : connectedPeers.find((p) => p.id === selectedRecipientId)?.name || 'Selected Peer'}
              onSend={handleSendVoiceNote}
            />
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
            onclick={handleSendMessage}
            disabled={!chatInput.trim()}
          >
            Send
          </button>
        </div>
      </div>

      <!-- Drag & Drop Fullscreen Overlay -->
      {#if isDraggingOver}
        <div class="drag-overlay" data-testid="drag-overlay">
          <div class="drag-overlay-box">
            <span class="drag-overlay-icon">📁</span>
            <h3 class="drag-overlay-title">Drop files to send</h3>
            <p class="drag-overlay-subtitle">
              Sending directly to
              <strong>
                {selectedRecipientId === 'everyone'
                  ? 'Everyone'
                  : connectedPeers.find((p) => p.id === selectedRecipientId)?.name ||
                    'Selected Peer'}
              </strong>
            </p>
          </div>
        </div>
      {/if}

      <!-- Full-size Image Lightbox -->
      {#if activeLightbox}
        <MediaLightbox
          src={activeLightbox.src}
          alt={activeLightbox.name}
          size={activeLightbox.size}
          onClose={closeLightbox}
        />
      {/if}
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
    padding: 2.25rem;
    width: 100%;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.45),
      0 8px 10px -6px rgba(0, 0, 0, 0.35);
  }

  .room-card {
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    min-height: 580px;
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
  input[type='password'],
  .composer-textarea {
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

  input:focus,
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
    padding: 0.8125rem 1.5rem;
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

  .btn-icon-persist {
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
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
    padding-bottom: 1rem;
    margin-bottom: 0.75rem;
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
    margin-bottom: 0.2rem;
  }

  .room-tag {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 700;
  }

  .room-title {
    font-size: 1.25rem;
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

  .badge-private {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.3);
    font-size: 0.625rem;
    padding: 0.1rem 0.4rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    width: 1.35rem;
    height: 1.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.75rem;
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
    padding: 0.75rem 1rem;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.75rem;
    margin-bottom: 0.75rem;
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
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--card-border);
    margin-bottom: 1rem;
    font-size: 0.8125rem;
  }

  .presence-count {
    color: var(--text-muted);
    font-weight: 600;
  }

  .peers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .peer-pill {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.55rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--card-border);
    border-radius: 9999px;
  }

  .peer-self {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.08);
  }

  .peer-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
  }

  .peer-name {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .chat-timeline {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.5rem 0.25rem 1rem 0;
    min-height: 280px;
    max-height: 380px;
  }

  .empty-timeline {
    margin: auto;
    text-align: center;
    padding: 2rem 1rem;
  }

  .empty-title {
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 0.25rem;
  }

  .empty-subtitle {
    font-size: 0.8125rem;
    color: var(--text-muted);
    max-width: 320px;
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: 82%;
  }

  .message-self {
    align-self: flex-end;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .sender-avatar {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
  }

  .sender-name {
    font-weight: 600;
    color: var(--text-main);
  }

  .message-bubble {
    padding: 0.65rem 0.95rem;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid var(--card-border);
    border-radius: 0.875rem;
    color: var(--text-main);
    word-break: break-word;
    line-height: 1.45;
    font-size: 0.875rem;
  }

  .bubble-self {
    background: #4f46e5;
    border-color: #6366f1;
    color: #ffffff;
  }

  .message-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .composer-container {
    border-top: 1px solid var(--card-border);
    padding-top: 0.85rem;
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

  .hidden-file-input {
    display: none;
  }

  .transfer-error-toast {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 0.5rem 0.85rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    margin-bottom: 0.5rem;
    animation: fadeIn 0.2s;
  }

  .drag-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    pointer-events: none;
  }

  .drag-overlay-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--primary);
    border-radius: 1.5rem;
    padding: 3.5rem 4rem;
    background: rgba(99, 102, 241, 0.1);
    max-width: 500px;
    width: 100%;
    text-align: center;
    animation: scaleUp 0.15s ease-out;
  }

  .drag-overlay-icon {
    font-size: 3.5rem;
    margin-bottom: 1rem;
  }

  .drag-overlay-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.35rem;
  }

  .drag-overlay-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  @keyframes scaleUp {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .composer-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .composer-textarea {
    resize: none;
    padding: 0.65rem 0.85rem;
    font-size: 0.875rem;
    height: 42px;
    max-height: 100px;
  }

  .btn-send {
    padding: 0 1.25rem;
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
