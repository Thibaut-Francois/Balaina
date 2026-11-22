<script lang="ts">
  import type { IndexArbre } from '../model/index';
  import { enfantsOrdonnes } from '../model/index';
  import type { Union } from '../model/types';
  import { nomAffiche } from './texte';

  let {
    unions,
    idx,
    choisie = $bindable(null),
  }: { unions: Union[]; idx: IndexArbre; choisie: string | null } = $props();

  let recherche = $state('');

  const normaliser = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const nom = (id: string) => nomAffiche(idx.personnes.get(id)!);
  const couple = (u: Union) =>
    u.partenaires.length === 2 ? `${nom(u.partenaires[0])} et ${nom(u.partenaires[1]!)}` : `${nom(u.partenaires[0])} et un parent inconnu`;
  const fratrie = (u: Union) => {
    const e = enfantsOrdonnes(idx, u).map(nom);
    return e.length === 0 ? 'pas encore d’enfant' : `enfants : ${e.join(', ')}`;
  };

  const filtrees = $derived.by(() => {
    const q = normaliser(recherche.trim());
    const liste = q ? unions.filter((u) => normaliser(`${couple(u)} ${fratrie(u)}`).includes(q)) : unions;
    return liste.slice(0, 50);
  });
</script>

<label class="champ">
  <span>Rechercher un couple ou une fratrie</span>
  <input type="search" bind:value={recherche} placeholder="Nom d'un parent, d'un frère ou d'une sœur" />
</label>
<ul class="liste" aria-label="Unions de l'arbre">
  {#each filtrees as u (u.id)}
    <li>
      <label class:choisi={choisie === u.id}>
        <input type="radio" name="union-existante" value={u.id} bind:group={choisie} />
        <span>
          <span class="couple">{couple(u)}</span>
          <small>{fratrie(u)}</small>
        </span>
      </label>
    </li>
  {:else}
    <li class="vide">Aucune union ne correspond.</li>
  {/each}
</ul>

<style>
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
  .liste label > span {
    display: flex;
    flex-direction: column;
  }
  .liste label.choisi {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  small,
  .vide {
    color: var(--texte-doux);
    font-size: 0.85rem;
  }
  .vide {
    padding: 0.5rem;
  }
</style>
