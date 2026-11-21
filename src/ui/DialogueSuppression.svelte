<script lang="ts">
  import { untrack } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import { liensDePersonne, supprimerPersonne } from '../model/commandes';
  import Dialogue from './Dialogue.svelte';
  import { nomAffiche } from './texte';

  let { personneId, onfermer }: { personneId: string; onfermer: () => void } = $props();

  // État figé à l'ouverture du dialogue (modal).
  const { arbre, id } = untrack(() => ({ arbre: documentArbre.arbre, id: personneId }));
  const personne = arbre.personnes.find((p) => p.id === id)!;
  const liens = liensDePersonne(arbre, id);
  let erreur = $state('');

  function supprimer() {
    const r = documentArbre.executer(supprimerPersonne(arbre, id));
    if (r.ok) onfermer();
    else erreur = r.erreur;
  }
</script>

<Dialogue titre="Supprimer {nomAffiche(personne)} ?" {onfermer}>
  {#if liens.length > 0}
    <p>Les liens suivants seront retirés :</p>
    <ul>
      {#each liens as l}<li>{l}</li>{/each}
    </ul>
    <p class="aide">Aucune autre personne n'est supprimée. Une union qui n'a plus aucun partenaire disparaît ; ses enfants restent dans l'arbre.</p>
  {:else}
    <p>Cette personne n'a aucun lien dans l'arbre.</p>
  {/if}
  <p class="aide">Ctrl+Z permet d'annuler la suppression.</p>
  {#if erreur}<p class="message-erreur" role="alert">{erreur}</p>{/if}
  {#snippet actions()}
    <button type="button" class="bouton" onclick={onfermer}>Annuler</button>
    <button type="button" class="bouton principal danger" onclick={supprimer}>Supprimer</button>
  {/snippet}
</Dialogue>
