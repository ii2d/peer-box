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
  import { captureScreenGrab } from './lib/screengrab/screengrab';
  import ScreenGrabPreviewTray from './lib/screengrab/ScreenGrabPreviewTray.svelte';
  import ConnectionBadge from './lib/diagnostics/ConnectionBadge.svelte';
  import DiagnosticsDrawer from './lib/diagnostics/DiagnosticsDrawer.svelte';
  import type { PeerConnectionStats } from './lib/transport/types';
  import TrustGuaranteeModal from './lib/trust/TrustGuaranteeModal.svelte';
  import RoomShareModal from './lib/share/RoomShareModal.svelte';
  import PortalView from './lib/portal/PortalView.svelte';

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

  // WebRTC Diagnostics State
  let peerStats = $state<Record<string, PeerConnectionStats>>({});
  let selectedDiagnosticsPeerId = $state<string | null>(null);
  let statsPollInterval: ReturnType<typeof setInterval> | null = null;

  let selectedDiagnosticsPeer = $derived(
    selectedDiagnosticsPeerId
      ? connectedPeers.find((p) => p.id === selectedDiagnosticsPeerId) || null
      : null,
  );

  let hasFailedConnection = $derived(
    Object.values(peerStats).some((s) => s.connectionState === 'failed'),
  );

  // Trust & Share Modals
  let isTrustModalOpen = $state(false);
  let isShareModalOpen = $state(false);

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

  // Screen Grab State
  let activeScreenGrab = $state<{ file: File; previewUrl: string } | null>(null);
  let screenGrabError = $state<string | null>(null);
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
        void updatePeerStats();
      }),
    );

    unsubs.push(
      transport.onPeerLeave((peerId) => {
        connectedPeers = connectedPeers.filter((p) => p.id !== peerId);
        const copy = { ...peerStats };
        delete copy[peerId];
        peerStats = copy;
        if (selectedDiagnosticsPeerId === peerId) {
          selectedDiagnosticsPeerId = null;
        }
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
    stopStatsPolling();
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

  async function updatePeerStats() {
    if (!transport?.getPeerStats || connectedPeers.length === 0) return;
    for (const peer of connectedPeers) {
      try {
        const stats = await transport.getPeerStats(peer.id);
        if (stats) {
          peerStats = { ...peerStats, [peer.id]: stats };
        }
      } catch {
        // ignore
      }
    }
  }

  function startStatsPolling() {
    stopStatsPolling();
    void updatePeerStats();
    statsPollInterval = setInterval(updatePeerStats, 2500);
  }

  function stopStatsPolling() {
    if (statsPollInterval) {
      clearInterval(statsPollInterval);
      statsPollInterval = null;
    }
  }

  function openDiagnostics(peerId: string) {
    selectedDiagnosticsPeerId = peerId;
    void updatePeerStats();
  }

  function handleRandomName() {
    inputRoomName = generateRoomName();
    errorMessage = null;
  }

  async function handleJoinRoom() {
    const clean = sanitizeRoomName(inputRoomName);
    if (!clean) {
      errorMessage = 'Please enter or generate a room name.';
      return;
    }
    errorMessage = null;
    await join(clean, inputRoomKey || null, true);
  }

  async function handleCreateInstantRoom() {
    const generated = generateRoomName();
    inputRoomName = generated;
    errorMessage = null;
    await join(generated, inputRoomKey || null, true);
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

      startStatsPolling();

      if (updateHistory && typeof window !== 'undefined') {
        const newUrl = buildRoomUrl(roomId, { roomKey, includeKey: !!roomKey });
        window.history.pushState({ roomId, roomKey }, '', newUrl);
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : 'Failed to join room';
    }
  }

  function leave(updateHistory = true) {
    stopStatsPolling();
    peerStats = {};
    selectedDiagnosticsPeerId = null;
    isTrustModalOpen = false;
    isShareModalOpen = false;

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

  // 2-Column Workspace & Mobile Drawer State
  let isRoomLinkCopied = $state(false);
  let roomLinkCopyTimeout: ReturnType<typeof setTimeout> | null = null;
  let isMobileRosterOpen = $state(false);

  function toggleMobileRoster() {
    isMobileRosterOpen = !isMobileRosterOpen;
  }

  function closeMobileRoster() {
    isMobileRosterOpen = false;
  }

  function selectRecipient(peerId: string) {
    selectedRecipientId = peerId;
    closeMobileRoster();
  }

  async function copyRoomLink() {
    if (!currentRoomId || typeof window === 'undefined') return;
    const baseUrl = window.location.origin;
    const path = buildRoomUrl(currentRoomId, {
      roomKey: currentRoomKey,
      includeKey: !!currentRoomKey,
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

  async function handleCaptureScreenGrab() {
    screenGrabError = null;
    try {
      const file = await captureScreenGrab();
      let previewUrl = '';
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          previewUrl = URL.createObjectURL(file);
        }
      } catch {
        previewUrl = '';
      }
      activeScreenGrab = { file, previewUrl };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Screen capture failed';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('abort')) {
        screenGrabError = msg;
        setTimeout(() => {
          screenGrabError = null;
        }, 5000);
      }
    }
  }

  function handleCancelScreenGrab() {
    if (activeScreenGrab?.previewUrl) {
      try {
        URL.revokeObjectURL(activeScreenGrab.previewUrl);
      } catch {
        // ignore
      }
    }
    activeScreenGrab = null;
  }

  async function handleSendScreenGrab(file: File, caption: string, recipientId: string) {
    let targetRecipient: { id: string; name?: string } | null = null;
    if (recipientId !== 'everyone') {
      const peer = connectedPeers.find((p) => p.id === recipientId);
      targetRecipient = {
        id: recipientId,
        name: peer?.name || recipientId,
      };
    }

    if (caption && chatService) {
      chatService.sendMessage(caption, targetRecipient);
    }

    if (transferService) {
      try {
        await transferService.sendFile(file, targetRecipient);
      } catch (err: unknown) {
        transferError = err instanceof Error ? err.message : 'File transfer failed';
        setTimeout(() => {
          transferError = null;
        }, 5000);
      }
    }

    handleCancelScreenGrab();
    scrollToBottom();
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

<div class="app-main" class:in-room={!!currentRoomId}>
  {#if !currentRoomId}
    <PortalView
      bind:roomName={inputRoomName}
      bind:roomKey={inputRoomKey}
      {errorMessage}
      onRandomName={handleRandomName}
      onJoin={handleJoinRoom}
      onCreateInstant={handleCreateInstantRoom}
    />
  {:else}
    <div class="room-workspace" data-testid="room-view">
      <!-- Mobile Roster Backdrop -->
      {#if isMobileRosterOpen}
        <button
          type="button"
          class="roster-backdrop"
          data-testid="roster-backdrop"
          onclick={closeMobileRoster}
          aria-label="Close roster menu"
        ></button>
      {/if}

      <!-- Left 2-Column Roster Panel -->
      <aside class="roster-panel" data-testid="roster-panel" class:mobile-open={isMobileRosterOpen}>
        <div class="roster-header">
          <div class="roster-brand">
            <span class="roster-logo">📦</span>
            <span class="roster-brand-title">PeerBox</span>
          </div>

          <div class="roster-room-info">
            <div class="roster-room-meta">
              <span class="roster-room-label">ROOM</span>
              <span class="roster-room-name" data-testid="roster-room-name">{currentRoomId}</span>
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
            {#if currentRoomKey}
              <span class="badge badge-encrypted">🔒 Protected</span>
            {:else}
              <span class="badge badge-open">🌐 Open</span>
            {/if}
            <button
              type="button"
              class="btn-change-key"
              data-testid="change-key-btn"
              onclick={openChangeKeyModal}
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
            onclick={startEditingNickname}
            title="Click to customize nickname"
          >
            <span class="persona-avatar" style:background-color={localPersona.color}>
              {localPersona.emoji}
            </span>
            <div class="persona-info">
              <span class="persona-name">{localPersona.name}</span>
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
              onclick={() => selectRecipient('everyone')}
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
                  onclick={() => selectRecipient(peer.id)}
                  title={`Direct whisper to ${peer.name || peer.id}`}
                >
                  <span class="peer-dot" style:background-color={peer.color || 'var(--primary)'}
                  ></span>
                  <span class="peer-name">{peer.name || peer.id}</span>
                  {#if selectedRecipientId === peer.id}
                    <span class="whisper-tag">Whisper</span>
                  {/if}
                </button>
                <ConnectionBadge
                  stats={peerStats[peer.id]}
                  onClick={() => openDiagnostics(peer.id)}
                />
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
            title="Leave this room and return to portal"
          >
            🚪 Leave Room
          </button>
        </div>
      </aside>

      <!-- Right Main Workspace Panel -->
      <main class="workspace-main" data-testid="workspace-main">
        <!-- Workspace Top Header -->
        <header class="workspace-header">
          <div class="workspace-header-left">
            <button
              type="button"
              class="btn-roster-toggle"
              data-testid="roster-toggle-btn"
              onclick={toggleMobileRoster}
              aria-label="Toggle peers roster"
            >
              👥 Peers ({connectedPeers.length + 1})
            </button>

            <div class="workspace-room-heading">
              <h2 class="workspace-room-title" data-testid="current-room-name">{currentRoomId}</h2>
            </div>

            <!-- Recipient Indicator -->
            <div class="workspace-recipient-badge">
              {#if selectedRecipientId !== 'everyone'}
                {@const targetPeer = connectedPeers.find((p) => p.id === selectedRecipientId)}
                <div class="recipient-indicator" data-testid="recipient-indicator">
                  <span class="indicator-icon">🔒</span>
                  <span
                    >Whispering to <strong>{targetPeer?.name || selectedRecipientId}</strong></span
                  >
                  <button
                    type="button"
                    class="btn-reset-recipient"
                    data-testid="reset-recipient-btn"
                    onclick={() => selectRecipient('everyone')}
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
              onclick={() => (isTrustModalOpen = true)}
              title="View PeerBox Trust Guarantee & Privacy Assurances"
            >
              🛡️ Private & Ephemeral
            </button>

            <button
              type="button"
              class="btn-secondary btn-share"
              data-testid="share-room-btn"
              onclick={() => (isShareModalOpen = true)}
              title="Share room link or QR code"
            >
              🔗 Share
            </button>
          </div>
        </header>

        <!-- Diagnostic Banners -->
        <div class="workspace-banners">
          {#if isAloneDiagnosticVisible}
            <div class="diagnostic-banner" data-testid="alone-diagnostic">
              <div class="diagnostic-content">
                <span class="diagnostic-icon">ℹ️</span>
                <div>
                  <strong>Waiting for peers to join...</strong>
                  <p>
                    If this room is protected, ensure other peers have the exact matching Room Key.
                  </p>
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

          {#if hasFailedConnection}
            <div class="nat-diagnostic-banner" data-testid="nat-diagnostic-banner">
              <div class="nat-diagnostic-content">
                <span class="nat-icon">⚠️</span>
                <div class="nat-text">
                  <strong>Direct Connection Failed (Symmetric NAT Firewall)</strong>
                  <p>
                    PeerBox operates with zero TURN relay servers (ADR-0001). A strict symmetric NAT
                    or firewall is preventing direct peer-to-peer data channels between these
                    networks.
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Chat & Transfer Timeline with Centered 900px Container -->
        <div class="chat-timeline" bind:this={messagesContainer} data-testid="chat-timeline">
          <div class="timeline-inner">
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
                  <div
                    class="message-wrapper"
                    class:message-self={isSelf}
                    data-testid="message-item"
                  >
                    <div class="message-meta">
                      {#if !isSelf}
                        <span
                          class="sender-avatar"
                          style:background-color={item.message.senderColor}
                        >
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
        </div>

        {#if transferError}
          <div class="transfer-error-toast" data-testid="transfer-error">
            ⚠️ {transferError}
          </div>
        {/if}

        {#if screenGrabError}
          <div class="transfer-error-toast" data-testid="screengrab-error">
            ⚠️ {screenGrabError}
          </div>
        {/if}

        {#if activeScreenGrab}
          <ScreenGrabPreviewTray
            file={activeScreenGrab.file}
            previewUrl={activeScreenGrab.previewUrl}
            peers={connectedPeers}
            initialRecipientId={selectedRecipientId}
            onSend={handleSendScreenGrab}
            onCancel={handleCancelScreenGrab}
          />
        {/if}

        <!-- Pinned Composer with Centered 900px Container -->
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

                <VoiceNoteRecorder
                  recipientName={selectedRecipientId === 'everyone'
                    ? 'Everyone'
                    : connectedPeers.find((p) => p.id === selectedRecipientId)?.name ||
                      'Selected Peer'}
                  onSend={handleSendVoiceNote}
                />

                <button
                  type="button"
                  class="btn-screengrab"
                  data-testid="screengrab-btn"
                  title="Capture Screen Grab"
                  onclick={handleCaptureScreenGrab}
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
                onclick={handleSendMessage}
                disabled={!chatInput.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </footer>
      </main>

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

      <!-- Connection & ICE Diagnostics Drawer -->
      {#if selectedDiagnosticsPeer}
        <DiagnosticsDrawer
          peerName={selectedDiagnosticsPeer.name || selectedDiagnosticsPeer.id}
          peerEmoji="👤"
          peerColor={selectedDiagnosticsPeer.color || '#6366f1'}
          stats={peerStats[selectedDiagnosticsPeer.id] || {
            peerId: selectedDiagnosticsPeer.id,
            roundTripTimeMs: 0,
            candidateType: 'srflx',
            connectionState: 'connecting',
          }}
          onClose={() => (selectedDiagnosticsPeerId = null)}
        />
      {/if}

      <!-- Trust Guarantee Explainer Modal -->
      {#if isTrustModalOpen}
        <TrustGuaranteeModal onClose={() => (isTrustModalOpen = false)} />
      {/if}

      <!-- Room Share Modal -->
      {#if isShareModalOpen && currentRoomId}
        <RoomShareModal
          roomId={currentRoomId}
          roomKey={currentRoomKey}
          onClose={() => (isShareModalOpen = false)}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .app-main {
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .app-main.in-room {
    height: 100dvh;
    overflow: hidden;
  }

  .room-workspace {
    display: flex;
    flex-direction: row;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    position: relative;
  }

  /* Left Roster Panel (Desktop 2-column) */
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

  .btn-leave {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .btn-leave:hover {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(239, 68, 68, 0.45);
  }

  /* Main Workspace Panel */
  .workspace-main {
    flex: 1 1 0%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    background: rgba(10, 15, 29, 0.5);
  }

  /* Workspace Header */
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

  /* Diagnostic Banners */
  .workspace-banners {
    padding: 0.75rem 1.5rem 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .nat-diagnostic-banner {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    color: #fca5a5;
    font-size: 0.8125rem;
  }

  .nat-diagnostic-content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .nat-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .nat-text strong {
    display: block;
    color: #fca5a5;
    font-size: 0.8125rem;
    margin-bottom: 0.2rem;
  }

  .nat-text p {
    margin: 0;
    font-size: 0.75rem;
    color: #f87171;
    line-height: 1.4;
  }

  /* Full-Height Scrollable Timeline */
  .chat-timeline {
    flex: 1 1 0%;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding: 1.25rem 1.5rem;
    min-height: 0;
  }

  .timeline-inner {
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .empty-timeline {
    margin: auto;
    text-align: center;
    padding: 4rem 1rem;
  }

  .empty-title {
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 0.35rem;
    font-size: 1.1rem;
  }

  .empty-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    max-width: 400px;
    margin: 0 auto;
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: 80%;
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

  /* Pinned Bottom Composer */
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

  .composer-textarea {
    resize: none;
    padding: 0.65rem 0.85rem;
    font-size: 0.875rem;
    height: 44px;
    max-height: 120px;
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
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

  .btn-send {
    padding: 0 1.25rem;
    font-size: 0.875rem;
    height: 44px;
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

  .btn-sm {
    font-size: 0.75rem;
    padding: 0.35rem 0.65rem;
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

  .transfer-error-toast {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 0.5rem 0.85rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    margin: 0.5rem 1.5rem 0 1.5rem;
    animation: fadeIn 0.2s;
  }

  /* Modals & Overlays */
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

  /* Responsive Mobile Breakpoint (<768px) */
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

    .roster-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 90;
      border: none;
      cursor: pointer;
    }

    .btn-roster-toggle {
      display: inline-flex;
    }

    .workspace-header {
      padding: 0.65rem 1rem;
    }

    .workspace-banners {
      padding: 0.5rem 1rem 0 1rem;
    }

    .chat-timeline {
      padding: 1rem 0.85rem;
    }

    .composer-container {
      padding: 0.65rem 0.85rem calc(0.65rem + env(safe-area-inset-bottom, 0px)) 0.85rem;
    }

    .workspace-recipient-badge {
      display: none;
    }
  }
</style>
