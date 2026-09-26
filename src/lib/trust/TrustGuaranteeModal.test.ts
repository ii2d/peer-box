import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import TrustGuaranteeModal from './TrustGuaranteeModal.svelte';

describe('TrustGuaranteeModal', () => {
  it('renders 4 visual summary cards with plain explanations and close button', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(TrustGuaranteeModal, {
      target,
      props: {
        onClose: vi.fn(),
      },
    });

    expect(target.querySelector('[data-testid="trust-modal"]')).toBeTruthy();
    expect(target.textContent).toContain('Trust Guarantee');

    // 4 visual cards
    const cards = target.querySelectorAll('[data-testid^="trust-card-"]');
    expect(cards.length).toBe(4);

    expect(target.textContent).toContain('Zero Servers');
    expect(target.textContent).toContain('Room Key Encryption');
    expect(target.textContent).toContain('Ephemeral Memory');
    expect(target.textContent).toContain('Direct P2P & IP Disclosure');

    unmount(component);
    target.remove();
  });

  it('expands technical deep-dive section when clicking a card', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(TrustGuaranteeModal, {
      target,
      props: {
        onClose: vi.fn(),
      },
    });

    const expandBtn = target.querySelector<HTMLButtonElement>('[data-testid="expand-card-0"]');
    expect(expandBtn).toBeTruthy();

    expandBtn?.click();
    flushSync();

    // Verify technical mechanics text is displayed
    expect(target.textContent).toContain('Nostr');
    expect(target.textContent).toContain('Zero-TURN');

    unmount(component);
    target.remove();
  });

  it('fires onClose callback when close button is clicked', () => {
    const onClose = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(TrustGuaranteeModal, {
      target,
      props: { onClose },
    });

    const closeBtn = target.querySelector<HTMLButtonElement>(
      '[data-testid="close-trust-modal-btn"]',
    );
    closeBtn?.click();
    flushSync();

    expect(onClose).toHaveBeenCalled();

    unmount(component);
    target.remove();
  });

  it('renders link to /privacy/ opening in a new tab', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const component = mount(TrustGuaranteeModal, {
      target,
      props: { onClose: vi.fn() },
    });

    const link = target.querySelector<HTMLAnchorElement>('[data-testid="privacy-page-link"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/privacy/');
    expect(link?.getAttribute('target')).toBe('_blank');

    unmount(component);
    target.remove();
  });
});
