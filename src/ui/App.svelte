<script lang="ts">
  // Phase 2 : affichage en lecture seule de l'arbre d'exemple.
  import exemple from '../../exemples/famille-complexe.json';
  import { importerJSON } from '../format/io';
  import { calculerPlacement } from '../layout/index';
  import type { Arbre as TypeArbre } from '../model/types';
  import Arbre from './Arbre.svelte';

  let arbre = $state<TypeArbre | null>(null);
  let erreurs = $state<string[]>([]);
  let vue: ReturnType<typeof Arbre> | undefined = $state();

  async function charger() {
    // En développement, `?graine=N&taille=T` affiche un arbre aléatoire des tests (mise au point du placement).
    const params = new URLSearchParams(location.search);
    if (import.meta.env.DEV && params.has('graine')) {
      const { arbreAleatoire } = await import('../../tests/invariants');
      arbre = arbreAleatoire(Number(params.get('graine')), Number(params.get('taille') ?? 40), params.has('realiste'));
    } else {
      const r = importerJSON(JSON.stringify(exemple));
      if (r.ok) arbre = r.arbre;
      else erreurs = r.erreurs;
    }
    // `?centre=P0009&zoom=1` : centre la vue sur une personne (mise au point, captures).
    const centre = params.get('centre');
    if (centre) setTimeout(() => vue?.centrerSur(centre, Number(params.get('zoom') ?? 1)), 50);
  }
  charger();

  const placement = $derived(arbre ? calculerPlacement(arbre) : null);
  const personnes = $derived(new Map((arbre?.personnes ?? []).map((p) => [p.id, p])));
</script>

<div class="app">
  <header>
    <h1>Balaina</h1>
    <button type="button" onclick={() => vue?.ajuster()}>Ajuster à l'écran</button>
    {#if placement && placement.avertissements.length > 0}
      <span class="avertissement" title={placement.avertissements.join('\n')}>
        {placement.avertissements.length} union(s) dessinée(s) hors ligne
      </span>
    {/if}
  </header>
  <main>
    {#if placement}
      <Arbre bind:this={vue} {placement} {personnes} />
    {:else if erreurs.length > 0}
      <ul class="erreurs">
        {#each erreurs as e}<li>{e}</li>{/each}
      </ul>
    {/if}
  </main>
</div>

<style>
  :global(:root) {
    --fond: #f7f6f3;
    --texte: #1f1d1a;
    --texte-doux: #5c5750;
    --trait: #57534e;
    --cadre-fond: #ffffff;
    --cadre-bord: #b8b2a7;
    --bordure: #e2ded6;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --fond: #1b1a18;
      --texte: #ece9e3;
      --texte-doux: #aaa49a;
      --trait: #a39d93;
      --cadre-fond: #26241f;
      --cadre-bord: #4d4840;
      --bordure: #34312b;
    }
  }
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: var(--fond);
    color: var(--texte);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  :global(#app) {
    height: 100%;
  }
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }
  h1 {
    font-size: 1.1rem;
    margin: 0;
  }
  button {
    font: inherit;
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--cadre-bord);
    border-radius: 6px;
    background: var(--cadre-fond);
    color: var(--texte);
    cursor: pointer;
  }
  .avertissement {
    font-size: 0.85rem;
    color: var(--texte-doux);
  }
  main {
    flex: 1;
    min-height: 0;
  }
  .erreurs {
    padding: 2rem;
  }
</style>
