<script lang="ts">
  import { documentArbre } from '../etat/document.svelte';
  import { modifierPersonne, type DonneesPersonne } from '../model/commandes';
  import type { DatePartielle, Personne } from '../model/types';
  import { avertissements } from '../model/validate';
  import ChampDate from './ChampDate.svelte';
  import { nomAffiche } from './texte';

  let { personne, onfermer }: { personne: Personne; onfermer: () => void } = $props();

  /** Chaque modification est enregistrée tout de suite ; la frappe dans un champ ne fait qu'une étape d'annulation. */
  function modifier(champ: string, modifs: Partial<DonneesPersonne>) {
    documentArbre.executer(modifierPersonne(documentArbre.arbre, personne.id, modifs), `personne:${personne.id}:${champ}`);
  }
  const texte = (champ: 'prenoms' | 'nom' | 'autresNoms' | 'genre' | 'notes') => (e: Event) =>
    modifier(champ, { [champ]: (e.target as HTMLInputElement).value });

  function changerDeces(decede: boolean) {
    modifier('deces', { deces: decede ? { decede: true } : undefined });
  }
  function changerDateDeces(date: DatePartielle | undefined) {
    modifier('deces-date', { deces: date ? { decede: true, date } : { decede: true } });
  }

  const alertes = $derived(avertissements(documentArbre.arbre).filter((a) => a.ids.includes(personne.id)));
</script>

<aside class="panneau" aria-label="Fiche de {nomAffiche(personne)}">
  <header>
    <h2>{nomAffiche(personne)}</h2>
    <button type="button" class="bouton bouton-icone" onclick={onfermer} aria-label="Fermer la fiche">✕</button>
  </header>

  <div class="ligne-champs">
    <label class="champ">
      <span>Prénom(s)</span>
      <input type="text" value={personne.prenoms} oninput={texte('prenoms')} />
    </label>
    <label class="champ">
      <span>Nom</span>
      <input type="text" value={personne.nom} oninput={texte('nom')} />
    </label>
  </div>
  <label class="champ">
    <span>Autres noms <small>(nom de naissance, d'usage…)</small></span>
    <input type="text" value={personne.autresNoms ?? ''} oninput={texte('autresNoms')} />
  </label>
  <label class="champ">
    <span>Genre <small>(facultatif, texte libre)</small></span>
    <input type="text" value={personne.genre ?? ''} oninput={texte('genre')} />
  </label>

  <ChampDate libelle="Naissance" valeur={personne.naissance} onchange={(d) => modifier('naissance', { naissance: d })} />

  <label class="case">
    <input type="checkbox" checked={!!personne.deces} onchange={(e) => changerDeces((e.target as HTMLInputElement).checked)} />
    Décédé·e
  </label>
  {#if personne.deces}
    <ChampDate libelle="Date de décès (facultative)" valeur={personne.deces.date} onchange={changerDateDeces} />
  {/if}

  <label class="champ">
    <span>Notes</span>
    <textarea rows="4" value={personne.notes ?? ''} oninput={texte('notes')}></textarea>
  </label>

  {#if alertes.length > 0}
    <ul class="alertes" aria-label="Avertissements">
      {#each alertes as a}<li>⚠ {a.message}</li>{/each}
    </ul>
  {/if}
  <p class="aide">Les modifications sont enregistrées immédiatement (Ctrl+Z pour annuler).</p>
</aside>

<style>
  small {
    color: var(--texte-doux);
  }
  .alertes {
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    list-style: none;
    border-radius: 6px;
    color: var(--avertissement);
    background: color-mix(in srgb, var(--avertissement) 10%, transparent);
    font-size: 0.85rem;
  }
</style>
