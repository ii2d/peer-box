<script lang="ts">
  import { onDestroy } from 'svelte';
  import { VoiceRecorder, formatDuration } from './voice-recorder';
  import type { VoiceRecording, VoiceRecorderStatus } from './types';
  import WaveformPlayer from './WaveformPlayer.svelte';

  interface Props {
    onSend?: (file: File) => void;
    onCancel?: () => void;
    recipientName?: string;
  }

  let { onSend, onCancel, recipientName = 'Everyone' }: Props = $props();

  let status: VoiceRecorderStatus = $state('idle');
  let elapsedMs = $state(0);
  let audioLevel = $state(0);
  let recording: VoiceRecording | null = $state(null);
  let errorMessage: string | null = $state(null);

  const recorder = new VoiceRecorder({
    onLevelChange: (lvl) => {
      audioLevel = lvl;
    },
    onTimer: (ms) => {
      elapsedMs = ms;
    },
  });

  async function handleStart(): Promise<void> {
    errorMessage = null;
    try {
      await recorder.start();
      status = 'recording';
    } catch (err) {
      errorMessage = (err as Error).message || 'Microphone access denied';
      status = 'idle';
    }
  }

  async function handleStop(): Promise<void> {
    try {
      const rec = await recorder.stop();
      recording = rec;
      status = 'previewing';
    } catch {
      status = 'idle';
    }
  }

  function handleCancel(): void {
    recorder.cancel();
    status = 'idle';
    recording = null;
    elapsedMs = 0;
    audioLevel = 0;
    errorMessage = null;
    onCancel?.();
  }

  function handleSend(): void {
    if (recording) {
      onSend?.(recording.file);
      handleCancel();
    }
  }

  onDestroy(() => {
    recorder.cancel();
  });
</script>

<div class="voice-recorder-widget" data-testid="voice-recorder-widget">
  {#if status === 'idle'}
    <button
      type="button"
      class="mic-btn"
      onclick={handleStart}
      data-testid="mic-record-btn"
      title="Record Voice Note"
      aria-label="Record Voice Note"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path
          d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
        />
      </svg>
    </button>
    {#if errorMessage}
      <span class="mic-error" role="alert">{errorMessage}</span>
    {/if}
  {:else if status === 'recording'}
    <div class="recording-bar" data-testid="recording-bar">
      <div class="recording-indicator">
        <span
          class="pulse-dot"
          style="transform: scale({1 + audioLevel * 0.8});"
          data-testid="recording-pulsation"
        ></span>
        <span class="recording-timer" data-testid="recording-timer">
          {formatDuration(elapsedMs)}
        </span>
      </div>

      <div class="recording-audio-waves" aria-hidden="true">
        <span class="wave-bar" style="height: {Math.max(4, audioLevel * 24)}px"></span>
        <span class="wave-bar" style="height: {Math.max(4, audioLevel * 32)}px"></span>
        <span class="wave-bar" style="height: {Math.max(4, audioLevel * 18)}px"></span>
        <span class="wave-bar" style="height: {Math.max(4, audioLevel * 28)}px"></span>
      </div>

      <div class="recording-actions">
        <button
          type="button"
          class="btn-cancel-recording"
          onclick={handleCancel}
          data-testid="cancel-record-btn"
          title="Cancel recording"
          aria-label="Cancel recording"
        >
          ✕
        </button>
        <button
          type="button"
          class="btn-stop-recording"
          onclick={handleStop}
          data-testid="stop-record-btn"
          title="Finish recording"
          aria-label="Finish recording"
        >
          ✓
        </button>
      </div>
    </div>
  {:else if status === 'previewing' && recording}
    <div class="preview-bar" data-testid="voice-preview-bar">
      <div class="preview-player-wrap" data-testid="voice-preview">
        <WaveformPlayer src={recording.url} fileName={recording.file.name} />
      </div>

      <div class="preview-actions">
        <button
          type="button"
          class="btn-discard"
          onclick={handleCancel}
          data-testid="discard-voice-btn"
          title="Discard Voice Note"
        >
          Discard
        </button>
        <button
          type="button"
          class="btn-send-voice"
          onclick={handleSend}
          data-testid="send-voice-btn"
        >
          Send to {recipientName}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-recorder-widget {
    display: inline-flex;
    align-items: center;
  }

  .mic-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mic-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .mic-error {
    font-size: 11px;
    color: #ef4444;
    margin-left: 8px;
  }

  .recording-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 14px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 20px;
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pulse-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px #ef4444;
    transition: transform 0.05s ease;
  }

  .recording-timer {
    font-size: 13px;
    font-weight: 600;
    color: #f87171;
    font-variant-numeric: tabular-nums;
  }

  .recording-audio-waves {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 24px;
  }

  .wave-bar {
    width: 3px;
    background: #f87171;
    border-radius: 2px;
    transition: height 0.05s ease;
  }

  .recording-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-cancel-recording,
  .btn-stop-recording {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-cancel-recording {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-cancel-recording:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn-stop-recording {
    background: #ef4444;
    color: #ffffff;
    font-weight: bold;
  }

  .btn-stop-recording:hover {
    background: #dc2626;
  }

  .preview-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 600px;
  }

  .preview-player-wrap {
    flex: 1;
  }

  .preview-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-discard {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-discard:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-send-voice {
    background: #6366f1;
    border: none;
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-send-voice:hover {
    background: #4f46e5;
  }
</style>
