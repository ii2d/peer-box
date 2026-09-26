import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import BrandIcon from './BrandIcon.svelte';

describe('BrandIcon Component', () => {
  it('generates unique gradient IDs for multiple instances without DOM ID collision', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance1 = mount(BrandIcon, {
      target,
      props: { size: 24 },
    });

    const instance2 = mount(BrandIcon, {
      target,
      props: { size: 32 },
    });

    const gradients = target.querySelectorAll('linearGradient, radialGradient');
    const ids = Array.from(gradients).map((g) => g.id);
    const uniqueIds = new Set(ids);

    // Ensure all gradient IDs across both instances are completely unique
    expect(ids.length).toBeGreaterThan(0);
    expect(uniqueIds.size).toBe(ids.length);

    // Verify SVG fill references point to the corresponding generated IDs
    const svgs = target.querySelectorAll('svg');
    expect(svgs.length).toBe(2);

    const svg1Glow = svgs[0].querySelector('.brand-ambient-glow');
    expect(svg1Glow?.getAttribute('fill')).toMatch(/^url\(#brandGlow-\d+\)$/);

    const svg2Glow = svgs[1].querySelector('.brand-ambient-glow');
    expect(svg2Glow?.getAttribute('fill')).toMatch(/^url\(#brandGlow-\d+\)$/);

    // Ensure the two instances use different IDs
    expect(svg1Glow?.getAttribute('fill')).not.toBe(svg2Glow?.getAttribute('fill'));

    unmount(instance1);
    unmount(instance2);
    target.remove();
  });

  it('marks icon as aria-hidden="true" by default when no label is provided', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(BrandIcon, {
      target,
      props: { size: 20 },
    });

    const wrapper = target.querySelector('.brand-icon-wrapper');
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.hasAttribute('role')).toBe(false);
    expect(wrapper?.hasAttribute('aria-label')).toBe(false);

    unmount(instance);
    target.remove();
  });

  it('applies role="img" and aria-label when label prop is specified', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(BrandIcon, {
      target,
      props: { size: 28, label: 'PeerBox Application Logo' },
    });

    const wrapper = target.querySelector('.brand-icon-wrapper');
    expect(wrapper?.getAttribute('role')).toBe('img');
    expect(wrapper?.getAttribute('aria-label')).toBe('PeerBox Application Logo');
    expect(wrapper?.hasAttribute('aria-hidden')).toBe(false);

    unmount(instance);
    target.remove();
  });

  it('applies custom dimensions and classes properly', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(BrandIcon, {
      target,
      props: { size: 48, class: 'custom-brand-class' },
    });

    const wrapper = target.querySelector<HTMLElement>('.brand-icon-wrapper');
    expect(wrapper?.classList.contains('custom-brand-class')).toBe(true);
    expect(wrapper?.style.width).toBe('48px');
    expect(wrapper?.style.height).toBe('48px');

    unmount(instance);
    target.remove();
  });
});
