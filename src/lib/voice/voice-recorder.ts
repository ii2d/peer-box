import { getSupportedAudioCodec } from './codec';
import type { AudioCodecInfo, VoiceRecording, VoiceRecorderStatus } from './types';

export interface VoiceRecorderCallbacks {
  onLevelChange?: (level: number) => void;
  onTimer?: (elapsedMs: number) => void;
}

export class VoiceRecorder {
  private status: VoiceRecorderStatus = 'idle';
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private animationFrameId: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private elapsedMs = 0;
  private chunks: Blob[] = [];
  private activeCodec: AudioCodecInfo = getSupportedAudioCodec();
  private lastRecording: VoiceRecording | null = null;
  private callbacks: VoiceRecorderCallbacks = {};

  constructor(callbacks: VoiceRecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  getStatus(): VoiceRecorderStatus {
    return this.status;
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  getLastRecording(): VoiceRecording | null {
    return this.lastRecording;
  }

  async start(): Promise<void> {
    if (this.status === 'recording') return;

    if (this.lastRecording?.url) {
      try {
        URL.revokeObjectURL(this.lastRecording.url);
      } catch {
        // ignore
      }
      this.lastRecording = null;
    }

    this.activeCodec = getSupportedAudioCodec();
    this.chunks = [];
    this.elapsedMs = 0;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: this.activeCodec.mimeType });
    } catch {
      // In case specific mimeType fails on browser
      recorder = new MediaRecorder(stream);
    }
    this.recorder = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    // Set up audio level monitoring if AudioContext is available
    this.setupAudioAnalysis(stream);

    recorder.start(100); // 100ms chunk slices
    this.status = 'recording';
    this.startTime = Date.now();

    this.timerInterval = setInterval(() => {
      this.elapsedMs = Date.now() - this.startTime;
      this.callbacks.onTimer?.(this.elapsedMs);
    }, 100);
  }

  private setupAudioAnalysis(stream: MediaStream): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      this.audioContext = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (this.status !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalized = Math.min(1, rms / 128); // 0.0 to 1.0

        this.callbacks.onLevelChange?.(normalized);
        this.animationFrameId = requestAnimationFrame(updateLevel);
      };

      this.animationFrameId = requestAnimationFrame(updateLevel);
    } catch {
      // AudioContext not supported or blocked, graceful fallback
    }
  }

  async stop(): Promise<VoiceRecording> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.status !== 'recording') {
        if (this.lastRecording) {
          resolve(this.lastRecording);
        } else {
          reject(new Error('No active recording'));
        }
        return;
      }

      this.stopAnalysisAndTimer();

      const finalElapsedMs = Math.max(1000, this.elapsedMs);

      this.recorder.onstop = () => {
        this.stopTracks();

        const blob = new Blob(this.chunks, { type: this.activeCodec.mimeType });
        const fileName = `voice-note-${Date.now()}.${this.activeCodec.extension}`;
        const file = new File([blob], fileName, { type: this.activeCodec.mimeType });

        let url = '';
        try {
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            url = URL.createObjectURL(blob);
          }
        } catch {
          url = '';
        }

        const recording: VoiceRecording = {
          blob,
          file,
          durationMs: finalElapsedMs,
          url,
        };

        this.lastRecording = recording;
        this.status = 'previewing';
        resolve(recording);
      };

      try {
        this.recorder.stop();
      } catch (err) {
        this.stopTracks();
        this.status = 'idle';
        reject(err);
      }
    });
  }

  cancel(): void {
    this.stopAnalysisAndTimer();
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.stopTracks();
    this.chunks = [];
    this.elapsedMs = 0;
    this.callbacks.onLevelChange?.(0);
    this.callbacks.onTimer?.(0);

    if (this.lastRecording?.url) {
      try {
        URL.revokeObjectURL(this.lastRecording.url);
      } catch {
        // ignore
      }
      this.lastRecording = null;
    }

    this.status = 'idle';
  }

  private stopAnalysisAndTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  private stopTracks(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.stream = null;
    }
  }
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
