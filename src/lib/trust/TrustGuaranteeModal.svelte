<script lang="ts">
  interface Props {
    onClose: () => void;
  }

  const { onClose }: Props = $props();

  let expandedIndex = $state<number | null>(null);

  const CARDS = [
    {
      id: 'zero-servers',
      icon: '⚡',
      title: 'Zero Servers & Relays',
      summary:
        'Static client hosted on GitHub Pages. Direct browser-to-browser WebRTC connection with zero backend servers or databases.',
      mechanics:
        'Signaling uses decentralized ephemeral Nostr WSS relays (NIP-01). Per ADR-0001, PeerBox operates with Zero-TURN relay servers, ensuring all files and messages flow directly peer-to-peer without intermediate server relay liability.',
    },
    {
      id: 'room-key',
      icon: '🔒',
      title: 'Room Key Encryption',
      summary: 'Zero-knowledge encryption keys never leave your device or touch any server.',
      mechanics:
        'Payloads are encrypted using Web Crypto API AES-GCM with 256-bit keys. Keys are kept exclusively in the client-side URL hash fragment (#key=..., ADR-0003), which browsers never send to any web server.',
    },
    {
      id: 'ephemeral-memory',
      icon: '🧹',
      title: 'Ephemeral Memory',
      summary: 'Messages and file chunks exist in browser RAM only and evaporate when tabs close.',
      mechanics:
        'Zero trackers, analytics, cookies, or remote logging. Chat persistence is strictly opt-in and saved only in the local browser via IndexedDB. Memory buffers are cleared immediately upon leaving the room.',
    },
    {
      id: 'ip-disclosure',
      icon: '👁️',
      title: 'Direct P2P & IP Disclosure',
      summary:
        "Direct peer connections mean participating peers in the same room observe each other's public IP address.",
      mechanics:
        'In strict alignment with ADR-0004, establishing direct WebRTC DataChannels between two computers inherently reveals public network IP addresses. We transparently disclose this technical reality and recommend using a VPN if you require IP masking.',
    },
  ];

  function toggleExpand(index: number): void {
    expandedIndex = expandedIndex === index ? null : index;
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={handleOverlayClick} role="presentation">
  <div
    class="trust-modal"
    data-testid="trust-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="trust-modal-title"
  >
    <div class="modal-header">
      <div class="header-icon-title">
        <span class="trust-shield">🛡️</span>
        <div>
          <h2 id="trust-modal-title" class="modal-title">Trust Guarantee</h2>
          <span class="modal-subtitle">Cryptographic and architectural assurances for PeerBox</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        onclick={onClose}
        data-testid="close-trust-modal-btn"
        aria-label="Close Trust Guarantee"
      >
        ✕
      </button>
    </div>

    <div class="modal-body">
      <div class="trust-cards-grid">
        {#each CARDS as card, index (card.id)}
          {@const isExpanded = expandedIndex === index}
          <div class="trust-card {isExpanded ? 'expanded' : ''}" data-testid="trust-card-{index}">
            <div class="card-top">
              <span class="card-icon">{card.icon}</span>
              <div class="card-header-text">
                <h3 class="card-title">{card.title}</h3>
                <p class="card-summary">{card.summary}</p>
              </div>
            </div>

            {#if isExpanded}
              <div class="card-deep-dive" data-testid="deep-dive-{index}">
                <span class="deep-dive-badge">Verifiable Mechanics</span>
                <p class="deep-dive-text">{card.mechanics}</p>
              </div>
            {/if}

            <button
              type="button"
              class="btn-toggle-deep-dive"
              data-testid="expand-card-{index}"
              onclick={() => toggleExpand(index)}
            >
              {isExpanded ? '▲ Hide Technical Details' : '▼ Technical Deep-Dive'}
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .trust-modal {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-icon-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .trust-shield {
    font-size: 28px;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #f8fafc;
  }

  .modal-subtitle {
    font-size: 12px;
    color: #94a3b8;
  }

  .btn-close {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
  }

  .trust-cards-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .trust-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease;
  }

  .trust-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .trust-card.expanded {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .card-top {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .card-icon {
    font-size: 22px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .card-header-text {
    flex: 1;
  }

  .card-title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .card-summary {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
  }

  .card-deep-dive {
    margin-top: 12px;
    padding: 12px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    animation: fadeIn 0.15s ease-out;
  }

  .deep-dive-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    color: #818cf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .deep-dive-text {
    margin: 0;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .btn-toggle-deep-dive {
    margin-top: 10px;
    background: transparent;
    border: none;
    color: #818cf8;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
  }

  .btn-toggle-deep-dive:hover {
    color: #a5b4fc;
    text-decoration: underline;
  }
</style>
