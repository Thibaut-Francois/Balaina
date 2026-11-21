<script lang="ts">
  import { documentArbre } from '../etat/document.svelte';
  import {
    ajouterEnfant,
    ajouterParent,
    ajouterPartenaire,
    creerPersonne,
    type CibleEnfant,
    type RefPersonne,
  } from '../model/commandes';
  import { estAscendant, indexer, unionsChronologiques } from '../model/index';
  import ChoixPersonne from './ChoixPersonne.svelte';
  import Dialogue from './Dialogue.svelte';
  import { nomAffiche } from './texte';
  import type { ModeAjout } from './types';
  import { untrack } from 'svelte';

  let props: { mode: ModeAjout; personneId?: string; onfermer: () => void; onajoute: (id: string) => void } = $props();
  const onfermer = () => props.onfermer();

  // État figé à l'ouverture du dialogue (modal) : l'arbre ne peut pas changer pendant la saisie.
  const { mode, personneId, arbre } = untrack(() => ({ mode: props.mode, personneId: props.personneId, arbre: documentArbre.arbre }));
  const idx = indexer(arbre);
  const personne = personneId ? idx.personnes.get(personneId) : undefined;
  const nomPersonne = personne ? nomAffiche(personne) : '';

  const titre = {
    premiere: 'Créer la première personne',
    parent: `Ajouter un parent à ${nomPersonne}`,
    enfant: `Ajouter un enfant à ${nomPersonne}`,
    partenaire: `Ajouter un partenaire à ${nomPersonne}`,
  }[mode];

  // Choix de l'union pour un enfant : la plus récente est présélectionnée.
  const unions = personneId ? unionsChronologiques(idx, personneId) : [];
  const libelleUnion = (uid: string) => {
    const u = idx.unions.get(uid)!;
    const autre = u.partenaires.find((p) => p !== personneId);
    return autre ? `Avec ${nomAffiche(idx.personnes.get(autre)!)}` : 'Avec l’autre parent inconnu (union existante)';
  };
  let cible = $state<string>(unions.length > 0 ? unions[unions.length - 1]! : 'inconnu');

  // Personnes existantes qu'il est permis de lier, selon le cas.
  const candidats = (() => {
    const tous = arbre.personnes.filter((p) => p.id !== personneId);
    if (!personneId) return [];
    switch (mode) {
      case 'parent': {
        const deja = new Set(idx.unions.get(idx.unionParente.get(personneId) ?? '')?.partenaires ?? []);
        return tous.filter((p) => !deja.has(p.id) && !estAscendant(idx, personneId, p.id));
      }
      case 'enfant':
        return tous.filter((p) => !idx.unionParente.has(p.id) && !estAscendant(idx, p.id, personneId));
      default:
        return tous;
    }
  })();

  let ref = $state<RefPersonne | null>(null);
  let refPartenaire = $state<RefPersonne | null>(null);
  let erreur = $state('');

  const pret = $derived(ref !== null && (mode !== 'enfant' || cible !== 'nouveau' || refPartenaire !== null));

  function valider(e: Event) {
    e.preventDefault();
    if (!ref || !pret) return;
    let resultat;
    switch (mode) {
      case 'premiere':
        resultat = creerPersonne(arbre, 'nouvelle' in ref ? ref.nouvelle : { prenoms: '', nom: '' });
        break;
      case 'parent':
        resultat = ajouterParent(arbre, personneId!, ref);
        break;
      case 'partenaire':
        resultat = ajouterPartenaire(arbre, personneId!, ref);
        break;
      case 'enfant': {
        const c: CibleEnfant =
          cible === 'nouveau'
            ? { partenaire: refPartenaire! }
            : cible === 'inconnu'
              ? { autreParentInconnu: true }
              : { union: cible };
        resultat = ajouterEnfant(arbre, personneId!, c, ref);
        break;
      }
    }
    const r = documentArbre.executer(resultat);
    if (!r.ok) erreur = r.erreur;
    else {
      props.onajoute(r.id ?? '');
      onfermer();
    }
  }
</script>

<Dialogue {titre} {onfermer} large={mode === 'enfant'}>
  <form id="form-ajout" onsubmit={valider}>
    {#if mode === 'enfant'}
      <fieldset>
        <legend>Autre parent</legend>
        {#each unions as uid (uid)}
          <label class="case"><input type="radio" name="cible" value={uid} bind:group={cible} /> {libelleUnion(uid)}</label>
        {/each}
        <label class="case"><input type="radio" name="cible" value="nouveau" bind:group={cible} /> Un nouveau partenaire</label>
        <label class="case"><input type="radio" name="cible" value="inconnu" bind:group={cible} /> Autre parent inconnu</label>
      </fieldset>
      {#if cible === 'nouveau'}
        <fieldset>
          <legend>Nouveau partenaire</legend>
          <ChoixPersonne candidats={arbre.personnes.filter((p) => p.id !== personneId)} bind:ref={refPartenaire} nomGroupe="partenaire" />
        </fieldset>
      {/if}
      <fieldset>
        <legend>Enfant</legend>
        <ChoixPersonne {candidats} bind:ref nomGroupe="enfant" />
      </fieldset>
    {:else}
      <ChoixPersonne {candidats} bind:ref nomGroupe="personne" autofocus />
    {/if}
    {#if erreur}<p class="message-erreur" role="alert">{erreur}</p>{/if}
  </form>
  {#snippet actions()}
    <button type="button" class="bouton" onclick={onfermer}>Annuler</button>
    <button type="submit" form="form-ajout" class="bouton principal" disabled={!pret}>
      {mode === 'premiere' ? 'Créer' : 'Ajouter'}
    </button>
  {/snippet}
</Dialogue>

<style>
  fieldset {
    border: 1px solid var(--bordure);
    border-radius: 8px;
    padding: 0.6rem 0.8rem 0.3rem;
    margin: 0 0 0.75rem;
  }
  legend {
    padding: 0 0.3rem;
    color: var(--texte-doux);
    font-size: 0.85rem;
  }
</style>
