import type { MediaCategory } from './media-type';

export type FileTransferStatus =
  'pending-decision' | 'transferring' | 'completed' | 'declined' | 'cancelled' | 'error';

export interface FileTransferMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  isLarge: boolean;
  senderId: string;
  senderName: string;
  senderEmoji: string;
  senderColor: string;
  recipientId: string | null;
  recipientName?: string;
  isPrivate: boolean;
  timestamp: number;
}

export interface FileTransferChunk {
  transferId: string;
  chunkIndex: number;
  data: string; // base64 string
}

export interface FileTransferDecision {
  transferId: string;
  decision: 'accepted' | 'declined';
}

export interface FileTransferAck {
  transferId: string;
  receivedChunks: number;
  bytesTransferred: number;
}

export interface FileTransferCancel {
  transferId: string;
}

export interface FileTransferItem {
  id: string;
  meta: FileTransferMeta;
  receivedChunks: number;
  totalChunks: number;
  bytesTransferred: number;
  progress: number; // 0 to 1
  status: FileTransferStatus;
  speed?: string;
  eta?: string;
  blob?: Blob;
  blobUrl?: string;
  mediaCategory: MediaCategory;
  isSender: boolean;
  textContent?: string;
}
