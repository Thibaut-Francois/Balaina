<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  let {
    titre,
    onfermer,
    children,
    actions,
    large = false,
  }: { titre: string; onfermer: () => void; children: Snippet; actions?: Snippet; large?: boolean } = $props();

  let dialogue: HTMLDialogElement;
  onMount(() => {
    dialogue.showModal();
  });
</script>

<!-- Dialogue modal natif : Échap le ferme, le focus reste à l'intérieur. -->
<dialog
  bind:this={dialogue}
  class:large
  onclose={onfermer}
  onclick={(e) => {
    if (e.target === dialogue) dialogue.close();
  }}
>
  <div class="contenu">
    <h2>{titre}</h2>
    {@render children()}
    {#if actions}
      <div class="actions">{@render actions()}</div>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    border: 1px solid var(--bordure);
    border-radius: 10px;
    padding: 0;
    width: min(440px, calc(100vw - 2rem));
    background: var(--surface);
    color: var(--texte);
    box-shadow: var(--ombre);
  }
  dialog.large {
    width: min(560px, calc(100vw - 2rem));
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.3);
  }
  .contenu {
    padding: 1.1rem 1.25rem;
    max-height: calc(100vh - 4rem);
    overflow: auto;
    box-sizing: border-box;
  }
  h2 {
    font-size: 1.05rem;
    margin: 0 0 1rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
