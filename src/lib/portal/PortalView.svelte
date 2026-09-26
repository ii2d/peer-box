<script lang="ts">
  import BrandIcon from '../ui/BrandIcon.svelte';
  import { APP_VERSION, getVersionUrl } from '../version';

  interface Props {
    roomName?: string;
    roomKey?: string;
    errorMessage?: string | null;
    onRandomName?: () => void;
    onJoin?: () => void;
    onCreateInstant?: () => void;
  }

  let {
    roomName = $bindable(''),
    roomKey = $bindable(''),
    errorMessage = null,
    onRandomName,
    onJoin,
    onCreateInstant,
  }: Props = $props();

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    onJoin?.();
  }
</script>

<div class="portal-wrapper">
  <!-- Unified Top Navigation Bar -->
  <header class="docs-header">
    <div class="docs-header-inner">
      <a href="/" class="docs-brand">
        <BrandIcon size={24} />
        <span>PeerBox</span>
      </a>
      <nav class="docs-nav-links" aria-label="Main Navigation">
        <a href="/" class="docs-nav-link active">App</a>
        <a href="/about/" class="docs-nav-link">About</a>
        <a href="/faq/" class="docs-nav-link">FAQ</a>
        <a href="/privacy/" class="docs-nav-link">Privacy &amp; Trust</a>
        <a
          href="https://github.com/ii2d/peer-box"
          target="_blank"
          rel="noreferrer"
          class="docs-nav-link"
        >
          GitHub
        </a>
      </nav>
      <button
        type="button"
        class="docs-cta-btn"
        data-testid="header-instant-btn"
        onclick={onCreateInstant}
      >
        ⚡ Instant Room
      </button>
    </div>
  </header>

  <!-- Centered Hero & Room Entry Canvas -->
  <main class="portal-center-stage">
    <div class="portal-hero">
      <div class="hero-brand">
        <div class="logo-badge">
          <BrandIcon size={18} />
          <span class="logo-text">Peer-to-Peer</span>
        </div>
        <h1 class="title">PeerBox</h1>
        <p class="subtitle">
          Direct browser-to-browser encrypted rooms. Zero servers, zero uploads, zero tracking.
        </p>
      </div>

      <div class="portal-card">
        <div class="instant-create-box">
          <button
            type="button"
            class="btn-primary btn-instant"
            data-testid="instant-create-btn"
            onclick={onCreateInstant}
          >
            ✨ Create Instant Room
          </button>
        </div>

        <div class="divider">
          <span>or specify room details</span>
        </div>

        <form class="join-form" onsubmit={handleSubmit}>
          <div class="form-group">
            <label for="room-name">Room Name</label>
            <div class="input-with-action">
              <input
                id="room-name"
                data-testid="room-input"
                type="text"
                placeholder="e.g. cute-dog"
                bind:value={roomName}
                autocomplete="off"
                spellcheck="false"
              />
              <button
                type="button"
                class="btn-secondary btn-icon"
                data-testid="random-btn"
                onclick={onRandomName}
                title="Generate Random Name"
              >
                🎲 Random
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="room-key">
              Room Key <span class="label-optional">(optional secret)</span>
            </label>
            <input
              id="room-key"
              data-testid="key-input"
              type="password"
              placeholder="Derives client-side AES-GCM encryption key"
              bind:value={roomKey}
              autocomplete="new-password"
            />
          </div>

          {#if errorMessage}
            <div class="error-banner" data-testid="error-banner">
              {errorMessage}
            </div>
          {/if}

          <button type="submit" class="btn-secondary btn-block" data-testid="join-btn">
            Join Room
          </button>
        </form>

        <div class="trust-chips">
          <span class="trust-chip">🔒 End-to-End Encrypted</span>
          <span class="trust-chip">⚡ Zero-TURN Direct P2P</span>
          <span class="trust-chip">🧹 Zero Logs &amp; Cookies</span>
          <span class="trust-chip">🛡️ Web Crypto AES-GCM</span>
        </div>
      </div>
    </div>
  </main>

  <!-- Minimal Bottom Footer -->
  <footer class="portal-footer">
    <div class="footer-content">
      <a href="/privacy/" class="footer-link">Privacy &amp; Trust</a>
      <span class="footer-sep">&bull;</span>
      <a href="/llms.txt" class="footer-link">Agent Brief (llms.txt)</a>
      <span class="footer-sep">&bull;</span>
      <a
        href="https://github.com/ii2d/peer-box"
        target="_blank"
        rel="noreferrer"
        class="footer-link"
      >
        GitHub
      </a>
      <span class="footer-sep">&bull;</span>
      <a
        href={getVersionUrl(APP_VERSION)}
        target="_blank"
        rel="noreferrer"
        class="footer-link"
        title="View source at this version"
        data-testid="portal-version-link"
      >
        {APP_VERSION}
      </a>
    </div>
  </footer>
</div>

<style>
  .portal-wrapper {
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* Centered Main Stage */
  .portal-center-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem 2.5rem;
    width: 100%;
  }

  .portal-hero {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.5rem;
  }

  .hero-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid var(--badge-border);
    border-radius: 9999px;
    margin-bottom: 0.85rem;
  }

  .logo-text {
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--badge-text);
  }

  .title {
    font-size: 2.75rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 460px;
  }

  .portal-card {
    width: 100%;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 1.25rem;
    padding: 1.75rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.45),
      0 8px 10px -6px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .btn-instant {
    width: 100%;
    padding: 0.95rem 1.5rem;
    font-size: 1.05rem;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    box-shadow: 0 4px 18px 0 rgba(99, 102, 241, 0.45);
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--card-border);
  }

  .divider span {
    padding: 0 0.75rem;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    text-align: left;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .label-optional {
    color: var(--text-muted);
    font-weight: 400;
  }

  .input-with-action {
    display: flex;
    gap: 0.5rem;
  }

  input[type='text'],
  input[type='password'] {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid var(--card-border);
    border-radius: 0.625rem;
    color: var(--text-main);
    font-size: 0.9375rem;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0.8125rem 1.5rem;
    border-radius: 0.625rem;
    border: none;
    background-color: var(--primary);
    color: #ffffff;
    box-shadow: 0 4px 14px 0 var(--primary-glow);
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid var(--card-border);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .btn-block {
    width: 100%;
    padding: 0.8125rem 1.5rem;
  }

  .error-banner {
    padding: 0.625rem 0.875rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    color: #fca5a5;
    font-size: 0.8125rem;
  }

  .trust-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    border-top: 1px solid var(--card-border);
    padding-top: 1.25rem;
  }

  .trust-chip {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.04);
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
  }

  /* Minimal Footer */
  .portal-footer {
    width: 100%;
    padding: 1.25rem 1.5rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .footer-sep {
    opacity: 0.4;
  }

  .footer-link {
    color: #a5b4fc;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .footer-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  @media (max-height: 680px) {
    .portal-center-stage {
      padding: 1rem;
      justify-content: flex-start;
    }
    .title {
      font-size: 2.25rem;
    }
  }
</style>
