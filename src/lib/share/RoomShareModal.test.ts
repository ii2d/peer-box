import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import RoomShareModal from './RoomShareModal.svelte';

describe('RoomShareModal', () => {
  let mockWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
      writable: true,
    });
  });

  it('renders QR code and share url with room key included by default', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(RoomShareModal, {
      target,
      props: {
        roomId: 'happy-fox',
        roomKey: 'secret99',
        onClose: vi.fn(),
      },
    });

    expect(target.querySelector('[data-testid="share-modal"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="qr-code"]')).toBeTruthy();
    const urlText = target.querySelector('[data-testid="share-url-text"]');
    expect(urlText?.textContent).toBe(`${window.location.origin}/happy-fox#key=secret99`);

    unmount(component);
    target.remove();
  });

  it('updates url and QR code when toggle is unchecked to exclude key', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(RoomShareModal, {
      target,
      props: {
        roomId: 'happy-fox',
        roomKey: 'secret99',
        onClose: vi.fn(),
      },
    });

    const toggle = target.querySelector<HTMLInputElement>('[data-testid="toggle-include-key"]');
    expect(toggle).toBeTruthy();
    expect(toggle?.checked).toBe(true);

    toggle?.click();
    flushSync();

    const urlText = target.querySelector('[data-testid="share-url-text"]');
    expect(urlText?.textContent).toBe(`${window.location.origin}/happy-fox`);

    unmount(component);
    target.remove();
  });

  it('copies invite link to clipboard when clicking copy button', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(RoomShareModal, {
      target,
      props: {
        roomId: 'happy-fox',
        roomKey: 'secret99',
        onClose: vi.fn(),
      },
    });

    const copyBtn = target.querySelector<HTMLButtonElement>('[data-testid="copy-link-btn"]');
    copyBtn?.click();
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(mockWriteText).toHaveBeenCalled();
    expect(target.textContent).toContain('Copied');

    unmount(component);
    target.remove();
  });
});
