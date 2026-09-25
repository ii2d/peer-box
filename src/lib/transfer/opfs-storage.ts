export interface FileStorageSink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<Blob | File>;
  abort(): Promise<void>;
}

export interface FileStorage {
  readonly isOpfs: boolean;
  createSink(fileName: string, mimeType: string): Promise<FileStorageSink>;
  deleteFile(fileName: string): Promise<void>;
}

export interface CreateStorageOptions {
  forceMemory?: boolean;
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

class MemoryFileStorage implements FileStorage {
  readonly isOpfs = false;

  async createSink(_fileName: string, mimeType: string): Promise<FileStorageSink> {
    const chunks: Uint8Array[] = [];

    return {
      async write(chunk: Uint8Array): Promise<void> {
        chunks.push(chunk);
      },
      async close(): Promise<Blob> {
        return new Blob(chunks as BlobPart[], {
          type: mimeType || 'application/octet-stream',
        });
      },
      async abort(): Promise<void> {
        chunks.length = 0;
      },
    };
  }

  async deleteFile(_fileName: string): Promise<void> {
    void _fileName;
    // Memory files are garbage collected
  }
}

class OpfsFileStorage implements FileStorage {
  readonly isOpfs = true;

  async createSink(fileName: string): Promise<FileStorageSink> {
    const root = await navigator.storage.getDirectory();
    const tempName = `temp_${Date.now()}_${fileName}`;
    const fileHandle = await root.getFileHandle(tempName, { create: true });
    const writable = await fileHandle.createWritable();

    return {
      async write(chunk: Uint8Array): Promise<void> {
        await writable.write(chunk as unknown as FileSystemWriteChunkType);
      },
      async close(): Promise<File> {
        await writable.close();
        return await fileHandle.getFile();
      },
      async abort(): Promise<void> {
        try {
          await writable.abort();
        } catch {
          // ignore
        }
        try {
          await root.removeEntry(tempName);
        } catch {
          // ignore
        }
      },
    };
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(fileName);
    } catch {
      // ignore
    }
  }
}

export function createStorage(options: CreateStorageOptions = {}): FileStorage {
  if (!options.forceMemory && isOpfsSupported()) {
    return new OpfsFileStorage();
  }
  return new MemoryFileStorage();
}

export function exportFileToDisk(fileOrBlob: Blob | File, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const url = URL.createObjectURL(fileOrBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
