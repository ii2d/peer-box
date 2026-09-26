import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ScreenGrabPreviewTray from './ScreenGrabPreviewTray.svelte';

describe('ScreenGrabPreviewTray', () => {
  const dummyFile = new File([new Uint8Array([1, 2, 3])], 'screen-grab-test.png', {
    type: 'image/png',
  });

  it('renders thumbnail, caption input, recipient picker, and send/cancel buttons', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(ScreenGrabPreviewTray, {
      target,
      props: {
        file: dummyFile,
        previewUrl: 'blob:test-preview',
        peers: [{ id: 'peer-1', name: 'Cool Cat' }],
        onSend: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(target.querySelector('[data-testid="screengrab-preview"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="screengrab-caption-input"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="screengrab-recipient-select"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="screengrab-send-btn"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="screengrab-cancel-btn"]')).toBeTruthy();

    unmount(component);
    target.remove();
  });

  it('fires onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(ScreenGrabPreviewTray, {
      target,
      props: {
        file: dummyFile,
        previewUrl: 'blob:test-preview',
        peers: [],
        onSend: vi.fn(),
        onCancel,
      },
    });

    const cancelBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="screengrab-cancel-btn"]',
    );
    cancelBtn?.click();
    flushSync();

    expect(onCancel).toHaveBeenCalled();

    unmount(component);
    target.remove();
  });

  it('fires onSend with file, caption, and selected recipient when send button clicked', () => {
    const onSend = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(ScreenGrabPreviewTray, {
      target,
      props: {
        file: dummyFile,
        previewUrl: 'blob:test-preview',
        peers: [{ id: 'peer-1', name: 'Cool Cat' }],
        initialRecipientId: 'peer-1',
        onSend,
        onCancel: vi.fn(),
      },
    });

    const captionInput = target.querySelector<HTMLInputElement>(
      '[data-testid="screengrab-caption-input"]',
    )!;
    captionInput.value = 'Look at this diagram';
    captionInput.dispatchEvent(new Event('input'));
    flushSync();

    const sendBtn = target.querySelector<HTMLButtonElement>('[data-testid="screengrab-send-btn"]')!;
    sendBtn.click();
    flushSync();

    expect(onSend).toHaveBeenCalledWith(dummyFile, 'Look at this diagram', 'peer-1');

    unmount(component);
    target.remove();
  });
});
