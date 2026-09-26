import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { captureScreenGrab } from './screengrab';

describe('captureScreenGrab', () => {
  let mockTrack: { stop: ReturnType<typeof vi.fn> };
  let mockStream: { getTracks: () => unknown[] };

  beforeEach(() => {
    mockTrack = { stop: vi.fn() };
    mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes getDisplayMedia and stops stream tracks immediately after capture', async () => {
    // Mock offscreen canvas and video element behavior in jsdom
    const mockToBlob = vi.fn((cb: (b: Blob) => void) => {
      cb(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    });

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = origCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }) as unknown as typeof canvas.getContext;
        canvas.toBlob = mockToBlob as unknown as typeof canvas.toBlob;
        return canvas;
      }
      if (tagName === 'video') {
        const video = origCreateElement('video');
        video.play = vi.fn().mockResolvedValue(undefined);
        // trigger canplay event shortly after srcObject is set
        Object.defineProperty(video, 'srcObject', {
          set() {
            setTimeout(() => {
              Object.defineProperty(video, 'videoWidth', { value: 800 });
              Object.defineProperty(video, 'videoHeight', { value: 600 });
              video.dispatchEvent(new Event('canplay'));
            }, 10);
          },
        });
        return video;
      }
      return origCreateElement(tagName);
    });

    const file = await captureScreenGrab();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: false,
    });
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(file).toBeInstanceOf(File);
    expect(file.name).toMatch(/^screen-grab-.*\.png$/);
    expect(file.type).toBe('image/png');
  });
});
