import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from './App.svelte';
import {
  InMemoryTransport,
  resetInMemoryTransportRooms,
} from './lib/transport/in-memory-transport';

describe('PeerBox App Component', () => {
  beforeEach(() => {
    resetInMemoryTransportRooms();
    window.history.replaceState({}, '', '/');
  });

  it('renders landing page with room input, generate button, and trust chips', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('test-peer');
    const component = mount(App, { target, props: { transport } });

    expect(target.querySelector('h1')?.textContent).toContain('PeerBox');
    expect(target.querySelector('[data-testid="room-input"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="random-btn"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="join-btn"]')).not.toBeNull();
    expect(target.textContent).toContain('End-to-End Encrypted');

    unmount(component);
    target.remove();
  });

  it('generates random adjective-noun pair when clicking random button', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('test-peer');
    const component = mount(App, { target, props: { transport } });

    const randomBtn = target.querySelector<HTMLButtonElement>('[data-testid="random-btn"]');
    const roomInput = target.querySelector<HTMLInputElement>('[data-testid="room-input"]');

    expect(roomInput?.value).toBe('');
    randomBtn?.click();
    flushSync();

    expect(roomInput?.value).toMatch(/^[a-z]+-[a-z]+$/);

    unmount(component);
    target.remove();
  });

  it('joins room and updates URL cleanly with Room Key in hash', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('test-peer');
    const component = mount(App, { target, props: { transport } });

    const roomInput = target.querySelector<HTMLInputElement>('[data-testid="room-input"]')!;
    const keyInput = target.querySelector<HTMLInputElement>('[data-testid="key-input"]')!;
    const joinBtn = target.querySelector<HTMLButtonElement>('[data-testid="join-btn"]')!;

    roomInput.value = 'cute-dog';
    roomInput.dispatchEvent(new Event('input'));
    keyInput.value = 'secret123';
    keyInput.dispatchEvent(new Event('input'));
    flushSync();

    joinBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Verify room view is active
    expect(target.querySelector('[data-testid="room-view"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="current-room-name"]')?.textContent).toBe('cute-dog');
    expect(transport.currentRoomId).toBe('cute-dog');
    expect(transport.currentRoomKey).toBe('secret123');

    // Verify URL updated with key exclusively in hash
    expect(window.location.pathname).toBe('/cute-dog');
    expect(window.location.hash).toBe('#key=secret123');

    // Leaving room
    const leaveBtn = target.querySelector<HTMLButtonElement>('[data-testid="leave-btn"]')!;
    leaveBtn.click();
    flushSync();

    expect(target.querySelector('[data-testid="room-view"]')).toBeNull();
    expect(target.querySelector('[data-testid="room-input"]')).not.toBeNull();
    expect(transport.currentRoomId).toBeNull();
    expect(window.location.pathname).toBe('/');

    unmount(component);
    target.remove();
  });

  it('auto-joins room when visiting direct clean URL with hash key on mount', async () => {
    window.history.replaceState({}, '', '/cosmic-fox#key=topsecret');

    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('test-peer');
    const component = mount(App, { target, props: { transport } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(target.querySelector('[data-testid="room-view"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="current-room-name"]')?.textContent).toBe(
      'cosmic-fox',
    );
    expect(transport.currentRoomId).toBe('cosmic-fox');
    expect(transport.currentRoomKey).toBe('topsecret');

    unmount(component);
    target.remove();
  });

  it('displays local persona and allows editing display nickname in-room', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('test-peer');
    const component = mount(App, { target, props: { transport } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    const personaBadge = target.querySelector<HTMLButtonElement>('[data-testid="persona-badge"]');
    expect(personaBadge).not.toBeNull();
    personaBadge?.click();
    flushSync();

    const editInput = target.querySelector<HTMLInputElement>('[data-testid="nickname-edit-input"]');
    expect(editInput).not.toBeNull();
    editInput!.value = 'Captain Marvel';
    editInput!.dispatchEvent(new Event('input'));
    flushSync();

    const saveBtn = target.querySelector<HTMLButtonElement>('[data-testid="nickname-save-btn"]');
    saveBtn?.click();
    flushSync();

    expect(target.querySelector('[data-testid="persona-badge"]')?.textContent).toContain(
      'Captain Marvel',
    );
    expect(localStorage.getItem('peerbox_persona_nickname')).toBe('Captain Marvel');

    unmount(component);
    target.remove();
  });

  it('renders live connected peers list when a remote peer arrives', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('peer-local');
    const transport2 = new InMemoryTransport('peer-remote');
    const component = mount(App, { target, props: { transport: transport1 } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(target.querySelectorAll('[data-testid="peer-item"]').length).toBe(0);

    // Remote peer joins
    await transport2.joinRoom({ roomId: 'cute-dog' });
    flushSync();

    expect(target.querySelectorAll('[data-testid="peer-item"]').length).toBe(1);
    expect(target.querySelector('[data-testid="peer-item"]')?.textContent).toContain('peer-remote');

    // Remote peer leaves
    transport2.leaveRoom();
    flushSync();

    expect(target.querySelectorAll('[data-testid="peer-item"]').length).toBe(0);

    unmount(component);
    target.remove();
  });

  it('displays diagnostic banner with change room key button when alone for 10 seconds', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/cute-dog#key=wrong-key');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('peer-alone');
    const component = mount(App, { target, props: { transport } });

    await vi.advanceTimersByTimeAsync(10);
    flushSync();

    expect(target.querySelector('[data-testid="alone-diagnostic"]')).toBeNull();

    // Advance by 10 seconds
    await vi.advanceTimersByTimeAsync(10000);
    flushSync();

    expect(target.querySelector('[data-testid="alone-diagnostic"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="change-key-btn"]')).not.toBeNull();

    // Clicking Change Room Key opens change key modal
    const changeKeyBtn = target.querySelector<HTMLButtonElement>('[data-testid="change-key-btn"]');
    changeKeyBtn?.click();
    flushSync();

    expect(target.querySelector('[data-testid="change-key-input"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="save-new-key-btn"]')).not.toBeNull();

    vi.useRealTimers();
    unmount(component);
    target.remove();
  });

  it('sends and receives messages in room with recipient targeting', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    const component = mount(App, { target, props: { transport: transport1 } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Peer 2 joins
    await transport2.joinRoom({ roomId: 'cute-dog' });
    flushSync();

    // Compose broadcast message
    const msgInput = target.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]')!;
    const sendBtn = target.querySelector<HTMLButtonElement>('[data-testid="send-btn"]')!;
    expect(msgInput).not.toBeNull();

    msgInput.value = 'Hello peer!';
    msgInput.dispatchEvent(new Event('input'));
    flushSync();

    sendBtn.click();
    flushSync();

    expect(target.querySelectorAll('[data-testid="message-item"]').length).toBe(1);
    expect(target.querySelector('[data-testid="message-item"]')?.textContent).toContain(
      'Hello peer!',
    );

    // Now select peer-2 as direct recipient
    const recipientSelect = target.querySelector<HTMLSelectElement>(
      '[data-testid="recipient-select"]',
    )!;
    expect(recipientSelect).not.toBeNull();
    recipientSelect.value = 'peer-2';
    recipientSelect.dispatchEvent(new Event('change'));
    flushSync();

    msgInput.value = 'Whisper to peer-2';
    msgInput.dispatchEvent(new Event('input'));
    flushSync();

    sendBtn.click();
    flushSync();

    const messages = target.querySelectorAll('[data-testid="message-item"]');
    expect(messages.length).toBe(2);
    expect(messages[1].textContent).toContain('Whisper to peer-2');
    expect(messages[1].textContent).toContain('Private');

    unmount(component);
    target.remove();
  });

  it('handles file selection via paperclip input and sends chunked transfer', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('peer-1');

    const component = mount(App, { target, props: { transport } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    const fileInput = target.querySelector<HTMLInputElement>('[data-testid="file-input"]')!;
    expect(fileInput).not.toBeNull();

    const file = new File(['console.log("hello peer-box!");'], 'script.js', {
      type: 'text/javascript',
    });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    await new Promise((r) => setTimeout(r, 30));
    flushSync();

    const transferItem = target.querySelector('[data-testid="transfer-item"]');
    expect(transferItem).not.toBeNull();
    expect(transferItem?.textContent).toContain('script.js');
    expect(target.querySelector('[data-testid="download-btn"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="code-preview"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="code-preview"]')?.textContent).toContain(
      'console.log("hello peer-box!");',
    );

    unmount(component);
    target.remove();
  });

  it('shows and hides drag-and-drop overlay on window drag events', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('peer-1');

    const component = mount(App, { target, props: { transport } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(target.querySelector('[data-testid="drag-overlay"]')).toBeNull();

    // Trigger dragenter on window
    const dragEnterEvent = new Event('dragenter', { bubbles: true, cancelable: true });
    window.dispatchEvent(dragEnterEvent);
    flushSync();

    expect(target.querySelector('[data-testid="drag-overlay"]')).not.toBeNull();

    // Trigger dragleave
    const dragLeaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
    window.dispatchEvent(dragLeaveEvent);
    flushSync();

    expect(target.querySelector('[data-testid="drag-overlay"]')).toBeNull();

    unmount(component);
    target.remove();
  });

  it('receives file transfer from remote peer and opens lightbox on image click', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    const component = mount(App, { target, props: { transport: transport1 } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    await transport2.joinRoom({ roomId: 'cute-dog' });
    flushSync();

    // Transport 2 sends image transfer
    transport2.sendAction('file-meta', {
      id: 'img_test_123',
      name: 'sunset.png',
      size: 1024,
      mimeType: 'image/png',
      totalChunks: 1,
      senderId: 'peer-2',
      senderName: 'Sunny Fox',
      senderEmoji: '🦊',
      senderColor: '#f97316',
      recipientId: null,
      isPrivate: false,
      timestamp: Date.now(),
    });

    transport2.sendAction('file-chunk', {
      transferId: 'img_test_123',
      chunkIndex: 0,
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    await new Promise((r) => setTimeout(r, 30));
    flushSync();

    const transferItem = target.querySelector('[data-testid="transfer-item"]');
    expect(transferItem).not.toBeNull();
    expect(transferItem?.textContent).toContain('sunset.png');
    expect(target.querySelector('[data-testid="image-preview"]')).not.toBeNull();

    // Click image thumbnail to open lightbox
    const imgPreviewBtn = target.querySelector<HTMLButtonElement>('[data-testid="image-preview"]')!;
    imgPreviewBtn.click();
    flushSync();

    expect(target.querySelector('[data-testid="lightbox-overlay"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="lightbox-close-btn"]')).not.toBeNull();

    // Click close
    target.querySelector<HTMLButtonElement>('[data-testid="lightbox-close-btn"]')?.click();
    flushSync();

    expect(target.querySelector('[data-testid="lightbox-overlay"]')).toBeNull();

    unmount(component);
    target.remove();
  });

  it('handles large file incoming request card, acceptance, and cancellation', async () => {
    window.history.replaceState({}, '', '/cute-dog');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('peer-1');
    const transport2 = new InMemoryTransport('peer-2');

    const component = mount(App, { target, props: { transport: transport1 } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    await transport2.joinRoom({ roomId: 'cute-dog' });
    flushSync();

    // Peer 2 sends a large file meta (30MB)
    transport2.sendAction('file-meta', {
      id: 'large_test_999',
      name: 'big_video.mp4',
      size: 30 * 1024 * 1024,
      mimeType: 'video/mp4',
      totalChunks: 30,
      isLarge: true,
      senderId: 'peer-2',
      senderName: 'Sunny Fox',
      senderEmoji: '🦊',
      senderColor: '#f97316',
      recipientId: null,
      isPrivate: false,
      timestamp: Date.now(),
    });

    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    const transferItem = target.querySelector('[data-testid="transfer-item"]');
    expect(transferItem).not.toBeNull();
    expect(transferItem?.textContent).toContain('big_video.mp4');

    // Receiver sees accept and decline buttons
    const acceptBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="accept-transfer-btn"]',
    );
    const declineBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="decline-transfer-btn"]',
    );
    expect(acceptBtn).not.toBeNull();
    expect(declineBtn).not.toBeNull();

    // Click Accept
    acceptBtn?.click();
    flushSync();

    // Receiver should transition to transferring state with progress section
    expect(target.querySelector('[data-testid="transfer-progress"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="cancel-transfer-btn"]')).not.toBeNull();

    // Click Cancel
    target.querySelector<HTMLButtonElement>('[data-testid="cancel-transfer-btn"]')?.click();
    flushSync();

    expect(target.querySelector('[data-testid="cancelled-badge"]')).not.toBeNull();

    unmount(component);
    target.remove();
  });

  it('renders voice note record button and custom waveform player for audio transfers', async () => {
    window.history.replaceState({}, '', '/voice-room');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('user-local');
    const transport2 = new InMemoryTransport('remote-peer');
    const component = mount(App, { target, props: { transport: transport1 } });

    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Verify mic button is present
    const micBtn = target.querySelector<HTMLButtonElement>('[data-testid="mic-record-btn"]');
    expect(micBtn).not.toBeNull();

    // Remote peer joins and transfers an audio file
    await transport2.joinRoom({ roomId: 'voice-room' });
    flushSync();

    transport2.sendAction('file-meta', {
      id: 'voice_transfer_test',
      name: 'voice-note-123.webm',
      size: 3,
      mimeType: 'audio/webm',
      totalChunks: 1,
      senderId: 'remote-peer',
      senderName: 'Sunny Fox',
      senderEmoji: '🦊',
      senderColor: '#f97316',
      recipientId: null,
      isPrivate: false,
      timestamp: Date.now(),
    });

    transport2.sendAction('file-chunk', {
      transferId: 'voice_transfer_test',
      chunkIndex: 0,
      data: 'AQID', // base64 [1, 2, 3]
    });

    await new Promise((r) => setTimeout(r, 30));
    flushSync();

    // Verify audio preview rendered custom waveform player
    expect(target.querySelector('[data-testid="audio-preview"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="waveform-player"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="audio-play-pause-btn"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="audio-scrubber"]')).not.toBeNull();

    unmount(component);
    target.remove();
  });

  it('captures screen grab, opens preview tray, and allows sending with caption', async () => {
    window.history.replaceState({}, '', '/screen-room');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('user-local');

    // Mock mediaDevices & canvas for screen grab
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = origCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }) as unknown as typeof canvas.getContext;
        canvas.toBlob = vi.fn((cb: (b: Blob) => void) => {
          cb(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
        }) as unknown as typeof canvas.toBlob;
        return canvas;
      }
      if (tagName === 'video') {
        const video = origCreateElement('video');
        video.play = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(video, 'srcObject', {
          set() {
            setTimeout(() => {
              Object.defineProperty(video, 'videoWidth', { value: 800 });
              Object.defineProperty(video, 'videoHeight', { value: 600 });
              video.dispatchEvent(new Event('canplay'));
            }, 10);
          },
        });
        return video;
      }
      return origCreateElement(tagName);
    });

    const component = mount(App, { target, props: { transport } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    const screengrabBtn = target.querySelector<HTMLButtonElement>('[data-testid="screengrab-btn"]');
    expect(screengrabBtn).not.toBeNull();
    screengrabBtn?.click();

    await new Promise((r) => setTimeout(r, 40));
    flushSync();

    // Verify preview tray is open
    expect(target.querySelector('[data-testid="screengrab-tray"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="screengrab-preview"]')).not.toBeNull();

    // Add caption
    const captionInput = target.querySelector<HTMLInputElement>(
      '[data-testid="screengrab-caption-input"]',
    );
    expect(captionInput).not.toBeNull();
    captionInput!.value = 'Check out this screen frame';
    captionInput!.dispatchEvent(new Event('input'));
    flushSync();

    // Click send
    const sendBtn = target.querySelector<HTMLButtonElement>('[data-testid="screengrab-send-btn"]');
    sendBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Tray closes
    expect(target.querySelector('[data-testid="screengrab-tray"]')).toBeNull();

    // Verify caption message rendered in timeline
    expect(target.textContent).toContain('Check out this screen frame');

    unmount(component);
    target.remove();
  });

  it('displays latency badge beside connected peer and opens diagnostics drawer on click', async () => {
    window.history.replaceState({}, '', '/diag-room');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('user-local');
    const transport2 = new InMemoryTransport('peer-remote');

    const component = mount(App, { target, props: { transport: transport1 } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Remote peer joins
    await transport2.joinRoom({ roomId: 'diag-room' });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Verify latency badge is present beside the remote peer
    const badge = target.querySelector<HTMLButtonElement>('[data-testid="latency-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Direct LAN');

    // Click latency badge to open diagnostics drawer
    badge?.click();
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(target.querySelector('[data-testid="diagnostics-drawer"]')).not.toBeNull();
    expect(target.textContent).toContain('WebRTC Connection & ICE Diagnostics');
    expect(target.textContent).toContain('Zero-TURN Architecture');

    // Close drawer
    target.querySelector<HTMLButtonElement>('[data-testid="close-diagnostics-btn"]')?.click();
    flushSync();

    expect(target.querySelector('[data-testid="diagnostics-drawer"]')).toBeNull();

    unmount(component);
    target.remove();
  });

  it('displays symmetric NAT diagnostic banner when peer connection fails', async () => {
    window.history.replaceState({}, '', '/blocked-room');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('user-local');
    const transport2 = new InMemoryTransport('peer-blocked');

    // Set mock stats to failed state
    transport1.setMockPeerStats('peer-blocked', {
      peerId: 'peer-blocked',
      roundTripTimeMs: 0,
      candidateType: 'srflx',
      connectionState: 'failed',
    });

    const component = mount(App, { target, props: { transport: transport1 } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    await transport2.joinRoom({ roomId: 'blocked-room' });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Verify NAT diagnostic banner appears
    const banner = target.querySelector('[data-testid="nat-diagnostic-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Symmetric NAT');

    unmount(component);
    target.remove();
  });

  it('opens trust guarantee modal and room share modal from header actions', async () => {
    window.history.replaceState({}, '', '/shared-room#key=topsecret');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('user-local');

    const component = mount(App, { target, props: { transport } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Open Trust Guarantee modal
    const trustBtn = target.querySelector<HTMLButtonElement>('[data-testid="trust-guarantee-btn"]');
    expect(trustBtn).not.toBeNull();
    trustBtn?.click();
    flushSync();

    expect(target.querySelector('[data-testid="trust-modal"]')).not.toBeNull();
    expect(target.querySelectorAll('[data-testid^="trust-card-"]').length).toBe(4);

    // Close Trust Guarantee modal
    target.querySelector<HTMLButtonElement>('[data-testid="close-trust-modal-btn"]')?.click();
    flushSync();
    expect(target.querySelector('[data-testid="trust-modal"]')).toBeNull();

    // Open Share Room modal
    const shareBtn = target.querySelector<HTMLButtonElement>('[data-testid="share-room-btn"]');
    expect(shareBtn).not.toBeNull();
    shareBtn?.click();
    flushSync();

    expect(target.querySelector('[data-testid="share-modal"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="qr-code"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="copy-link-btn"]')).not.toBeNull();

    // Close Share Room modal
    target.querySelector<HTMLButtonElement>('[data-testid="close-share-modal-btn"]')?.click();
    flushSync();
    expect(target.querySelector('[data-testid="share-modal"]')).toBeNull();

    unmount(component);
    target.remove();
  });

  it('renders 2-column desktop workspace layout with Roster panel and main workspace', async () => {
    window.history.replaceState({}, '', '/desktop-room#key=secret123');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('local-user');

    const component = mount(App, { target, props: { transport } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    // Verify 2-column shell components
    const roster = target.querySelector('[data-testid="roster-panel"]');
    const mainWorkspace = target.querySelector('[data-testid="workspace-main"]');
    expect(roster).not.toBeNull();
    expect(mainWorkspace).not.toBeNull();

    // Verify Roster panel contents
    expect(roster?.textContent).toContain('desktop-room');
    expect(roster?.querySelector('[data-testid="roster-copy-link-btn"]')).not.toBeNull();
    expect(roster?.querySelector('.badge-encrypted')).not.toBeNull();
    expect(roster?.querySelector('[data-testid="persona-badge"]')).not.toBeNull();
    expect(roster?.querySelector('[data-testid="presence-bar"]')).not.toBeNull();
    expect(roster?.querySelector('[data-testid="persist-toggle-btn"]')).not.toBeNull();
    expect(roster?.querySelector('[data-testid="leave-btn"]')).not.toBeNull();

    // Verify Main Workspace header contents
    expect(mainWorkspace?.querySelector('[data-testid="current-room-name"]')?.textContent).toBe(
      'desktop-room',
    );
    expect(mainWorkspace?.querySelector('[data-testid="trust-guarantee-btn"]')).not.toBeNull();
    expect(mainWorkspace?.querySelector('[data-testid="share-room-btn"]')).not.toBeNull();
    expect(
      mainWorkspace?.querySelector('[data-testid="chat-timeline"] .timeline-inner'),
    ).not.toBeNull();
    expect(mainWorkspace?.querySelector('.composer-container .composer-inner')).not.toBeNull();

    unmount(component);
    target.remove();
  });

  it('allows clicking a peer in the Roster to select them as direct recipient', async () => {
    window.history.replaceState({}, '', '/whisper-room');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport1 = new InMemoryTransport('user-local');
    const transport2 = new InMemoryTransport('peer-remote');

    const component = mount(App, { target, props: { transport: transport1 } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    await transport2.joinRoom({ roomId: 'whisper-room' });
    flushSync();

    const peerItem = target.querySelector<HTMLElement>('[data-testid="peer-item"]');
    expect(peerItem).not.toBeNull();

    // Click peer to initiate whisper
    const peerBtn = peerItem?.querySelector<HTMLButtonElement>('button') || peerItem;
    peerBtn?.click();
    flushSync();

    // Recipient selector and indicator should reflect the selection
    const recipientSelect = target.querySelector<HTMLSelectElement>(
      '[data-testid="recipient-select"]',
    );
    expect(recipientSelect?.value).toBe('peer-remote');

    const indicator = target.querySelector('[data-testid="recipient-indicator"]');
    expect(indicator?.textContent).toContain('peer-remote');

    // Click reset indicator to go back to Everyone
    const resetBtn = target.querySelector<HTMLButtonElement>('[data-testid="reset-recipient-btn"]');
    resetBtn?.click();
    flushSync();

    expect(recipientSelect?.value).toBe('everyone');

    unmount(component);
    target.remove();
  });

  it('copies room link with key from Roster 1-click copy button', async () => {
    window.history.replaceState({}, '', '/copy-room#key=mysecret');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const transport = new InMemoryTransport('user-local');

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    const component = mount(App, { target, props: { transport } });
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    const copyBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="roster-copy-link-btn"]',
    )!;
    expect(copyBtn).not.toBeNull();
    copyBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('/copy-room#key=mysecret'));
    expect(copyBtn.textContent).toContain('Copied');

    unmount(component);
    target.remove();
  });
});
