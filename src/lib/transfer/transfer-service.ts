import type { Persona } from '../persona/persona';
import type { RoomTransport } from '../transport/types';
import { base64ToUint8Array, uint8ArrayToBase64 } from './base64';
import { detectMediaCategory } from './media-type';
import {
  createStorage,
  exportFileToDisk,
  type FileStorage,
  type FileStorageSink,
} from './opfs-storage';
import { createTransferTelemetry, type TransferTelemetry } from './telemetry';
import type {
  FileTransferAck,
  FileTransferCancel,
  FileTransferChunk,
  FileTransferDecision,
  FileTransferItem,
  FileTransferMeta,
  FileTransferStatus,
} from './types';

export const MAX_SMALL_FILE_SIZE = 25 * 1024 * 1024; // 25MB threshold
export const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks

export interface TransferServiceOptions {
  transport: RoomTransport;
  persona: Persona;
  chunkSize?: number;
  storage?: FileStorage;
}

interface ActiveIncomingTransfer {
  meta: FileTransferMeta;
  sink?: FileStorageSink;
  receivedChunks: number;
  bytesReceived: number;
  telemetry: TransferTelemetry;
  ackTimer?: ReturnType<typeof setInterval>;
  cancelled: boolean;
}

interface ActiveOutgoingTransfer {
  meta: FileTransferMeta;
  telemetry: TransferTelemetry;
  cancelled: boolean;
  decisionResolve?: (accepted: boolean) => void;
  decisionReject?: (err: Error) => void;
}

export class TransferService {
  private transport: RoomTransport;
  private persona: Persona;
  private chunkSize: number;
  private storage: FileStorage;

  private transfers = new Map<string, FileTransferItem>();
  private incoming = new Map<string, ActiveIncomingTransfer>();
  private outgoing = new Map<string, ActiveOutgoingTransfer>();
  private updateListeners = new Set<(item: FileTransferItem) => void>();

  private unsubs: Array<() => void> = [];

  constructor(options: TransferServiceOptions) {
    this.transport = options.transport;
    this.persona = options.persona;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    this.storage = options.storage ?? createStorage();

    this.unsubs.push(
      this.transport.onAction<FileTransferMeta>('file-meta', (meta, senderId) => {
        this.handleIncomingMeta(meta, senderId);
      }),
    );

    this.unsubs.push(
      this.transport.onAction<FileTransferChunk>('file-chunk', (chunk) => {
        this.handleIncomingChunk(chunk);
      }),
    );

    this.unsubs.push(
      this.transport.onAction<FileTransferDecision>('file-decision', (decision) => {
        this.handleDecision(decision);
      }),
    );

    this.unsubs.push(
      this.transport.onAction<FileTransferAck>('file-ack', (ack) => {
        this.handleAck(ack);
      }),
    );

    this.unsubs.push(
      this.transport.onAction<FileTransferCancel>('file-cancel', (cancel) => {
        this.handleCancel(cancel.transferId, false);
      }),
    );
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
    if (meta.recipientId && meta.recipientId !== this.transport.localPeerId) {
      return;
    }

    const validatedMeta: FileTransferMeta = {
      ...meta,
      senderId: senderId || meta.senderId,
    };

    const mediaCategory = detectMediaCategory(meta.name, meta.mimeType);
    const status: FileTransferStatus = meta.isLarge ? 'pending-decision' : 'transferring';

    const item: FileTransferItem = {
      id: meta.id,
      meta: validatedMeta,
      receivedChunks: 0,
      totalChunks: meta.totalChunks,
      bytesTransferred: 0,
      progress: 0,
      status,
      mediaCategory,
      isSender: false,
    };

    this.transfers.set(meta.id, item);

    const incomingTransfer: ActiveIncomingTransfer = {
      meta: validatedMeta,
      receivedChunks: 0,
      bytesReceived: 0,
      telemetry: createTransferTelemetry(meta.size),
      cancelled: false,
    };
    this.incoming.set(meta.id, incomingTransfer);

    this.notify(item);

    // If small file, auto-accept immediately
    if (!meta.isLarge) {
      this.startIncomingSink(meta.id);
    }
  }

  private async startIncomingSink(transferId: string): Promise<void> {
    const inc = this.incoming.get(transferId);
    const item = this.transfers.get(transferId);
    if (!inc || !item || inc.sink) return;

    try {
      inc.sink = await this.storage.createSink(inc.meta.name, inc.meta.mimeType);
    } catch {
      // Fallback
    }

    // Set up 500ms telemetry & sync acks
    inc.ackTimer = setInterval(() => {
      if (inc.cancelled) return;
      this.sendAckToPeer(transferId);
    }, 500);
  }

  private sendAckToPeer(transferId: string): void {
    const inc = this.incoming.get(transferId);
    if (!inc) return;

    const ack: FileTransferAck = {
      transferId,
      receivedChunks: inc.receivedChunks,
      bytesTransferred: inc.bytesReceived,
    };

    const targetPeerId = inc.meta.senderId;
    this.transport.sendAction('file-ack', ack, targetPeerId);
  }

  async acceptTransfer(transferId: string): Promise<void> {
    const inc = this.incoming.get(transferId);
    const item = this.transfers.get(transferId);
    if (!inc || !item || inc.cancelled) return;

    item.status = 'transferring';
    this.notify(item);

    await this.startIncomingSink(transferId);

    const decision: FileTransferDecision = {
      transferId,
      decision: 'accepted',
    };
    this.transport.sendAction('file-decision', decision, inc.meta.senderId);
  }

  declineTransfer(transferId: string): void {
    const inc = this.incoming.get(transferId);
    const item = this.transfers.get(transferId);
    if (!inc || !item) return;

    item.status = 'declined';
    this.notify(item);

    const decision: FileTransferDecision = {
      transferId,
      decision: 'declined',
    };
    this.transport.sendAction('file-decision', decision, inc.meta.senderId);
    this.cleanupIncoming(transferId);
  }

  cancelTransfer(transferId: string): void {
    this.handleCancel(transferId, true);
  }

  private handleCancel(transferId: string, isInitiator: boolean): void {
    const item = this.transfers.get(transferId);
    if (item) {
      item.status = 'cancelled';
      this.notify(item);
    }

    const out = this.outgoing.get(transferId);
    if (out) {
      out.cancelled = true;
      if (out.decisionReject) {
        out.decisionReject(new Error('Transfer cancelled'));
      }
      this.outgoing.delete(transferId);
    }

    const inc = this.incoming.get(transferId);
    if (inc) {
      inc.cancelled = true;
      this.cleanupIncoming(transferId);
    }

    if (isInitiator) {
      let targetPeerId: string | undefined;
      if (item) {
        if (item.isSender) {
          targetPeerId = item.meta.recipientId || undefined;
        } else {
          targetPeerId = item.meta.senderId;
        }
      }
      const cancelPayload: FileTransferCancel = { transferId };
      this.transport.sendAction('file-cancel', cancelPayload, targetPeerId);
    }
  }

  private cleanupIncoming(transferId: string): void {
    const inc = this.incoming.get(transferId);
    if (!inc) return;

    if (inc.ackTimer) {
      clearInterval(inc.ackTimer);
      inc.ackTimer = undefined;
    }
    if (inc.sink) {
      inc.sink.abort().catch(() => {});
    }
    this.incoming.delete(transferId);
  }

  private handleDecision(decision: FileTransferDecision): void {
    const out = this.outgoing.get(decision.transferId);
    const item = this.transfers.get(decision.transferId);

    if (decision.decision === 'declined') {
      if (item) {
        item.status = 'declined';
        this.notify(item);
      }
      if (out?.decisionReject) {
        out.decisionReject(new Error('Transfer declined by recipient'));
      }
      this.outgoing.delete(decision.transferId);
    } else if (decision.decision === 'accepted') {
      if (item) {
        item.status = 'transferring';
        this.notify(item);
      }
      if (out?.decisionResolve) {
        out.decisionResolve(true);
      }
    }
  }

  private handleAck(ack: FileTransferAck): void {
    const item = this.transfers.get(ack.transferId);
    const out = this.outgoing.get(ack.transferId);
    if (!item) return;

    item.receivedChunks = ack.receivedChunks;
    item.bytesTransferred = ack.bytesTransferred;
    item.progress = Math.min(1, ack.bytesTransferred / item.meta.size);

    if (out) {
      out.telemetry.update(ack.bytesTransferred);
      item.speed = out.telemetry.getSpeedFormatted();
      item.eta = out.telemetry.getEtaFormatted();
    }

    this.notify(item);
  }

  private async handleIncomingChunk(chunk: FileTransferChunk): Promise<void> {
    const inc = this.incoming.get(chunk.transferId);
    const item = this.transfers.get(chunk.transferId);
    if (!inc || !item || inc.cancelled) return;

    const bytes = base64ToUint8Array(chunk.data);
    inc.receivedChunks++;
    inc.bytesReceived += bytes.byteLength;

    if (inc.sink) {
      await inc.sink.write(bytes);
    }

    inc.telemetry.update(inc.bytesReceived);

    item.receivedChunks = inc.receivedChunks;
    item.bytesTransferred = inc.bytesReceived;
    item.progress = Math.min(1, inc.bytesReceived / inc.meta.size);
    item.speed = inc.telemetry.getSpeedFormatted();
    item.eta = inc.telemetry.getEtaFormatted();

    if (inc.receivedChunks >= inc.meta.totalChunks) {
      // Finalize transfer
      if (inc.ackTimer) {
        clearInterval(inc.ackTimer);
        inc.ackTimer = undefined;
      }
      // Send final ack
      this.sendAckToPeer(chunk.transferId);

      let blob: Blob | undefined;
      if (inc.sink) {
        blob = await inc.sink.close();
      } else {
        blob = new Blob([bytes as unknown as BlobPart], { type: inc.meta.mimeType });
      }

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
      item.eta = '0s';

      if (item.mediaCategory === 'code' && typeof blob.text === 'function') {
        try {
          item.textContent = await blob.text();
        } catch {
          // ignore
        }
      }

      this.incoming.delete(chunk.transferId);
    }

    this.notify(item);
  }

  async sendFile(
    file: File,
    recipient?: { id: string; name?: string } | null,
  ): Promise<FileTransferItem> {
    const isLarge = file.size >= MAX_SMALL_FILE_SIZE;
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
      isLarge,
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
      bytesTransferred: 0,
      progress: 0,
      status: isLarge ? 'pending-decision' : 'transferring',
      blob: file,
      blobUrl,
      mediaCategory,
      isSender: true,
      textContent,
    };

    this.transfers.set(transferId, item);
    this.notify(item);

    const targetPeerId = recipient?.id;
    this.transport.sendAction('file-meta', meta, targetPeerId);

    const out: ActiveOutgoingTransfer = {
      meta,
      telemetry: createTransferTelemetry(file.size),
      cancelled: false,
    };
    this.outgoing.set(transferId, out);

    // If large file, wait for recipient to accept
    if (isLarge) {
      await new Promise<boolean>((resolve, reject) => {
        out.decisionResolve = resolve;
        out.decisionReject = reject;
      });
    }

    if (out.cancelled) {
      throw new Error('Transfer cancelled');
    }

    item.status = 'transferring';
    this.notify(item);

    // Stream chunks
    for (let i = 0; i < totalChunks; i++) {
      if (out.cancelled) {
        throw new Error('Transfer cancelled');
      }

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

      // On sender side, also track local upload progress if no ack received yet
      if (!isLarge) {
        item.receivedChunks = i + 1;
        item.bytesTransferred = end;
        item.progress = (i + 1) / totalChunks;
        this.notify(item);
      }

      if (i % 4 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    item.status = 'completed';
    item.progress = 1;
    item.eta = '0s';
    this.outgoing.delete(transferId);
    this.notify(item);

    return item;
  }

  exportTransfer(transferId: string): void {
    const item = this.transfers.get(transferId);
    if (!item?.blob) return;
    exportFileToDisk(item.blob, item.meta.name);
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];

    for (const inc of this.incoming.values()) {
      if (inc.ackTimer) clearInterval(inc.ackTimer);
      if (inc.sink) inc.sink.abort().catch(() => {});
    }
    this.incoming.clear();
    this.outgoing.clear();

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
    this.updateListeners.clear();
  }
}
