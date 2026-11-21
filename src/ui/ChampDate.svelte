<script lang="ts">
  import { untrack } from 'svelte';
  import { analyserDate, formaterDate } from '../model/dates';
  import type { DatePartielle } from '../model/types';

  let {
    libelle,
    valeur,
    onchange,
    desactive = false,
  }: {
    libelle: string;
    valeur: DatePartielle | undefined;
    onchange: (d: DatePartielle | undefined) => void;
    desactive?: boolean;
  } = $props();

  const formater = (d: DatePartielle | undefined) => (d ? formaterDate(d) : '');
  let texte = $state(untrack(() => formater(valeur)));
  let erreur = $state('');

  // Si la valeur change de l'extérieur (annuler, autre personne), on resynchronise le texte,
  // sauf si le texte saisi correspond déjà à cette valeur.
  $effect(() => {
    const attendu = formater(valeur);
    untrack(() => {
      const r = analyserDate(texte);
      const actuel = r.ok ? formater(r.date) : null;
      if (actuel !== attendu) {
        texte = attendu;
        erreur = '';
      }
    });
  });

  function saisir(e: Event) {
    texte = (e.target as HTMLInputElement).value;
    const r = analyserDate(texte);
    if (r.ok) {
      erreur = '';
      onchange(r.date);
    } else erreur = r.erreur;
  }
</script>

<label class="champ">
  <span>{libelle}</span>
  <input
    type="text"
    value={texte}
    oninput={saisir}
    placeholder="ex. 12/03/1950, 03/1915, vers 1790"
    disabled={desactive}
    aria-invalid={erreur !== ''}
  />
  {#if erreur}<span class="erreur">{erreur}</span>{/if}
</label>
