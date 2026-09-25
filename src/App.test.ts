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
});
