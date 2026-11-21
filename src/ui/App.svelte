<script lang="ts">
  // Phase 1 : coquille minimale. Le rendu de l'arbre arrive en phase 2.
  import exemple from '../../exemples/famille-complexe.json';
  import { importerJSON } from '../format/io';

  const resultat = importerJSON(JSON.stringify(exemple));
</script>

<main>
  <h1>Balaina</h1>
  <p>Arbre généalogique, 100 % local.</p>
  {#if resultat.ok}
    <p>
      Exemple chargé : {resultat.arbre.personnes.length} personnes, {resultat.arbre.unions.length} unions.
      L'affichage de l'arbre arrive en phase 2.
    </p>
  {:else}
    <ul>
      {#each resultat.erreurs as e}<li>{e}</li>{/each}
    </ul>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #fafaf9;
    color: #1c1917;
  }
  main {
    padding: 2rem;
  }
</style>
