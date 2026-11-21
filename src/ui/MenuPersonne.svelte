<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { ModeAjout } from './types';

  let {
    x,
    y,
    nom,
    deuxParents,
    onmodifier,
    onajouter,
    onsupprimer,
    onfermer,
  }: {
    x: number;
    y: number;
    nom: string;
    deuxParents: boolean;
    onmodifier: () => void;
    onajouter: (mode: ModeAjout) => void;
    onsupprimer: () => void;
    onfermer: () => void;
  } = $props();

  let menu: HTMLDivElement;
  let pos = $state(untrack(() => ({ left: x, top: y })));

  onMount(() => {
    // reste dans la fenêtre
    const r = menu.getBoundingClientRect();
    const parent = menu.offsetParent?.getBoundingClientRect() ?? { width: innerWidth, height: innerHeight };
    pos = { left: Math.min(x, parent.width - r.width - 8), top: Math.min(y, parent.height - r.height - 8) };
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dehors = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) onfermer();
    };
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onfermer();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const boutons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const i = boutons.indexOf(document.activeElement as HTMLButtonElement);
        boutons[(i + (e.key === 'ArrowDown' ? 1 : -1) + boutons.length) % boutons.length]?.focus();
      }
    };
    setTimeout(() => addEventListener('pointerdown', dehors), 0);
    addEventListener('keydown', clavier);
    return () => {
      removeEventListener('pointerdown', dehors);
      removeEventListener('keydown', clavier);
    };
  });

  const choisir = (f: () => void) => () => {
    f();
    onfermer();
  };
</script>

<div class="menu" role="menu" aria-label="Actions pour {nom}" bind:this={menu} style:left="{pos.left}px" style:top="{pos.top}px">
  <div class="titre">{nom}</div>
  <button type="button" role="menuitem" onclick={choisir(onmodifier)}>Modifier</button>
  <button
    type="button"
    role="menuitem"
    disabled={deuxParents}
    title={deuxParents ? 'Cette personne a déjà deux parents' : undefined}
    onclick={choisir(() => onajouter('parent'))}>Ajouter un parent</button
  >
  <button type="button" role="menuitem" onclick={choisir(() => onajouter('enfant'))}>Ajouter un enfant</button>
  <button type="button" role="menuitem" onclick={choisir(() => onajouter('partenaire'))}>Ajouter un partenaire</button>
  <hr />
  <button type="button" role="menuitem" class="danger" onclick={choisir(onsupprimer)}>Supprimer…</button>
</div>

<style>
  .menu {
    position: absolute;
    z-index: 10;
    min-width: 200px;
    padding: 0.3rem;
    background: var(--surface);
    border: 1px solid var(--bordure);
    border-radius: 8px;
    box-shadow: var(--ombre);
  }
  .titre {
    padding: 0.35rem 0.6rem 0.4rem;
    font-weight: 600;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.6rem;
    border: 0;
    border-radius: 5px;
    background: none;
    cursor: pointer;
  }
  button:hover:not(:disabled),
  button:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    outline: none;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .danger {
    color: var(--danger);
  }
  hr {
    border: 0;
    border-top: 1px solid var(--bordure);
    margin: 0.3rem 0;
  }
</style>
