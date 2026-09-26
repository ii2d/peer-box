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
  import NicknameModal from './lib/persona/NicknameModal.svelte';
  import { generateRoomName, sanitizeRoomName } from './lib/room/name-generator';
  import { buildRoomUrl, parseRoomLocation } from './lib/room/url';
  import ChangeKeyModal from './lib/room/ChangeKeyModal.svelte';
  import MediaLightbox from './lib/transfer/MediaLightbox.svelte';
  import { TransferService } from './lib/transfer/transfer-service';
  import TransferMessage from './lib/transfer/TransferMessage.svelte';
  import type { FileTransferItem } from './lib/transfer/types';
  import { InMemoryTransport } from './lib/transport/in-memory-transport';
  import type { PeerInfo, RoomTransport, PeerConnectionStats } from './lib/transport/types';
  import { captureScreenGrab } from './lib/screengrab/screengrab';
  import ScreenGrabPreviewTray from './lib/screengrab/ScreenGrabPreviewTray.svelte';
  import DiagnosticsDrawer from './lib/diagnostics/DiagnosticsDrawer.svelte';
  import TrustGuaranteeModal from './lib/trust/TrustGuaranteeModal.svelte';
  import RoomShareModal from './lib/share/RoomShareModal.svelte';
  import PortalView from './lib/portal/PortalView.svelte';
  import Composer from './lib/workspace/Composer.svelte';
  import RosterPanel from './lib/workspace/RosterPanel.svelte';
  import WorkspaceHeader from './lib/workspace/WorkspaceHeader.svelte';

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

  function startEditingNickname() {
    isEditingNickname = true;
  }

  function handleSaveNickname(newName: string) {
    const clean = newName.trim();
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

  function openChangeKeyModal() {
    isChangingKey = true;
  }

  async function handleSaveNewKey(newKey: string | null) {
    if (!currentRoomId) return;
    isChangingKey = false;
    await join(currentRoomId, newKey, true);
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
      <RosterPanel
        roomId={currentRoomId}
        roomKey={currentRoomKey}
        persona={localPersona}
        {connectedPeers}
        {peerStats}
        {selectedRecipientId}
        {isPersisted}
        isMobileOpen={isMobileRosterOpen}
        onEditPersona={startEditingNickname}
        onChangeKey={openChangeKeyModal}
        onSelectRecipient={selectRecipient}
        onOpenDiagnostics={openDiagnostics}
        onTogglePersistence={togglePersistence}
        onLeave={() => leave(true)}
      />

      <!-- Right Main Workspace Panel -->
      <main class="workspace-main" data-testid="workspace-main">
        <!-- Workspace Top Header -->
        <WorkspaceHeader
          roomId={currentRoomId}
          peersCount={connectedPeers.length + 1}
          {selectedRecipientId}
          {connectedPeers}
          onToggleMobileRoster={toggleMobileRoster}
          onResetRecipient={() => selectRecipient('everyone')}
          onOpenTrustModal={() => (isTrustModalOpen = true)}
          onOpenShareModal={() => (isShareModalOpen = true)}
        />

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
        <Composer
          bind:chatInput
          bind:selectedRecipientId
          {connectedPeers}
          onSendMessage={handleSendMessage}
          onAttachFiles={handleSendFiles}
          onSendVoiceNote={handleSendVoiceNote}
          onCaptureScreenGrab={handleCaptureScreenGrab}
        />
      </main>

      <!-- Nickname Edit Modal / Popover -->
      {#if isEditingNickname}
        <NicknameModal
          initialNickname={localPersona.name}
          onSave={handleSaveNickname}
          onCancel={() => (isEditingNickname = false)}
        />
      {/if}

      <!-- Change Room Key Modal -->
      {#if isChangingKey}
        <ChangeKeyModal
          initialKey={currentRoomKey}
          onSave={handleSaveNewKey}
          onCancel={() => (isChangingKey = false)}
        />
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

    .workspace-banners {
      padding: 0.5rem 1rem 0 1rem;
    }

    .chat-timeline {
      padding: 1rem 0.85rem;
    }
  }
</style>
