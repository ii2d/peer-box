export type MediaCategory = 'image' | 'audio' | 'video' | 'code' | 'other';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
]);

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'opus', 'weba']);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'ogv', 'avi']);

const CODE_EXTENSIONS = new Set([
  'txt',
  'md',
  'js',
  'ts',
  'jsx',
  'tsx',
  'svelte',
  'vue',
  'json',
  'html',
  'css',
  'scss',
  'py',
  'rs',
  'go',
  'c',
  'cpp',
  'h',
  'hpp',
  'sh',
  'bash',
  'zsh',
  'yaml',
  'yml',
  'toml',
  'xml',
  'sql',
  'graphql',
  'env',
  'gitignore',
]);

export function detectMediaCategory(fileName: string, mimeType = ''): MediaCategory {
  const lowerMime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (lowerMime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }

  if (lowerMime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) {
    return 'audio';
  }

  if (lowerMime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }

  if (
    lowerMime.startsWith('text/') ||
    lowerMime === 'application/json' ||
    lowerMime === 'application/javascript' ||
    lowerMime === 'application/typescript' ||
    lowerMime === 'application/xml' ||
    CODE_EXTENSIONS.has(ext)
  ) {
    return 'code';
  }

  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}
