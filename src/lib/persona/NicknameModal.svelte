<script lang="ts">
  interface Props {
    initialNickname: string;
    onSave: (newName: string) => void;
    onCancel: () => void;
  }

  const { initialNickname, onSave, onCancel }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(initialNickname);

  function handleSave() {
    onSave(value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }
</script>

<div
  class="edit-modal-backdrop"
  onclick={(e) => e.target === e.currentTarget && onCancel()}
  role="presentation"
>
  <div class="edit-modal">
    <h3>Edit Your Nickname</h3>
    <p class="modal-hint">This nickname will be visible to other peers in the room.</p>
    <input
      type="text"
      data-testid="nickname-edit-input"
      bind:value
      onkeydown={handleKeydown}
      placeholder="e.g. Swift Panda"
      maxlength="32"
    />
    <div class="modal-buttons">
      <button
        type="button"
        class="btn-secondary"
        data-testid="nickname-cancel-btn"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn-primary"
        data-testid="nickname-save-btn"
        onclick={handleSave}
      >
        Save Nickname
      </button>
    </div>
  </div>
</div>

<style>
  .edit-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1.5rem;
  }

  .edit-modal {
    background: #1e293b;
    border: 1px solid var(--card-border);
    border-radius: 1rem;
    padding: 1.75rem;
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .edit-modal h3 {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .modal-hint {
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  input[type='text'] {
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

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-primary {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
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
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid var(--card-border);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
