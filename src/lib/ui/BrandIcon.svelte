<script lang="ts">
  interface Props {
    size?: number | string;
    class?: string;
  }

  let { size = 24, class: className = '' }: Props = $props();

  let dimension = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<span
  class="brand-icon-wrapper {className}"
  style:width={dimension}
  style:height={dimension}
  role="img"
  aria-label="PeerBox Logo"
>
  <svg
    viewBox="0 0 32 32"
    width="100%"
    height="100%"
    class="brand-icon-svg"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="brandTop" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#818cf8" />
      </linearGradient>

      <linearGradient id="brandLeft" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f46e5" />
        <stop offset="100%" stop-color="#312e81" />
      </linearGradient>

      <linearGradient id="brandRight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>

      <radialGradient id="brandGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Subtle Ambient Glow -->
    <circle cx="16" cy="16.5" r="14" fill="url(#brandGlow)" class="brand-ambient-glow" />

    <!-- Isometric Faces -->
    <polygon points="5,10.5 16,16.5 16,28 5,22" fill="url(#brandLeft)" />
    <polygon points="16,16.5 27,10.5 27,22 16,28" fill="url(#brandRight)" />
    <polygon points="16,5 27,10.5 16,16.5 5,10.5" fill="url(#brandTop)" />

    <!-- Subtle Edge Accents -->
    <polyline
      points="5,10.5 16,16.5 27,10.5"
      fill="none"
      stroke="#ffffff"
      stroke-width="0.8"
      stroke-opacity="0.65"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <line
      x1="16"
      y1="16.5"
      x2="16"
      y2="28"
      stroke="#ffffff"
      stroke-width="0.75"
      stroke-opacity="0.4"
      stroke-linecap="round"
    />

    <!-- Internal Mesh Beams -->
    <line
      x1="16"
      y1="16.5"
      x2="16"
      y2="5"
      stroke="#ffffff"
      stroke-width="0.7"
      stroke-dasharray="1.5 1.5"
      stroke-opacity="0.8"
    />
    <line
      x1="16"
      y1="16.5"
      x2="5"
      y2="22"
      stroke="#a5b4fc"
      stroke-width="0.6"
      stroke-dasharray="1.5 1.5"
      stroke-opacity="0.75"
    />
    <line
      x1="16"
      y1="16.5"
      x2="27"
      y2="22"
      stroke="#38bdf8"
      stroke-width="0.6"
      stroke-dasharray="1.5 1.5"
      stroke-opacity="0.75"
    />

    <!-- Illuminated Vertex Nodes -->
    <circle cx="16" cy="5" r="1.7" fill="#38bdf8" />
    <circle cx="16" cy="5" r="0.8" fill="#ffffff" />

    <circle cx="5" cy="10.5" r="1.5" fill="#818cf8" />
    <circle cx="5" cy="10.5" r="0.7" fill="#ffffff" />

    <circle cx="27" cy="10.5" r="1.5" fill="#38bdf8" />
    <circle cx="27" cy="10.5" r="0.7" fill="#ffffff" />

    <circle cx="5" cy="22" r="1.4" fill="#6366f1" />
    <circle cx="5" cy="22" r="0.6" fill="#ffffff" />

    <circle cx="27" cy="22" r="1.4" fill="#0284c7" />
    <circle cx="27" cy="22" r="0.6" fill="#ffffff" />

    <circle cx="16" cy="28" r="1.5" fill="#818cf8" />
    <circle cx="16" cy="28" r="0.7" fill="#ffffff" />

    <!-- Center Hub -->
    <circle cx="16" cy="16.5" r="2.4" fill="#0284c7" />
    <circle cx="16" cy="16.5" r="1.1" fill="#ffffff" />
  </svg>
</span>

<style>
  .brand-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    vertical-align: middle;
    line-height: 1;
  }

  .brand-icon-svg {
    display: block;
    overflow: visible;
    filter: drop-shadow(0 2px 8px rgba(99, 102, 241, 0.25));
    transition:
      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
      filter 0.25s ease;
  }

  .brand-ambient-glow {
    transition: opacity 0.25s ease;
  }

  :global(.docs-brand:hover) .brand-icon-svg,
  :global(.roster-brand:hover) .brand-icon-svg,
  .brand-icon-wrapper:hover .brand-icon-svg {
    transform: scale(1.08) translateY(-0.5px);
    filter: drop-shadow(0 3px 12px rgba(56, 189, 248, 0.45));
  }
</style>
