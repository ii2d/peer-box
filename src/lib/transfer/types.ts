import type { MediaCategory } from './media-type';

export interface FileTransferMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
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

export interface FileTransferItem {
  id: string;
  meta: FileTransferMeta;
  receivedChunks: number;
  totalChunks: number;
  progress: number; // 0 to 1
  status: 'transferring' | 'completed' | 'error';
  blob?: Blob;
  blobUrl?: string;
  mediaCategory: MediaCategory;
  isSender: boolean;
  textContent?: string;
}
