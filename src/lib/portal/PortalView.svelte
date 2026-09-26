<script lang="ts">
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
  <!-- Above the fold: Hero & Room Entry -->
  <header class="portal-hero">
    <div class="hero-brand">
      <div class="logo-badge">
        <span class="logo-icon">📦</span>
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
        <span class="trust-chip">⚡ Direct P2P (No Servers)</span>
        <span class="trust-chip">🧹 Zero Logs &amp; Cookies</span>
        <span class="trust-chip">🛡️ Web Crypto AES-GCM</span>
      </div>
    </div>
  </header>

  <!-- Below the fold: Semantic Showcase & Architectural Deep Dive -->
  <main class="portal-showcase">
    <!-- Section 1: Features -->
    <section class="portal-section features-section" aria-labelledby="features-heading">
      <div class="section-header">
        <h2 id="features-heading">Engineered for Privacy &amp; High-Throughput Streaming</h2>
        <p class="section-subtitle">
          Direct browser data channels bypass cloud servers for maximum speed and privacy.
        </p>
      </div>

      <div class="features-grid">
        <article class="feature-card">
          <div class="feature-icon">🚀</div>
          <h3>Multi-Gigabyte OPFS Streaming</h3>
          <p>
            Large transfers stream directly into your browser's Origin Private File System (<code
              >navigator.storage.getDirectory()</code
            >), bypassing JavaScript heap memory limits to support 10GB+ file exchanges without
            crashing.
          </p>
        </article>

        <article class="feature-card">
          <div class="feature-icon">🎙️</div>
          <h3>Ephemeral Voice Notes</h3>
          <p>
            Record high-fidelity audio notes with dynamic RMS volume waveforms. Audio codecs
            (Opus/WebM or AAC/MP4) are dynamically negotiated cross-browser for instant playback.
          </p>
        </article>

        <article class="feature-card">
          <div class="feature-icon">📸</div>
          <h3>Instant Screen Grabs</h3>
          <p>
            Capture a crisp single frame from any display or window with offscreen canvas rendering.
            Media tracks immediately stop upon capture to guarantee zero ongoing streaming overhead.
          </p>
        </article>

        <article class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Zero-TURN Direct P2P</h3>
          <p>
            Direct WebRTC connections across Local LAN and public STUN NAT hole-punching. Zero relay
            servers means zero third-party latency and zero recurring hosting costs.
          </p>
        </article>
      </div>
    </section>

    <!-- Section 2: Architecture -->
    <section class="portal-section architecture-section" aria-labelledby="arch-heading">
      <div class="section-header">
        <h2 id="arch-heading">How PeerBox Works (Under the Hood)</h2>
        <p class="section-subtitle">
          A decentralized signaling mesh orchestrates direct peer connections in three transparent
          steps.
        </p>
      </div>

      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number">1</div>
          <h3>Decentralized Nostr Signaling</h3>
          <p>
            Browsers discover each other over public Nostr relays (or BitTorrent tracker fallbacks).
            Signaling payloads are encrypted; relays only see opaque ciphertext.
          </p>
        </div>

        <div class="step-card">
          <div class="step-number">2</div>
          <h3>URL Hash Key Isolation</h3>
          <p>
            Room Keys live exclusively in the URL hash fragment (<code>#key=...</code>). Per RFC
            3986, hash fragments are strictly client-side and are mathematically never sent to web
            servers.
          </p>
        </div>

        <div class="step-card">
          <div class="step-number">3</div>
          <h3>Direct WebRTC DataChannels</h3>
          <p>
            Once NAT hole-punching succeeds via STUN, direct UDP sockets form between browsers. All
            chat messages, audio payloads, and binary file chunks stream directly between peers.
          </p>
        </div>
      </div>
    </section>

    <!-- Section 3: Comparison -->
    <section class="portal-section comparison-section" aria-labelledby="comparison-heading">
      <div class="section-header">
        <h2 id="comparison-heading">Direct P2P vs Centralized Cloud Relays</h2>
        <p class="section-subtitle">Why serverless browser streaming is inherently more private.</p>
      </div>

      <div class="table-responsive">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Traditional Cloud Relays</th>
              <th>PeerBox (Serverless P2P)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Server File Storage</strong></td>
              <td>Stored on remote cloud disks</td>
              <td><span class="highlight-good">0 Bytes (Pure memory / OPFS)</span></td>
            </tr>
            <tr>
              <td><strong>Account / Sign-up</strong></td>
              <td>Requires email, phone, or OAuth</td>
              <td><span class="highlight-good">None (Ephemeral Persona)</span></td>
            </tr>
            <tr>
              <td><strong>Transfer Speed</strong></td>
              <td>Throttled cloud bandwidth tiers</td>
              <td><span class="highlight-good">Full LAN / Direct Internet speed</span></td>
            </tr>
            <tr>
              <td><strong>Encryption Visibility</strong></td>
              <td>Server operator holds keys / logs</td>
              <td><span class="highlight-good">Client-side Web Crypto AES-GCM</span></td>
            </tr>
            <tr>
              <td><strong>Hosting Costs</strong></td>
              <td>High recurring server &amp; relay bills</td>
              <td><span class="highlight-good">$0 (Static GitHub Pages)</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section 4: FAQ -->
    <section class="portal-section faq-section" aria-labelledby="faq-heading">
      <div class="section-header">
        <h2 id="faq-heading">Frequently Asked Questions</h2>
        <p class="section-subtitle">
          Everything you need to know about privacy, limits, and WebRTC.
        </p>
      </div>

      <div class="faq-list">
        <details class="faq-item" open>
          <summary>Are files or messages ever uploaded to a central server?</summary>
          <p>
            No. PeerBox is 100% serverless. The application code is served as static HTML/JS from
            GitHub Pages. All messages, voice recordings, and binary file chunks stream directly
            between peers via encrypted WebRTC DataChannels.
          </p>
        </details>

        <details class="faq-item">
          <summary>What is the maximum file size that can be transferred?</summary>
          <p>
            There is no hard-coded file size limit. Files 25MB and larger stream directly into your
            browser's Origin Private File System (OPFS), supporting multi-gigabyte transfers without
            exhausting JavaScript memory.
          </p>
        </details>

        <details class="faq-item">
          <summary>Does PeerBox require an account, phone number, or email?</summary>
          <p>
            No. PeerBox requires zero authentication, accounts, or persistent identifiers. When
            joining a room, a temporary randomized Persona (friendly animal name and pastel avatar)
            is generated client-side.
          </p>
        </details>

        <details class="faq-item">
          <summary>Can a room host or network eavesdropper intercept my Room Key?</summary>
          <p>
            No. The Room Key resides strictly in the URL hash fragment (<code>#key=...</code>). RFC
            3986 guarantees that browsers never send URL hash fragments to HTTP servers or signaling
            relays.
          </p>
        </details>

        <details class="faq-item">
          <summary>How do I share a room with a mobile user?</summary>
          <p>
            Inside any active room, tap the <strong>Share</strong> button in the header. PeerBox renders
            a high-contrast SVG QR code that any smartphone camera can scan to instantly join with or
            without the encrypted key included.
          </p>
        </details>

        <details class="faq-item">
          <summary>What happens if a symmetric NAT firewall blocks direct connection?</summary>
          <p>
            PeerBox operates strictly with zero TURN relay servers (respecting ADR-0001). If two
            peers are both behind double-symmetric enterprise firewalls that prevent STUN hole
            punching, PeerBox displays a diagnostic banner recommending that peers share a local LAN
            or use a VPN.
          </p>
        </details>
      </div>
    </section>
  </main>

  <footer class="portal-footer">
    <div class="footer-content">
      <p>
        PeerBox &bull; Open-source serverless P2P communication &bull;
        <a href="/llms.txt" class="footer-link">Agent Brief (llms.txt)</a> &bull;
        <a
          href="https://github.com/ii2d/peer-box"
          target="_blank"
          rel="noreferrer"
          class="footer-link"
        >
          GitHub
        </a>
      </p>
    </div>
  </footer>
</div>

<style>
  .portal-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3.5rem;
    padding-bottom: 3rem;
  }

  /* Hero Section */
  .portal-hero {
    width: 100%;
    max-width: 600px;
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
    margin-bottom: 1rem;
  }

  .logo-icon {
    font-size: 1rem;
  }

  .logo-text {
    font-size: 0.875rem;
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
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 520px;
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

  /* Below the fold Showcase */
  .portal-showcase {
    width: 100%;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: 4rem;
  }

  .portal-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-header h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: -0.02em;
  }

  .section-subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: rgba(22, 28, 45, 0.5);
    border: 1px solid var(--card-border);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    backdrop-filter: blur(8px);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .feature-icon {
    font-size: 2rem;
  }

  .feature-card h3 {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .feature-card p {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* Architecture Steps */
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
  }

  .step-card {
    background: rgba(22, 28, 45, 0.4);
    border: 1px solid var(--card-border);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
  }

  .step-number {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid var(--primary);
    color: #a5b4fc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
  }

  .step-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .step-card p {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* Comparison Table */
  .table-responsive {
    width: 100%;
    overflow-x: auto;
    border-radius: 1rem;
    border: 1px solid var(--card-border);
    background: rgba(22, 28, 45, 0.4);
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.875rem;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--card-border);
  }

  .comparison-table th {
    background: rgba(15, 23, 42, 0.6);
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .comparison-table tr:last-child td {
    border-bottom: none;
  }

  .highlight-good {
    color: #4ade80;
    font-weight: 600;
  }

  /* FAQ Accordion */
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .faq-item {
    background: rgba(22, 28, 45, 0.4);
    border: 1px solid var(--card-border);
    border-radius: 0.875rem;
    padding: 1rem 1.25rem;
    transition: all 0.2s ease;
  }

  .faq-item[open] {
    background: rgba(22, 28, 45, 0.7);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .faq-item summary {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    outline: none;
    user-select: none;
  }

  .faq-item summary::-webkit-details-marker {
    color: var(--primary);
  }

  .faq-item p {
    margin-top: 0.85rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* Footer */
  .portal-footer {
    width: 100%;
    border-top: 1px solid var(--card-border);
    padding-top: 2rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted);
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
</style>
