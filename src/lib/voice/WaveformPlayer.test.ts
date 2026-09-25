import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import WaveformPlayer from './WaveformPlayer.svelte';

describe('WaveformPlayer', () => {
  it('renders play button, scrubber and duration', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(WaveformPlayer, {
      target,
      props: {
        src: 'blob:mock-audio',
        fileName: 'voice-note.webm',
      },
    });

    expect(target.querySelector('[data-testid="audio-play-pause-btn"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="audio-scrubber"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="audio-time"]')).toBeTruthy();

    unmount(component);
    target.remove();
  });

  it('toggles play/pause state when clicked', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(WaveformPlayer, {
      target,
      props: {
        src: 'blob:mock-audio',
      },
    });

    const playBtn = target.querySelector<HTMLButtonElement>('[data-testid="audio-play-pause-btn"]');
    expect(playBtn).toBeTruthy();
    playBtn?.click();
    flushSync();

    unmount(component);
    target.remove();
  });
});
