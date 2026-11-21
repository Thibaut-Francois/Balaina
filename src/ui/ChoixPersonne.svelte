<script lang="ts">
  import type { RefPersonne } from '../model/commandes';
  import type { DatePartielle, Personne } from '../model/types';
  import ChampDate from './ChampDate.svelte';
  import { datesAffichees, nomAffiche } from './texte';

  let {
    candidats,
    ref = $bindable(null),
    nomGroupe,
    autofocus = false,
  }: {
    /** Personnes existantes qu'il est permis de lier. */
    candidats: Personne[];
    ref: RefPersonne | null;
    nomGroupe: string;
    autofocus?: boolean;
  } = $props();

  let mode = $state<'nouvelle' | 'existante'>('nouvelle');
  let prenoms = $state('');
  let nom = $state('');
  let naissance = $state<DatePartielle | undefined>(undefined);
  let recherche = $state('');
  let choisi = $state<string | null>(null);

  const normaliser = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const filtres = $derived.by(() => {
    const q = normaliser(recherche.trim());
    const liste = q ? candidats.filter((p) => normaliser(nomAffiche(p) + ' ' + (p.autresNoms ?? '')).includes(q)) : candidats;
    return liste.slice(0, 50);
  });

  $effect(() => {
    if (mode === 'nouvelle') {
      ref =
        prenoms.trim() || nom.trim()
          ? { nouvelle: { prenoms: prenoms.trim(), nom: nom.trim(), ...(naissance ? { naissance } : {}) } }
          : null;
    } else ref = choisi ? { id: choisi } : null;
  });
</script>

<div class="choix">
  <div class="onglets" role="radiogroup" aria-label="Personne">
    <label><input type="radio" name={nomGroupe} value="nouvelle" bind:group={mode} /> Nouvelle personne</label>
    <label>
      <input type="radio" name={nomGroupe} value="existante" bind:group={mode} disabled={candidats.length === 0} />
      Lier une personne existante
    </label>
  </div>

  {#if mode === 'nouvelle'}
    <div class="ligne-champs">
      <label class="champ">
        <span>Prénom(s)</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input type="text" bind:value={prenoms} {autofocus} />
      </label>
      <label class="champ">
        <span>Nom</span>
        <input type="text" bind:value={nom} />
      </label>
    </div>
    <ChampDate libelle="Naissance" valeur={naissance} onchange={(d) => (naissance = d)} />
  {:else}
    <label class="champ">
      <span>Rechercher dans l'arbre</span>
      <input type="search" bind:value={recherche} placeholder="Nom ou prénom" />
    </label>
    <ul class="liste" role="listbox" aria-label="Personnes de l'arbre">
      {#each filtres as p (p.id)}
        <li>
          <label class:choisi={choisi === p.id}>
            <input type="radio" name="{nomGroupe}-existante" value={p.id} bind:group={choisi} />
            <span class="nom">{nomAffiche(p)}</span>
            <span class="dates">{datesAffichees(p)}</span>
          </label>
        </li>
      {:else}
        <li class="vide">Aucune personne ne correspond.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .onglets {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 220px;
    overflow: auto;
    border: 1px solid var(--bordure);
    border-radius: 6px;
  }
  .liste label {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
  }
  .liste label.choisi {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .liste input {
    margin: 0;
  }
  .nom {
    flex: 1;
  }
  .dates,
  .vide {
    color: var(--texte-doux);
    font-size: 0.85rem;
  }
  .vide {
    padding: 0.5rem;
  }
</style>
