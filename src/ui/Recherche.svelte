<script lang="ts">
  import type { Personne } from '../model/types';
  import { datesAffichees, nomAffiche } from './texte';

  let { personnes, onchoisir }: { personnes: Personne[]; onchoisir: (id: string) => void } = $props();

  let requete = $state('');
  let ouvert = $state(false);
  let actif = $state(0);

  const normaliser = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const resultats = $derived.by(() => {
    const q = normaliser(requete.trim());
    if (!q) return [];
    const mots = q.split(/\s+/);
    return personnes
      .filter((p) => {
        const t = normaliser(`${p.prenoms} ${p.nom} ${p.autresNoms ?? ''}`);
        return mots.every((m) => t.includes(m));
      })
      .slice(0, 10);
  });

  function choisir(p: Personne) {
    onchoisir(p.id);
    requete = '';
    ouvert = false;
  }

  function clavier(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      actif = Math.min(actif + 1, resultats.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      actif = Math.max(actif - 1, 0);
    } else if (e.key === 'Enter' && resultats[actif]) {
      e.preventDefault();
      choisir(resultats[actif]!);
    } else if (e.key === 'Escape') {
      requete = '';
      ouvert = false;
    }
  }
</script>

<div class="recherche">
  <input
    type="search"
    placeholder="Rechercher une personne…"
    aria-label="Rechercher une personne"
    role="combobox"
    aria-expanded={ouvert && resultats.length > 0}
    aria-controls="resultats-recherche"
    bind:value={requete}
    oninput={() => {
      ouvert = true;
      actif = 0;
    }}
    onfocus={() => (ouvert = true)}
    onblur={() => setTimeout(() => (ouvert = false), 150)}
    onkeydown={clavier}
  />
  {#if ouvert && requete.trim()}
    <ul id="resultats-recherche" role="listbox">
      {#each resultats as p, i (p.id)}
        <li role="option" aria-selected={i === actif}>
          <button type="button" class:actif={i === actif} onmousedown={(e) => e.preventDefault()} onclick={() => choisir(p)}>
            <span>{nomAffiche(p)}</span>
            <small>{datesAffichees(p)}</small>
          </button>
        </li>
      {:else}
        <li class="vide">Aucun résultat</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .recherche {
    position: relative;
    width: min(280px, 40vw);
  }
  input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--cadre-bord);
    border-radius: 6px;
    background: var(--fond);
  }
  ul {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--bordure);
    border-radius: 8px;
    box-shadow: var(--ombre);
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 0;
    border-radius: 5px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  button.actif,
  button:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  small,
  .vide {
    color: var(--texte-doux);
    font-size: 0.8rem;
  }
  .vide {
    padding: 0.4rem 0.5rem;
  }
</style>
