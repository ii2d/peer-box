import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import VoiceNoteRecorder from './VoiceNoteRecorder.svelte';

describe('VoiceNoteRecorder', () => {
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

  it('renders microphone button in idle state', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(VoiceNoteRecorder, {
      target,
      props: {},
    });

    const micBtn = target.querySelector('[data-testid="mic-record-btn"]');
    expect(micBtn).toBeTruthy();

    unmount(component);
    target.remove();
  });

  it('transitions to recording state when mic button clicked', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(VoiceNoteRecorder, {
      target,
      props: {},
    });

    const micBtn = target.querySelector<HTMLButtonElement>('[data-testid="mic-record-btn"]');
    expect(micBtn).toBeTruthy();
    micBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    expect(target.querySelector('[data-testid="recording-timer"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="recording-pulsation"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="cancel-record-btn"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="stop-record-btn"]')).toBeTruthy();

    unmount(component);
    target.remove();
  });

  it('transitions to previewing state on stop, and dispatches onSend on send', async () => {
    const onSend = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(VoiceNoteRecorder, {
      target,
      props: { onSend },
    });

    const micBtn = target.querySelector<HTMLButtonElement>('[data-testid="mic-record-btn"]');
    micBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    const stopBtn = target.querySelector<HTMLButtonElement>('[data-testid="stop-record-btn"]');
    expect(stopBtn).toBeTruthy();
    stopBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    expect(target.querySelector('[data-testid="voice-preview"]')).toBeTruthy();
    const sendBtn = target.querySelector<HTMLButtonElement>('[data-testid="send-voice-btn"]');
    expect(sendBtn).toBeTruthy();
    sendBtn?.click();
    flushSync();

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toBeInstanceOf(File);

    unmount(component);
    target.remove();
  });
});
