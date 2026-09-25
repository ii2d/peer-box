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
});
