<script lang="ts">
  import { onDestroy } from 'svelte';
  import { formatDuration } from './voice-recorder';

  interface Props {
    src: string;
    fileName?: string;
  }

  let { src, fileName = 'Voice Note' }: Props = $props();

  let audioElement: HTMLAudioElement | null = $state(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);

  // Generate deterministic bar heights for visual waveform aesthetics
  const WAVE_BARS = [
    30, 45, 60, 25, 70, 85, 40, 95, 65, 80, 50, 75, 90, 35, 60, 45, 80, 55, 70, 40, 65, 85, 50, 75,
    60, 90, 45, 30, 50, 40,
  ];

  function togglePlay(): void {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play().catch(() => {
        // Autoplay/audio context handling
      });
    }
  }

  function handleTimeUpdate(): void {
    if (!audioElement) return;
    currentTime = audioElement.currentTime;
    if (audioElement.duration && !isNaN(audioElement.duration)) {
      duration = audioElement.duration;
    }
  }

  function handleLoadedMetadata(): void {
    if (!audioElement) return;
    if (audioElement.duration && !isNaN(audioElement.duration)) {
      duration = audioElement.duration;
    }
  }

  function handleSeek(e: Event): void {
    const input = e.target as HTMLInputElement;
    const targetTime = parseFloat(input.value);
    currentTime = targetTime;
    if (audioElement) {
      audioElement.currentTime = targetTime;
    }
  }

  function handleEnded(): void {
    isPlaying = false;
    currentTime = 0;
    if (audioElement) {
      audioElement.currentTime = 0;
    }
  }

  onDestroy(() => {
    if (audioElement) {
      audioElement.pause();
    }
  });
</script>

<div class="waveform-player" data-testid="waveform-player">
  <audio
    bind:this={audioElement}
    {src}
    preload="metadata"
    onplay={() => (isPlaying = true)}
    onpause={() => (isPlaying = false)}
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    onended={handleEnded}
    class="hidden-audio"
  ></audio>

  <button
    type="button"
    class="play-btn"
    onclick={togglePlay}
    data-testid="audio-play-pause-btn"
    aria-label={isPlaying ? 'Pause' : 'Play'}
  >
    {#if isPlaying}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    {/if}
  </button>

  <div class="player-content">
    <div class="waveform-wrapper">
      <div class="waveform-bars" aria-hidden="true">
        {#each WAVE_BARS as barHeight, index (index)}
          {@const barProgress = (index + 0.5) / WAVE_BARS.length}
          {@const isActive = duration > 0 ? currentTime / duration >= barProgress : false}
          <div class="wave-bar {isActive ? 'active' : ''}" style="height: {barHeight}%;"></div>
        {/each}
      </div>

      <input
        type="range"
        min="0"
        max={duration || 100}
        step="0.05"
        value={currentTime}
        oninput={handleSeek}
        class="waveform-scrubber"
        data-testid="audio-scrubber"
        aria-label="Seek audio"
      />
    </div>

    <div class="player-meta">
      <span class="file-name">{fileName}</span>
      <span class="duration-display" data-testid="audio-time">
        {formatDuration(currentTime * 1000)} / {formatDuration((duration || 0) * 1000)}
      </span>
    </div>
  </div>
</div>

<style>
  .waveform-player {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    box-sizing: border-box;
  }

  .hidden-audio {
    display: none;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: #6366f1;
    color: #ffffff;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      transform 0.15s ease,
      background-color 0.15s ease;
  }

  .play-btn:hover {
    background: #4f46e5;
    transform: scale(1.05);
  }

  .player-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .waveform-wrapper {
    position: relative;
    height: 32px;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .waveform-bars {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    pointer-events: none;
  }

  .wave-bar {
    flex: 1;
    min-width: 2px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
    transition: background-color 0.1s ease;
  }

  .wave-bar.active {
    background: #818cf8;
  }

  .waveform-scrubber {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    margin: 0;
    z-index: 2;
  }

  .player-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .duration-display {
    font-variant-numeric: tabular-nums;
  }
</style>
