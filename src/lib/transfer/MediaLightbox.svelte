<script lang="ts">
  import { onMount } from 'svelte';
  import { formatFileSize } from './media-type';

  interface Props {
    src: string;
    alt: string;
    size?: number;
    onClose: () => void;
  }

  const { src, alt, size, onClose }: Props = $props();

  onMount(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="lightbox-backdrop" onclick={onClose} data-testid="lightbox-overlay">
  <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
    <div class="lightbox-header">
      <div class="lightbox-meta">
        <span class="lightbox-title">{alt}</span>
        {#if size}
          <span class="lightbox-size">({formatFileSize(size)})</span>
        {/if}
      </div>
      <div class="lightbox-actions">
        <a
          href={src}
          download={alt}
          class="lightbox-btn"
          title="Download original"
          data-testid="lightbox-download-btn"
        >
          ⬇ Download
        </a>
        <button
          type="button"
          class="lightbox-btn close-btn"
          onclick={onClose}
          aria-label="Close"
          data-testid="lightbox-close-btn"
        >
          ✕
        </button>
      </div>
    </div>
    <div class="lightbox-img-wrapper">
      <img {src} {alt} class="lightbox-img" data-testid="lightbox-img" />
    </div>
  </div>
</div>

<style>
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: fadeIn 0.15s ease-out;
  }

  .lightbox-content {
    display: flex;
    flex-direction: column;
    max-width: 90vw;
    max-height: 90vh;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .lightbox-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 23, 42, 0.95);
  }

  .lightbox-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .lightbox-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lightbox-size {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .lightbox-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .lightbox-btn {
    padding: 0.35rem 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.375rem;
    color: #f8fafc;
    font-size: 0.75rem;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .lightbox-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .close-btn {
    font-weight: bold;
    padding: 0.35rem 0.6rem;
  }

  .lightbox-img-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    max-height: calc(90vh - 60px);
    background: #020617;
  }

  .lightbox-img {
    max-width: 100%;
    max-height: calc(90vh - 70px);
    object-fit: contain;
    user-select: none;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
