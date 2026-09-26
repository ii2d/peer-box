import { describe, it, expect, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import PortalView from './PortalView.svelte';

describe('PortalView Component', () => {
  it('renders brand, 1-click create button, room name/key inputs, and trust chips', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(PortalView, {
      target,
      props: {
        roomName: '',
        roomKey: '',
        errorMessage: null,
      },
    });

    expect(target.querySelector('h1')?.textContent).toContain('PeerBox');
    expect(target.querySelector('[data-testid="instant-create-btn"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="room-input"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="random-btn"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="key-input"]')).not.toBeNull();
    expect(target.querySelector('[data-testid="join-btn"]')).not.toBeNull();
    expect(target.textContent).toContain('End-to-End Encrypted');
    expect(target.textContent).toContain('Zero-TURN Direct P2P');

    unmount(component);
    target.remove();
  });

  it('renders below-the-fold semantic sections: features, architecture, comparison table, and FAQ', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(PortalView, {
      target,
      props: {},
    });

    expect(target.querySelector('.features-section')).not.toBeNull();
    expect(target.querySelector('.architecture-section')).not.toBeNull();
    expect(target.querySelector('.comparison-table')).not.toBeNull();
    expect(target.querySelectorAll('.faq-item').length).toBeGreaterThanOrEqual(4);
    expect(target.querySelector('a[href="/llms.txt"]')).not.toBeNull();

    unmount(component);
    target.remove();
  });

  it('triggers onRandomName and onCreateInstant callbacks on user click', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const onRandomName = vi.fn();
    const onCreateInstant = vi.fn();

    const component = mount(PortalView, {
      target,
      props: {
        roomName: 'test-room',
        onRandomName,
        onCreateInstant,
      },
    });

    const instantBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="instant-create-btn"]',
    );
    instantBtn?.click();
    flushSync();
    expect(onCreateInstant).toHaveBeenCalledTimes(1);

    const randomBtn = target.querySelector<HTMLButtonElement>('[data-testid="random-btn"]');
    randomBtn?.click();
    flushSync();
    expect(onRandomName).toHaveBeenCalledTimes(1);

    unmount(component);
    target.remove();
  });

  it('displays error banner when errorMessage prop is provided', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(PortalView, {
      target,
      props: {
        errorMessage: 'Invalid room name provided.',
      },
    });

    const errorBanner = target.querySelector('[data-testid="error-banner"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('Invalid room name provided.');

    unmount(component);
    target.remove();
  });
});
