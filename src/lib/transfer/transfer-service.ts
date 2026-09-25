import type { Persona } from '../persona/persona';
import type { RoomTransport } from '../transport/types';
import { base64ToUint8Array, uint8ArrayToBase64 } from './base64';
import { detectMediaCategory } from './media-type';
import type { FileTransferChunk, FileTransferItem, FileTransferMeta } from './types';

export const MAX_SMALL_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB

export interface TransferServiceOptions {
  transport: RoomTransport;
  persona: Persona;
  chunkSize?: number;
}

interface IncomingBuffer {
  meta: FileTransferMeta;
  chunks: (Uint8Array | null)[];
  receivedCount: number;
}

export class TransferService {
  private transport: RoomTransport;
  private persona: Persona;
  private chunkSize: number;

  private transfers = new Map<string, FileTransferItem>();
  private incomingBuffers = new Map<string, IncomingBuffer>();
  private updateListeners = new Set<(item: FileTransferItem) => void>();

  private unsubMeta: (() => void) | null = null;
  private unsubChunk: (() => void) | null = null;

  constructor(options: TransferServiceOptions) {
    this.transport = options.transport;
    this.persona = options.persona;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

    this.unsubMeta = this.transport.onAction<FileTransferMeta>('file-meta', (meta, senderId) => {
      this.handleIncomingMeta(meta, senderId);
    });

    this.unsubChunk = this.transport.onAction<FileTransferChunk>('file-chunk', (chunk) => {
      this.handleIncomingChunk(chunk);
    });
  }

  setPersona(persona: Persona): void {
    this.persona = persona;
  }

  getTransfers(): FileTransferItem[] {
    return Array.from(this.transfers.values());
  }

  onTransferUpdate(cb: (item: FileTransferItem) => void): () => void {
    this.updateListeners.add(cb);
    return () => this.updateListeners.delete(cb);
  }

  private notify(item: FileTransferItem): void {
    for (const listener of this.updateListeners) {
      listener(item);
    }
  }

  private handleIncomingMeta(meta: FileTransferMeta, senderId: string): void {
    // If targeted to a specific peer, ignore if not meant for us
    if (meta.recipientId && meta.recipientId !== this.transport.localPeerId) {
      return;
    }

    const validatedMeta: FileTransferMeta = {
      ...meta,
      senderId: senderId || meta.senderId,
    };

    const mediaCategory = detectMediaCategory(meta.name, meta.mimeType);
    const item: FileTransferItem = {
      id: meta.id,
      meta: validatedMeta,
      receivedChunks: 0,
      totalChunks: meta.totalChunks,
      progress: 0,
      status: 'transferring',
      mediaCategory,
      isSender: false,
    };

    this.transfers.set(meta.id, item);
    this.incomingBuffers.set(meta.id, {
      meta: validatedMeta,
      chunks: new Array(meta.totalChunks).fill(null),
      receivedCount: 0,
    });

    this.notify(item);
  }

  private async handleIncomingChunk(chunk: FileTransferChunk): Promise<void> {
    const buffer = this.incomingBuffers.get(chunk.transferId);
    const item = this.transfers.get(chunk.transferId);
    if (!buffer || !item) return;

    if (chunk.chunkIndex < 0 || chunk.chunkIndex >= buffer.meta.totalChunks) return;
    if (buffer.chunks[chunk.chunkIndex] !== null) return; // duplicate

    const bytes = base64ToUint8Array(chunk.data);
    buffer.chunks[chunk.chunkIndex] = bytes;
    buffer.receivedCount++;

    item.receivedChunks = buffer.receivedCount;
    item.progress = buffer.receivedCount / buffer.meta.totalChunks;

    if (buffer.receivedCount === buffer.meta.totalChunks) {
      // Reassemble blob
      const validChunks = buffer.chunks.filter((c): c is Uint8Array => c !== null);
      const blob = new Blob(validChunks as BlobPart[], {
        type: buffer.meta.mimeType || 'application/octet-stream',
      });
      let blobUrl = '';
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          blobUrl = URL.createObjectURL(blob);
        }
      } catch {
        blobUrl = `blob:peerbox-${Math.random().toString(36).slice(2, 9)}`;
      }

      item.blob = blob;
      item.blobUrl = blobUrl;
      item.status = 'completed';
      item.progress = 1;

      // Extract text content for code/text previews
      if (item.mediaCategory === 'code' && typeof blob.text === 'function') {
        try {
          item.textContent = await blob.text();
        } catch {
          // ignore
        }
      }

      this.incomingBuffers.delete(chunk.transferId);
    }

    this.notify(item);
  }

  async sendFile(
    file: File,
    recipient?: { id: string; name?: string } | null,
  ): Promise<FileTransferItem> {
    if (file.size > MAX_SMALL_FILE_SIZE) {
      throw new Error('File exceeds 25MB limit');
    }

    const totalChunks = Math.ceil(file.size / this.chunkSize) || 1;
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const isPrivate = Boolean(recipient?.id);
    const mediaCategory = detectMediaCategory(file.name, file.type);

    const meta: FileTransferMeta = {
      id: transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      senderId: this.transport.localPeerId,
      senderName: this.persona.name,
      senderEmoji: this.persona.emoji,
      senderColor: this.persona.color,
      recipientId: recipient?.id ?? null,
      recipientName: recipient?.name,
      isPrivate,
      timestamp: Date.now(),
    };

    let blobUrl = '';
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        blobUrl = URL.createObjectURL(file);
      }
    } catch {
      blobUrl = `blob:peerbox-${Math.random().toString(36).slice(2, 9)}`;
    }

    let textContent: string | undefined;
    if (mediaCategory === 'code' && typeof file.text === 'function') {
      try {
        textContent = await file.text();
      } catch {
        // ignore
      }
    }

    const item: FileTransferItem = {
      id: transferId,
      meta,
      receivedChunks: 0,
      totalChunks,
      progress: 0,
      status: 'transferring',
      blob: file,
      blobUrl,
      mediaCategory,
      isSender: true,
      textContent,
    };

    this.transfers.set(transferId, item);
    this.notify(item);

    // Send metadata action
    const targetPeerId = recipient?.id;
    this.transport.sendAction('file-meta', meta, targetPeerId);

    // Slice and send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const slice = file.slice(start, end);
      const arrayBuffer = await slice.arrayBuffer();
      const b64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

      const chunkPayload: FileTransferChunk = {
        transferId,
        chunkIndex: i,
        data: b64,
      };

      this.transport.sendAction('file-chunk', chunkPayload, targetPeerId);

      item.receivedChunks = i + 1;
      item.progress = (i + 1) / totalChunks;
      this.notify(item);

      // Yield briefly to prevent freezing UI on larger files
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    item.status = 'completed';
    item.progress = 1;
    this.notify(item);

    return item;
  }

  destroy(): void {
    if (this.unsubMeta) {
      this.unsubMeta();
      this.unsubMeta = null;
    }
    if (this.unsubChunk) {
      this.unsubChunk();
      this.unsubChunk = null;
    }
    // Clean up created object URLs
    for (const item of this.transfers.values()) {
      if (item.blobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch {
          // ignore
        }
      }
    }
    this.transfers.clear();
    this.incomingBuffers.clear();
    this.updateListeners.clear();
  }
}
