import { describe, expect, it } from 'vitest';
import { createStorage } from './opfs-storage';

describe('Storage Seam (OPFS & Memory Fallback)', () => {
  it('writes chunks into memory sink when OPFS is unavailable', async () => {
    const storage = createStorage({ forceMemory: true });
    expect(storage.isOpfs).toBe(false);

    const sink = await storage.createSink('large.bin', 'application/octet-stream');
    await sink.write(new Uint8Array([1, 2, 3]));
    await sink.write(new Uint8Array([4, 5, 6]));

    const result = await sink.close();
    expect(result.size).toBe(6);
    expect(result.type).toBe('application/octet-stream');
  });

  it('aborts sink cleanly and cleans up', async () => {
    const storage = createStorage({ forceMemory: true });
    const sink = await storage.createSink('temp.bin', 'application/octet-stream');
    await sink.write(new Uint8Array([1, 2, 3]));
    await sink.abort();

    await expect(storage.deleteFile('temp.bin')).resolves.not.toThrow();
  });
});
