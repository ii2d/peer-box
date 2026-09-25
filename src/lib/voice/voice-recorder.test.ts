import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { VoiceRecorder } from './voice-recorder';

describe('VoiceRecorder', () => {
  let mockTrack: { stop: ReturnType<typeof vi.fn> };
  let mockStream: { getTracks: () => unknown[] };
  let mockRecorderInstance: {
    state: string;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    ondataavailable: ((e: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
  };

  beforeEach(() => {
    mockTrack = { stop: vi.fn() };
    mockStream = { getTracks: () => [mockTrack] };

    mockRecorderInstance = {
      state: 'inactive',
      start: vi.fn().mockImplementation(() => {
        mockRecorderInstance.state = 'recording';
      }),
      stop: vi.fn().mockImplementation(() => {
        mockRecorderInstance.state = 'inactive';
        if (mockRecorderInstance.ondataavailable) {
          mockRecorderInstance.ondataavailable({
            data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }),
          });
        }
        if (mockRecorderInstance.onstop) {
          mockRecorderInstance.onstop();
        }
      }),
      ondataavailable: null,
      onstop: null,
    };

    class MockMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true);
      state = 'inactive';
      start = mockRecorderInstance.start;
      stop = mockRecorderInstance.stop;
      ondataavailable = null;
      onstop = null;
      constructor() {
        return mockRecorderInstance as unknown as MockMediaRecorder;
      }
    }

    (globalThis as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in idle status', () => {
    const recorder = new VoiceRecorder();
    expect(recorder.getStatus()).toBe('idle');
  });

  it('initiates audio capture via getUserMedia and MediaRecorder on start()', async () => {
    const recorder = new VoiceRecorder();
    await recorder.start();

    expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
    expect(recorder.getStatus()).toBe('recording');
    expect(mockRecorderInstance.start).toHaveBeenCalled();
  });

  it('stops recording, stops tracks, and returns a VoiceRecording file', async () => {
    const recorder = new VoiceRecorder();
    await recorder.start();

    const recording = await recorder.stop();

    expect(mockRecorderInstance.stop).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(recording).toBeDefined();
    expect(recording.blob).toBeInstanceOf(Blob);
    expect(recording.file.name).toMatch(/^voice-note-.*\.webm$/);
    expect(recorder.getStatus()).toBe('previewing');
  });

  it('cancels recording and stops all audio tracks', async () => {
    const recorder = new VoiceRecorder();
    await recorder.start();

    recorder.cancel();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(recorder.getStatus()).toBe('idle');
  });
});
