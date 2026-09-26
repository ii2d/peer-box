import { describe, it, expect } from 'vitest';
import indexHtml from '../index.html?raw';

describe('Index page initial render & FOUC flash prevention', () => {
  it('does not render raw pre-baked HTML directly in #app before JS hydration', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexHtml, 'text/html');

    const appContainer = doc.getElementById('app');
    expect(appContainer).not.toBeNull();

    // The root mount container #app must NOT contain visible unstyled raw DOM nodes
    // (such as <header>, <nav>, <main>) before Svelte mounts, which causes the page
    // to flash raw unstyled content on entry before main.ts clears target.innerHTML.
    const rawVisibleChildren = appContainer?.querySelectorAll('header, nav, main, footer') ?? [];
    expect(rawVisibleChildren.length).toBe(0);

    // Verify app.css is linked in <head> to prevent unstyled flash of background/fonts
    const cssLink = doc.querySelector('link[rel="stylesheet"][href="/src/app.css"]');
    expect(cssLink).not.toBeNull();
  });
});
