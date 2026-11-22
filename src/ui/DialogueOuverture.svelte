<script lang="ts">
  import type { ResultatOuverture } from '../etat/sauvegarde.svelte';
  import { documentArbre } from '../etat/document.svelte';
  import { sauvegarde } from '../etat/sauvegarde.svelte';
  import { formaterInstant } from '../format/suivi';
  import Dialogue from './Dialogue.svelte';

  let {
    resultat,
    onfermer,
  }: { resultat: Exclude<ResultatOuverture, { statut: 'annule' }>; onfermer: () => void } = $props();

  const actuelles = documentArbre.arbre.personnes.length;
</script>

{#if resultat.statut === 'invalide'}
  <Dialogue titre="Fichier invalide" {onfermer} large>
    <p>« {resultat.nom} » ne peut pas être ouvert :</p>
    <ul class="erreurs">
      {#each resultat.erreurs as e}<li>{e}</li>{/each}
    </ul>
    <p class="aide">L'arbre actuel n'a pas été modifié.</p>
    {#snippet actions()}
      <button type="button" class="bouton principal" onclick={onfermer}>Fermer</button>
    {/snippet}
  </Dialogue>
{:else}
  <Dialogue titre="Ouvrir « {resultat.nom} » ?" {onfermer} large>
    <p>
      Ce fichier contient {resultat.arbre.personnes.length} personne{resultat.arbre.personnes.length > 1 ? 's' : ''} et
      {resultat.arbre.unions.length} union{resultat.arbre.unions.length > 1 ? 's' : ''}.
      {#if actuelles > 0}Il remplacera l'arbre actuel ({actuelles} personne{actuelles > 1 ? 's' : ''}).{/if}
    </p>
    {#if actuelles > 0 && sauvegarde.modifieDepuis}
      <p class="attention">
        ⚠ L'arbre actuel contient des modifications non exportées depuis {formaterInstant(sauvegarde.modifieDepuis)}.
        Vous pourrez revenir en arrière avec Ctrl+Z, mais pensez à l'enregistrer d'abord si vous voulez le garder.
      </p>
    {/if}
    {#if resultat.avertissements.length > 0}
      <details>
        <summary>{resultat.avertissements.length} incohérence{resultat.avertissements.length > 1 ? 's' : ''} de dates (sans gravité)</summary>
        <ul>
          {#each resultat.avertissements as a}<li>{a.message}</li>{/each}
        </ul>
      </details>
    {/if}
    {#snippet actions()}
      <button type="button" class="bouton" onclick={onfermer}>Annuler</button>
      <button
        type="button"
        class="bouton principal"
        onclick={() => {
          resultat.confirmer();
          onfermer();
        }}>{actuelles > 0 ? 'Remplacer l’arbre' : 'Ouvrir'}</button
      >
    {/snippet}
  </Dialogue>
{/if}

<style>
  .erreurs {
    color: var(--danger);
    max-height: 240px;
    overflow: auto;
  }
  .attention {
    color: var(--avertissement);
  }
  details {
    margin-top: 0.5rem;
    color: var(--texte-doux);
    font-size: 0.9rem;
  }
</style>
