export async function captureScreenGrab(): Promise<File> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    throw new Error('Screen capture is not supported in this browser');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });

  try {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      const handleCanPlay = () => {
        cleanup();
        resolve();
      };
      const handleError = (e: Event) => {
        cleanup();
        reject(new Error(`Failed to load screen stream: ${e}`));
      };
      const cleanup = () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);

      video.play().catch(() => {
        // Canplay event will still resolve
      });
    });

    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain canvas 2D rendering context');
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Immediately terminate all media stream tracks to guarantee privacy and release system recording indicator
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('Failed to export canvas frame as blob'));
        }
      }, 'image/png');
    });

    const fileName = `screen-grab-${Date.now()}.png`;
    return new File([blob], fileName, { type: 'image/png' });
  } finally {
    // Ensure all tracks are stopped even if an error occurred during frame processing
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
  }
}
