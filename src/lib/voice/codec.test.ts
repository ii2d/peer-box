import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getSupportedAudioCodec } from './codec';

describe('getSupportedAudioCodec', () => {
  const originalMediaRecorder = globalThis.MediaRecorder;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalMediaRecorder) {
      globalThis.MediaRecorder = originalMediaRecorder;
    } else {
      delete (globalThis as unknown as Record<string, unknown>).MediaRecorder;
    }
  });

  it('selects audio/webm;codecs=opus if supported (Chrome/Firefox)', () => {
    (globalThis as unknown as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (type: string) => type === 'audio/webm;codecs=opus',
    };

    const codec = getSupportedAudioCodec();
    expect(codec.mimeType).toBe('audio/webm;codecs=opus');
    expect(codec.extension).toBe('webm');
  });

  it('falls back to audio/mp4 if audio/webm is unsupported (Safari/iOS)', () => {
    (globalThis as unknown as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (type: string) => type === 'audio/mp4',
    };

    const codec = getSupportedAudioCodec();
    expect(codec.mimeType).toBe('audio/mp4');
    expect(codec.extension).toBe('mp4');
  });

  it('returns default webm if MediaRecorder is not defined or has no isTypeSupported', () => {
    delete (globalThis as unknown as Record<string, unknown>).MediaRecorder;

    const codec = getSupportedAudioCodec();
    expect(codec.mimeType).toBe('audio/webm;codecs=opus');
    expect(codec.extension).toBe('webm');
  });
});
