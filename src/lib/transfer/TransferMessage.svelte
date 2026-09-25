<script lang="ts">
  import { formatFileSize } from './media-type';
  import type { FileTransferItem } from './types';

  interface Props {
    transfer: FileTransferItem;
    isSelf: boolean;
    onOpenImage?: (src: string, name: string, size: number) => void;
  }

  const { transfer, isSelf, onOpenImage }: Props = $props();

  function formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'image':
        return '🖼️';
      case 'audio':
        return '🎵';
      case 'video':
        return '🎬';
      case 'code':
        return '📝';
      default:
        return '📦';
    }
  }
</script>

<div
  class="transfer-wrapper"
  class:transfer-self={isSelf}
  data-testid="transfer-item"
  data-transfer-id={transfer.id}
>
  <div class="transfer-meta">
    <span class="sender-avatar" style="background: {transfer.meta.senderColor}">
      {transfer.meta.senderEmoji}
    </span>
    <span class="sender-name">{transfer.meta.senderName}</span>
    <span class="transfer-time">{formatTime(transfer.meta.timestamp)}</span>
    {#if transfer.meta.isPrivate}
      <span class="private-badge" data-testid="private-badge">
        🔒 Private {#if isSelf && transfer.meta.recipientName}to {transfer.meta.recipientName}{/if}
      </span>
    {/if}
  </div>

  <div class="transfer-card" class:card-self={isSelf}>
    <div class="file-header">
      <span class="category-icon">{getCategoryIcon(transfer.mediaCategory)}</span>
      <div class="file-details">
        <div class="file-name" title={transfer.meta.name}>{transfer.meta.name}</div>
        <div class="file-size">{formatFileSize(transfer.meta.size)}</div>
      </div>
    </div>

    {#if transfer.status === 'transferring'}
      <div class="progress-section" data-testid="transfer-progress">
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            style="width: {Math.max(5, Math.round(transfer.progress * 100))}%"
          ></div>
        </div>
        <div class="progress-label">
          <span>Transferring...</span>
          <span>{Math.round(transfer.progress * 100)}%</span>
        </div>
      </div>
    {:else if transfer.status === 'completed'}
      <div class="preview-section">
        {#if transfer.mediaCategory === 'image' && transfer.blobUrl}
          <button
            type="button"
            class="image-thumbnail-btn"
            onclick={() => onOpenImage?.(transfer.blobUrl!, transfer.meta.name, transfer.meta.size)}
            title="Click to expand image"
            data-testid="image-preview"
          >
            <img src={transfer.blobUrl} alt={transfer.meta.name} class="image-thumbnail" />
            <span class="thumbnail-overlay">🔍 Expand</span>
          </button>
        {:else if transfer.mediaCategory === 'audio' && transfer.blobUrl}
          <div class="audio-container" data-testid="audio-preview">
            <audio controls src={transfer.blobUrl} preload="metadata" class="audio-player"></audio>
          </div>
        {:else if transfer.mediaCategory === 'video' && transfer.blobUrl}
          <div class="video-container" data-testid="video-preview">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video controls src={transfer.blobUrl} preload="metadata" class="video-player"></video>
          </div>
        {:else if transfer.mediaCategory === 'code' && transfer.textContent}
          <div class="code-container" data-testid="code-preview">
            <div class="code-header">
              <span>{transfer.meta.name}</span>
            </div>
            <pre class="code-body"><code>{transfer.textContent.slice(0, 3000)}</code></pre>
          </div>
        {/if}
      </div>

      {#if transfer.blobUrl}
        <div class="actions-section">
          <a
            href={transfer.blobUrl}
            download={transfer.meta.name}
            class="btn-download"
            data-testid="download-btn"
          >
            ⬇ Download ({formatFileSize(transfer.meta.size)})
          </a>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .transfer-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 82%;
  }

  .transfer-self {
    align-self: flex-end;
  }

  .transfer-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .sender-avatar {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
  }

  .sender-name {
    font-weight: 600;
    color: var(--text-main);
  }

  .private-badge {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.3);
    font-size: 0.625rem;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
  }

  .transfer-card {
    padding: 0.85rem 1rem;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid var(--card-border);
    border-radius: 0.875rem;
    color: var(--text-main);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  }

  .card-self {
    background: rgba(79, 70, 229, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .category-icon {
    font-size: 1.75rem;
    line-height: 1;
  }

  .file-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .file-name {
    font-weight: 600;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }

  .file-size {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .progress-bar-bg {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a855f7);
    border-radius: 9999px;
    transition: width 0.15s ease-out;
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .preview-section {
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .image-thumbnail-btn {
    position: relative;
    padding: 0;
    border: none;
    background: #020617;
    border-radius: 0.5rem;
    cursor: pointer;
    overflow: hidden;
    display: block;
    max-height: 220px;
    width: 100%;
  }

  .image-thumbnail {
    width: 100%;
    height: 100%;
    max-height: 220px;
    object-fit: cover;
    display: block;
    transition: transform 0.2s;
  }

  .image-thumbnail-btn:hover .image-thumbnail {
    transform: scale(1.02);
  }

  .thumbnail-overlay {
    position: absolute;
    bottom: 0.4rem;
    right: 0.4rem;
    padding: 0.2rem 0.5rem;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    color: #f8fafc;
    font-size: 0.6875rem;
    border-radius: 0.25rem;
  }

  .audio-container {
    width: 100%;
  }

  .audio-player {
    width: 100%;
    height: 38px;
  }

  .video-container {
    max-height: 240px;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #000;
  }

  .video-player {
    width: 100%;
    max-height: 240px;
    display: block;
  }

  .code-container {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    overflow: hidden;
    max-height: 200px;
    display: flex;
    flex-direction: column;
  }

  .code-header {
    background: rgba(255, 255, 255, 0.05);
    padding: 0.25rem 0.65rem;
    font-size: 0.6875rem;
    font-family: monospace;
    color: var(--text-muted);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .code-body {
    margin: 0;
    padding: 0.5rem 0.65rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    overflow-x: auto;
    overflow-y: auto;
    color: #e2e8f0;
  }

  .actions-section {
    display: flex;
    align-items: center;
  }

  .btn-download {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    background: var(--primary);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.5rem;
    text-decoration: none;
    transition: background 0.15s;
  }

  .btn-download:hover {
    background: var(--primary-hover);
  }
</style>
