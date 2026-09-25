import { beforeEach, describe, expect, it } from 'vitest';
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
});
