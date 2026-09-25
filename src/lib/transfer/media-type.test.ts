import { describe, expect, it } from 'vitest';
import { detectMediaCategory, formatFileSize } from './media-type';

describe('media-type helper', () => {
  it('correctly categorizes images', () => {
    expect(detectMediaCategory('photo.png', 'image/png')).toBe('image');
    expect(detectMediaCategory('cat.jpg', '')).toBe('image');
    expect(detectMediaCategory('icon.svg', 'image/svg+xml')).toBe('image');
    expect(detectMediaCategory('banner.webp', '')).toBe('image');
  });

  it('correctly categorizes audio', () => {
    expect(detectMediaCategory('podcast.mp3', 'audio/mpeg')).toBe('audio');
    expect(detectMediaCategory('sound.wav', '')).toBe('audio');
    expect(detectMediaCategory('track.ogg', 'audio/ogg')).toBe('audio');
  });

  it('correctly categorizes video', () => {
    expect(detectMediaCategory('clip.mp4', 'video/mp4')).toBe('video');
    expect(detectMediaCategory('screencast.webm', '')).toBe('video');
  });

  it('correctly categorizes code and text', () => {
    expect(detectMediaCategory('index.ts', 'text/plain')).toBe('code');
    expect(detectMediaCategory('config.json', 'application/json')).toBe('code');
    expect(detectMediaCategory('README.md', '')).toBe('code');
    expect(detectMediaCategory('style.css', 'text/css')).toBe('code');
    expect(detectMediaCategory('script.py', '')).toBe('code');
  });

  it('falls back to other for unknown types', () => {
    expect(detectMediaCategory('archive.zip', 'application/zip')).toBe('other');
    expect(detectMediaCategory('document.pdf', 'application/pdf')).toBe('other');
    expect(detectMediaCategory('data.bin', 'application/octet-stream')).toBe('other');
  });

  it('formats file sizes accurately', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    expect(formatFileSize(1024 * 1024 * 1024 * 1.2)).toBe('1.2 GB');
  });
});
