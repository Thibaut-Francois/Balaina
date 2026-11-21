<script lang="ts">
  import { documentArbre } from '../etat/document.svelte';
  import { deplacerEnfant, modifierUnion, supprimerUnion, type ModifsUnion } from '../model/commandes';
  import { enfantsOrdonnes, indexer } from '../model/index';
  import { LIBELLES_TYPE_UNION, TYPES_UNION, type TypeUnion, type Union } from '../model/types';
  import ChampDate from './ChampDate.svelte';
  import { datesAffichees, nomAffiche } from './texte';

  let { union, onfermer }: { union: Union; onfermer: () => void } = $props();

  const idx = $derived(indexer(documentArbre.arbre));
  const titre = $derived(
    union.partenaires.map((p) => nomAffiche(idx.personnes.get(p)!)).join(' et ') +
      (union.partenaires.length === 1 ? ' et un parent inconnu' : ''),
  );
  const enfants = $derived(enfantsOrdonnes(idx, union).map((id) => idx.personnes.get(id)!));
  const sansDate = $derived(enfants.filter((p) => !p.naissance));

  let confirmerSuppression = $state(false);

  const modifier = (champ: string, modifs: ModifsUnion) =>
    documentArbre.executer(modifierUnion(documentArbre.arbre, union.id, modifs), `union:${union.id}:${champ}`);

  function deplacer(id: string, sens: -1 | 1) {
    documentArbre.executer(deplacerEnfant(documentArbre.arbre, union.id, id, sens));
  }
  function supprimer() {
    documentArbre.executer(supprimerUnion(documentArbre.arbre, union.id));
    onfermer();
  }
</script>

<aside class="panneau" aria-label="Union de {titre}">
  <header>
    <h2>Union de {titre}</h2>
    <button type="button" class="bouton bouton-icone" onclick={onfermer} aria-label="Fermer">✕</button>
  </header>

  <label class="champ">
    <span>Type</span>
    <select value={union.type} onchange={(e) => modifier('type', { type: (e.target as HTMLSelectElement).value as TypeUnion })}>
      {#each TYPES_UNION as t}<option value={t}>{LIBELLES_TYPE_UNION[t]}</option>{/each}
    </select>
  </label>
  <div class="ligne-champs">
    <ChampDate libelle="Début" valeur={union.debut} onchange={(d) => modifier('debut', { debut: d ?? null })} />
    <ChampDate libelle="Fin" valeur={union.fin} onchange={(d) => modifier('fin', { fin: d ?? null })} />
  </div>

  <h3>Enfants</h3>
  {#if enfants.length === 0}
    <p class="aide">Aucun enfant.</p>
  {:else}
    <ol class="enfants">
      {#each enfants as e (e.id)}
        {@const i = sansDate.indexOf(e)}
        <li>
          <span class="nom">{nomAffiche(e)} <small>{datesAffichees(e) || 'sans date'}</small></span>
          {#if i >= 0}
            <button type="button" class="bouton bouton-icone" disabled={i === 0} onclick={() => deplacer(e.id, -1)} aria-label="Placer {nomAffiche(e)} plus à gauche">←</button>
            <button type="button" class="bouton bouton-icone" disabled={i === sansDate.length - 1} onclick={() => deplacer(e.id, 1)} aria-label="Placer {nomAffiche(e)} plus à droite">→</button>
          {/if}
        </li>
      {/each}
    </ol>
    <p class="aide">Les enfants sont triés par date de naissance ; ceux sans date se placent en fin de groupe et se réordonnent avec les flèches.</p>
  {/if}

  <div class="suppression">
    {#if confirmerSuppression}
      <p>Supprimer cette union ? Les partenaires et les enfants restent dans l'arbre, mais les enfants n'auront plus de parents.</p>
      <button type="button" class="bouton" onclick={() => (confirmerSuppression = false)}>Annuler</button>
      <button type="button" class="bouton principal danger" onclick={supprimer}>Supprimer l'union</button>
    {:else}
      <button type="button" class="bouton danger" onclick={() => (confirmerSuppression = true)}>Supprimer l'union…</button>
    {/if}
  </div>
</aside>

<style>
  h3 {
    font-size: 0.95rem;
    margin: 0.75rem 0 0.4rem;
  }
  .enfants {
    margin: 0;
    padding-left: 1.4rem;
  }
  .enfants li {
    padding: 0.2rem 0;
  }
  .enfants li > * {
    vertical-align: middle;
  }
  .nom {
    display: inline-block;
    min-width: 60%;
  }
  small {
    color: var(--texte-doux);
  }
  .suppression {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--bordure);
  }
  .suppression p {
    margin-top: 0;
  }
</style>
