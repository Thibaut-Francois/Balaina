<script lang="ts">
  import { untrack } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import {
    ajouterEnfant,
    ajouterParent,
    ajouterPartenaire,
    completerUnion,
    creerPersonne,
    rattacherEnfant,
    type CibleEnfant,
    type RefPersonne,
    type Resultat,
  } from '../model/commandes';
  import { enfantsOrdonnes, estAscendant, indexer, unionsChronologiques } from '../model/index';
  import type { Union } from '../model/types';
  import ChoixPersonne from './ChoixPersonne.svelte';
  import ChoixUnion from './ChoixUnion.svelte';
  import Dialogue from './Dialogue.svelte';
  import { nomAffiche } from './texte';
  import type { ModeAjout } from './types';

  let props: {
    mode: ModeAjout;
    personneId?: string;
    unionId?: string;
    onfermer: () => void;
    onajoute: (id: string) => void;
  } = $props();
  const onfermer = () => props.onfermer();

  // État figé à l'ouverture du dialogue (modal) : l'arbre ne peut pas changer pendant la saisie.
  const { mode, personneId, unionId, arbre } = untrack(() => ({
    mode: props.mode,
    personneId: props.personneId,
    unionId: props.unionId,
    arbre: documentArbre.arbre,
  }));
  const idx = indexer(arbre);
  const nom = (id: string) => nomAffiche(idx.personnes.get(id)!);
  const personne = personneId ? idx.personnes.get(personneId) : undefined;
  const nomPersonne = personne ? nomAffiche(personne) : '';
  const union = unionId ? idx.unions.get(unionId) : undefined;
  const couple = (u: Union) =>
    u.partenaires.length === 2 ? `${nom(u.partenaires[0])} et ${nom(u.partenaires[1]!)}` : `${nom(u.partenaires[0])}`;
  const enfantsDe = (u: Union) => {
    const e = enfantsOrdonnes(idx, u).map(nom);
    return e.length === 0 ? 'sans enfant' : `enfants : ${e.join(', ')}`;
  };

  const titre = {
    premiere: 'Créer la première personne',
    parent: `Ajouter un parent à ${nomPersonne}`,
    enfant: `Ajouter un enfant à ${nomPersonne}`,
    partenaire: `Ajouter un partenaire à ${nomPersonne}`,
    'enfant-union': union ? `Ajouter un enfant à l'union de ${couple(union)}` : '',
    'parent-union': union ? `Ajouter l'autre parent des enfants de ${couple(union)}` : '',
  }[mode];

  // ---- Ajouter un enfant : choix de l'union, la plus récente présélectionnée ----
  const unions = personneId ? unionsChronologiques(idx, personneId) : [];
  const libelleUnion = (uid: string) => {
    const u = idx.unions.get(uid)!;
    const autre = u.partenaires.find((p) => p !== personneId);
    return autre ? `Avec ${nom(autre)}` : 'Avec l’autre parent inconnu (union existante)';
  };
  let cible = $state<string>(unions.length > 0 ? unions[unions.length - 1]! : 'inconnu');

  // ---- Ajouter un parent à une personne sans parents : nouveau parent ou fratrie existante ----
  const sansParents = mode === 'parent' && personneId !== undefined && !idx.unionParente.has(personneId);
  let maniereParent = $state<'nouveau' | 'fratrie'>('nouveau');
  let fratrie = $state<string | null>(null);
  /** Unions qu'une personne peut rejoindre comme enfant (sans créer de boucle). */
  const fratriesPossibles = sansParents
    ? arbre.unions.filter((u) => !u.partenaires.some((p) => p === personneId || estAscendant(idx, personneId!, p)))
    : [];

  // Personnes existantes qu'il est permis de lier, selon le cas.
  const descendDe = (u: Union, id: string) => u.enfants.some((e) => e === id || estAscendant(idx, e, id));
  const candidats = (() => {
    const tous = arbre.personnes.filter((p) => p.id !== personneId);
    switch (mode) {
      case 'parent': {
        const deja = new Set(idx.unions.get(idx.unionParente.get(personneId!) ?? '')?.partenaires ?? []);
        return tous.filter((p) => !deja.has(p.id) && !estAscendant(idx, personneId!, p.id));
      }
      case 'enfant':
        return tous.filter((p) => !idx.unionParente.has(p.id) && !estAscendant(idx, p.id, personneId!));
      case 'enfant-union':
        return tous.filter(
          (p) => !union!.partenaires.includes(p.id) && !idx.unionParente.has(p.id) && !union!.partenaires.some((q) => estAscendant(idx, p.id, q)),
        );
      case 'parent-union':
        return tous.filter((p) => !union!.partenaires.includes(p.id) && !descendDe(union!, p.id));
      case 'partenaire':
        return tous;
      default:
        return [];
    }
  })();

  let ref = $state<RefPersonne | null>(null);
  let refPartenaire = $state<RefPersonne | null>(null);
  let erreur = $state('');

  // ---- Ajouter un partenaire : nouvelle union, ou compléter une union dont l'autre parent est inconnu ----
  type ChoixPartenaire = { cle: string; libelle: string; detail: string; unionId: string; complete: 'moi' | 'partenaire' };
  const unionsIncompletes = (id: string) =>
    (idx.unionsDe.get(id) ?? []).map((u) => idx.unions.get(u)!).filter((u) => u.partenaires.length === 1);
  const optionsPartenaire = $derived.by((): ChoixPartenaire[] => {
    if (mode !== 'partenaire' || !personneId) return [];
    const res: ChoixPartenaire[] = [];
    // Les unions incomplètes de la personne : le partenaire en devient l'autre parent.
    for (const u of unionsIncompletes(personneId)) {
      if (ref && 'id' in ref && descendDe(u, ref.id)) continue;
      res.push({
        cle: `moi:${u.id}`,
        libelle: `Devenir l'autre parent des enfants de ${nomPersonne}`,
        detail: enfantsDe(u),
        unionId: u.id,
        complete: 'partenaire',
      });
    }
    // Les unions incomplètes du partenaire existant choisi : la personne en devient l'autre parent.
    if (ref && 'id' in ref) {
      for (const u of unionsIncompletes(ref.id)) {
        if (descendDe(u, personneId)) continue;
        res.push({
          cle: `lui:${u.id}`,
          libelle: `${nomPersonne} devient l'autre parent des enfants de ${nom(ref.id)}`,
          detail: enfantsDe(u),
          unionId: u.id,
          complete: 'moi',
        });
      }
    }
    return res;
  });
  let choixUnionPartenaire = $state('nouvelle');
  $effect(() => {
    // si l'option choisie disparaît (autre partenaire choisi), on revient à une nouvelle union
    if (choixUnionPartenaire !== 'nouvelle' && !optionsPartenaire.some((o) => o.cle === choixUnionPartenaire))
      choixUnionPartenaire = 'nouvelle';
  });

  const pret = $derived.by(() => {
    if (mode === 'parent' && sansParents && maniereParent === 'fratrie') return fratrie !== null;
    if (mode === 'enfant' && cible === 'nouveau' && refPartenaire === null) return false;
    return ref !== null;
  });

  function valider(e: Event) {
    e.preventDefault();
    if (!pret) return;
    let resultat: Resultat;
    switch (mode) {
      case 'premiere':
        resultat = creerPersonne(arbre, ref && 'nouvelle' in ref ? ref.nouvelle : { prenoms: '', nom: '' });
        break;
      case 'parent':
        resultat =
          sansParents && maniereParent === 'fratrie'
            ? rattacherEnfant(arbre, fratrie!, { id: personneId! })
            : ajouterParent(arbre, personneId!, ref!);
        break;
      case 'partenaire': {
        const option = optionsPartenaire.find((o) => o.cle === choixUnionPartenaire);
        if (!option) resultat = ajouterPartenaire(arbre, personneId!, ref!);
        else if (option.complete === 'partenaire') resultat = completerUnion(arbre, option.unionId, ref!);
        else {
          resultat = completerUnion(arbre, option.unionId, { id: personneId! });
          if (resultat.ok) resultat = { ...resultat, id: (ref as { id: string }).id };
        }
        break;
      }
      case 'enfant': {
        const c: CibleEnfant =
          cible === 'nouveau' ? { partenaire: refPartenaire! } : cible === 'inconnu' ? { autreParentInconnu: true } : { union: cible };
        resultat = ajouterEnfant(arbre, personneId!, c, ref!);
        break;
      }
      case 'enfant-union':
        resultat = rattacherEnfant(arbre, unionId!, ref!);
        break;
      case 'parent-union':
        resultat = completerUnion(arbre, unionId!, ref!);
        break;
    }
    const r = documentArbre.executer(resultat);
    if (!r.ok) erreur = r.erreur;
    else {
      props.onajoute(r.id ?? '');
      onfermer();
    }
  }
</script>

<Dialogue {titre} {onfermer} large={mode === 'enfant' || mode === 'partenaire' || sansParents}>
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
    {:else if sansParents}
      <div class="onglets" role="radiogroup" aria-label="Manière d'ajouter un parent">
        <label><input type="radio" name="maniere" value="nouveau" bind:group={maniereParent} /> Un parent</label>
        <label>
          <input type="radio" name="maniere" value="fratrie" bind:group={maniereParent} disabled={fratriesPossibles.length === 0} />
          Rejoindre une fratrie existante
        </label>
      </div>
      {#if maniereParent === 'nouveau'}
        <ChoixPersonne {candidats} bind:ref nomGroupe="personne" autofocus />
      {:else}
        <p class="aide">{nomPersonne} devient l'enfant de ce couple, aux côtés de ses autres enfants.</p>
        <ChoixUnion unions={fratriesPossibles} {idx} bind:choisie={fratrie} />
      {/if}
    {:else if mode === 'enfant-union' || mode === 'parent-union'}
      <p class="aide">{union ? enfantsDe(union) : ''}</p>
      <ChoixPersonne {candidats} bind:ref nomGroupe="personne" autofocus />
    {:else}
      <ChoixPersonne {candidats} bind:ref nomGroupe="personne" autofocus />
      {#if optionsPartenaire.length > 0}
        <fieldset>
          <legend>Union</legend>
          <label class="case">
            <input type="radio" name="union-partenaire" value="nouvelle" bind:group={choixUnionPartenaire} /> Nouvelle union
          </label>
          {#each optionsPartenaire as o (o.cle)}
            <label class="case option">
              <input type="radio" name="union-partenaire" value={o.cle} bind:group={choixUnionPartenaire} />
              <span>{o.libelle} <small>({o.detail})</small></span>
            </label>
          {/each}
        </fieldset>
      {/if}
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
  .onglets {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .option {
    align-items: flex-start;
  }
  small {
    color: var(--texte-doux);
  }
</style>
