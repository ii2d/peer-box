import type { AudioCodecInfo } from './types';

const CANDIDATE_CODECS: AudioCodecInfo[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
];

const DEFAULT_CODEC: AudioCodecInfo = {
  mimeType: 'audio/webm;codecs=opus',
  extension: 'webm',
};

export function getSupportedAudioCodec(): AudioCodecInfo {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return DEFAULT_CODEC;
  }

  for (const candidate of CANDIDATE_CODECS) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return DEFAULT_CODEC;
}
