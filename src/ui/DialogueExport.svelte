<script lang="ts">
  import { untrack } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import { sauvegarde } from '../etat/sauvegarde.svelte';
  import { genererImage, type FormatImage } from '../export/image';
  import { imprimer } from '../export/impression';
  import {
    echelleImage,
    FORMATS_PAPIER,
    MM_PAR_PX,
    mettreEnPage,
    type FormatPapier,
    type ModePages,
    type Orientation,
  } from '../export/pagination';
  import { telecharger } from '../format/fichiers';
  import { nomParDefaut } from '../format/suivi';
  import type { Placement } from '../layout/types';
  import Dialogue from './Dialogue.svelte';

  let props: { mode: 'exporter' | 'imprimer'; placement: Placement; onfermer: () => void; oninformer: (t: string, erreur?: boolean) => void } =
    $props();
  const { mode, placement } = untrack(() => ({ mode: props.mode, placement: props.placement }));
  const arbre = untrack(() => documentArbre.arbre);

  // Préférences retenues d'une fois sur l'autre (simple confort, dans ce navigateur).
  const CLE = 'balaina:options-export';
  const lire = () => {
    try {
      return JSON.parse(localStorage.getItem(CLE) ?? '{}');
    } catch {
      return {};
    }
  };
  const prefs = lire();
  let format = $state<'pdf' | FormatImage>(prefs.format ?? 'pdf');
  let papier = $state<FormatPapier>(prefs.papier ?? 'A4');
  let orientation = $state<Orientation>(prefs.orientation ?? 'auto');
  let pages = $state<ModePages>(prefs.pages ?? 'une-page');
  let resolution = $state<number>(prefs.resolution ?? 2);
  let occupe = $state(false);

  $effect(() => {
    const v = { format, papier, orientation, pages, resolution };
    try {
      localStorage.setItem(CLE, JSON.stringify(v));
    } catch {
      /* stockage indisponible : sans importance */
    }
  });

  const surPapier = $derived(mode === 'imprimer' || format === 'pdf');
  const mise = $derived(mettreEnPage(placement.bornes, { format: papier, orientation, mode: pages }));
  const image = $derived(echelleImage(placement.bornes.largeur, placement.bornes.hauteur, resolution));
  const nombre = (v: number) => Math.round(v).toLocaleString('fr-FR');

  const resume = $derived.by(() => {
    if (!surPapier) {
      const l = placement.bornes.largeur * image.echelle,
        h = placement.bornes.hauteur * image.echelle;
      return `${nombre(l)} × ${nombre(h)} pixels`;
    }
    const sens = mise.orientation === 'portrait' ? 'portrait' : 'paysage';
    if (pages === 'une-page') {
      const pct = Math.round((mise.echelle / MM_PAR_PX) * 100);
      return `1 page ${FORMATS_PAPIER[papier].libelle} ${sens}, ${pct < 100 ? `réduit à ${pct} % de la taille réelle` : 'à taille réelle'}`;
    }
    return `${mise.pages.length} page${mise.pages.length > 1 ? 's' : ''} ${FORMATS_PAPIER[papier].libelle} ${sens} (${mise.colonnes} × ${mise.lignes}), à assembler`;
  });
  const petitTexte = $derived(surPapier && pages === 'une-page' && mise.echelle / MM_PAR_PX < 0.35);

  const nomBase = (sauvegarde.nomFichier ?? nomParDefaut()).replace(/\.json$/i, '');

  async function valider(e: Event) {
    e.preventDefault();
    if (mode === 'imprimer') {
      props.onfermer();
      imprimer(placement, arbre, { format: papier, orientation, mode: pages });
      return;
    }
    occupe = true;
    try {
      if (format === 'pdf') {
        const { genererPdf } = await import('../export/pdf');
        const { blob } = await genererPdf(placement, arbre, { format: papier, orientation, mode: pages });
        telecharger(blob, `${nomBase}.pdf`);
      } else {
        const r = await genererImage(placement, arbre, format, resolution);
        telecharger(r.blob, `${nomBase}.${format === 'png' ? 'png' : 'jpg'}`);
        if (r.reduite) props.oninformer(`Résolution réduite à ${nombre(r.largeur)} × ${nombre(r.hauteur)} pixels (limite du navigateur).`);
      }
      props.onfermer();
    } catch (err) {
      props.oninformer(`L'export a échoué : ${err instanceof Error ? err.message : err}`, true);
    } finally {
      occupe = false;
    }
  }

</script>

<Dialogue titre={mode === 'imprimer' ? 'Imprimer l’arbre' : 'Exporter l’arbre en image ou en PDF'} onfermer={props.onfermer}>
  <form id="form-export" onsubmit={valider}>
    {#if mode === 'exporter'}
      <fieldset>
        <legend>Format</legend>
        <label class="case"><input type="radio" name="format" value="pdf" bind:group={format} /> PDF vectoriel <small>(net à toute taille)</small></label>
        <label class="case"><input type="radio" name="format" value="png" bind:group={format} /> PNG <small>(texte et traits plus nets)</small></label>
        <label class="case"><input type="radio" name="format" value="jpeg" bind:group={format} /> JPEG</label>
      </fieldset>
    {/if}

    {#if surPapier}
      <div class="ligne-champs">
        <label class="champ">
          <span>Papier</span>
          <select bind:value={papier}>
            {#each Object.entries(FORMATS_PAPIER) as [cle, f]}<option value={cle}>{f.libelle}</option>{/each}
          </select>
        </label>
        <label class="champ">
          <span>Orientation</span>
          <select bind:value={orientation}>
            <option value="auto">Automatique</option>
            <option value="portrait">Portrait</option>
            <option value="paysage">Paysage</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Mise en page</legend>
        <label class="case"><input type="radio" name="pages" value="une-page" bind:group={pages} /> Tenir sur une page</label>
        <label class="case"><input type="radio" name="pages" value="taille-reelle" bind:group={pages} /> Taille réelle sur plusieurs pages</label>
      </fieldset>
    {:else}
      <label class="champ">
        <span>Résolution</span>
        <select bind:value={resolution}>
          <option value={1}>Standard (comme à l'écran)</option>
          <option value={2}>Haute (×2)</option>
          <option value={3}>Très haute (×3)</option>
          <option value={4}>Maximale (×4)</option>
        </select>
      </label>
    {/if}

    <p class="resume">{resume}</p>
    {#if petitTexte}
      <p class="aide">Le texte sera très petit : un papier plus grand ou la taille réelle sur plusieurs pages sera plus lisible.</p>
    {/if}
    {#if !surPapier && image.reduite}
      <p class="aide">Cette résolution dépasse ce que le navigateur peut produire : elle sera réduite.</p>
    {/if}
    <p class="aide">Tout l'arbre est exporté, sur fond blanc, quelle que soit la partie visible à l'écran.</p>
  </form>
  {#snippet actions()}
    <button type="button" class="bouton" onclick={props.onfermer}>Annuler</button>
    <button type="submit" form="form-export" class="bouton principal" disabled={occupe}>
      {occupe ? 'Préparation…' : mode === 'imprimer' ? 'Imprimer' : 'Exporter'}
    </button>
  {/snippet}
</Dialogue>

<style>
  fieldset {
    border: 1px solid var(--bordure);
    border-radius: 8px;
    padding: 0.6rem 0.8rem 0.2rem;
    margin: 0 0 0.75rem;
  }
  legend {
    padding: 0 0.3rem;
    color: var(--texte-doux);
    font-size: 0.85rem;
  }
  small {
    color: var(--texte-doux);
  }
  .resume {
    font-weight: 600;
    margin: 0.25rem 0 0.5rem;
  }
</style>
