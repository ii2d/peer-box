export interface AudioCodecInfo {
  mimeType: string;
  extension: string;
}

export interface VoiceRecording {
  blob: Blob;
  file: File;
  durationMs: number;
  url: string;
}

export type VoiceRecorderStatus = 'idle' | 'recording' | 'previewing';
