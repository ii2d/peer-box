<script lang="ts">
  let count = $state(0);

  function increment() {
    count += 1;
  }

  function reset() {
    count = 0;
  }
</script>

<main class="container">
  <div class="card">
    <div class="badge-row">
      <span class="badge">Svelte 5</span>
      <span class="badge badge-success">Vite + Vanilla CSS</span>
    </div>

    <h1 class="title">Hello World</h1>
    <p class="subtitle">
      Initialized with Svelte 5, Vite, Vitest, Vanilla CSS, ESLint, and Prettier.
    </p>

    <div class="counter-box">
      <div class="count-display">
        <span class="count-label">Clicks</span>
        <span class="count-number" data-testid="counter-val">{count}</span>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-primary" onclick={increment}> Increment </button>
        {#if count > 0}
          <button type="button" class="btn btn-secondary" onclick={reset}> Reset </button>
        {/if}
      </div>
    </div>
  </div>
</main>

<style>
  .container {
    width: 100%;
  }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    backdrop-filter: blur(16px);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.4),
      0 8px 10px -6px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .badge-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background-color: var(--badge-bg);
    color: var(--badge-text);
    border: 1px solid var(--badge-border);
  }

  .badge-success {
    background-color: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }

  .title {
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 2rem;
  }

  .counter-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid var(--card-border);
    padding: 1.5rem;
    border-radius: 0.75rem;
  }

  .count-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .count-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .count-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background-color: var(--primary);
    color: #ffffff;
    box-shadow: 0 4px 14px 0 var(--primary-glow);
  }

  .btn-primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--text-main);
  }

  .btn-secondary:hover {
    background-color: rgba(255, 255, 255, 0.18);
  }
</style>
