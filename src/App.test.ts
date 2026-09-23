import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import App from './App.svelte';

describe('App component', () => {
  it('renders Hello World title correctly', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(App, { target });

    const title = target.querySelector('.title');
    expect(title?.textContent).toBe('Hello World');

    const counter = target.querySelector('[data-testid="counter-val"]');
    expect(counter?.textContent).toBe('0');

    unmount(component);
    target.remove();
  });
});
