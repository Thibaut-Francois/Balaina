<script lang="ts">
  import { select } from 'd3-selection';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { onMount } from 'svelte';
  import type { Placement } from '../layout/types';
  import type { Personne } from '../model/types';
  import { datesAffichees, nomAffiche, POLICE_DATES, POLICE_NOM, tronquer } from './texte';

  let { placement, personnes }: { placement: Placement; personnes: Map<string, Personne> } = $props();

  let svg: SVGSVGElement;
  let transformation = $state('');
  let comportement: ZoomBehavior<SVGSVGElement, unknown>;

  const PADDING_TEXTE = 10;

  /** Chemin unique pour tous les traits : même couleur, même épaisseur, trait plein. */
  const chemin = $derived(
    placement.segments.map((s) => `M${s.x1} ${s.y1}H${s.x2}V${s.y2}`).join(''),
  );

  export function ajuster() {
    if (!svg || !comportement) return;
    const { width, height } = svg.getBoundingClientRect();
    const b = placement.bornes;
    if (b.largeur <= 0 || b.hauteur <= 0) return;
    const k = Math.min(width / b.largeur, height / b.hauteur, 1.5);
    const t = zoomIdentity
      .translate((width - b.largeur * k) / 2 - b.x * k, (height - b.hauteur * k) / 2 - b.y * k)
      .scale(k);
    select(svg).call(comportement.transform, t);
  }

  /** Centre la vue sur le cadre d'une personne (recherche). */
  export function centrerSur(id: string, k = 1) {
    const c = placement.cadres.find((x) => x.id === id);
    if (!c || !svg || !comportement) return;
    const { width, height } = svg.getBoundingClientRect();
    const t = zoomIdentity
      .translate(width / 2 - (c.x + placement.largeurCadre / 2) * k, height / 2 - (c.y + placement.hauteurCadre / 2) * k)
      .scale(k);
    select(svg).call(comportement.transform, t);
  }

  onMount(() => {
    comportement = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', (e) => (transformation = e.transform.toString()));
    select(svg).call(comportement).on('dblclick.zoom', null);
    ajuster();
  });
</script>

<svg bind:this={svg} class="arbre" role="img" aria-label="Arbre généalogique">
  <g transform={transformation}>
    <path class="traits" d={chemin} />
    {#each placement.points as p (p.unionId)}
      <circle class="point" cx={p.x} cy={p.y} r="4.5" />
    {/each}
    {#each placement.cadres as c (c.id)}
      {@const personne = personnes.get(c.id)!}
      {@const nom = nomAffiche(personne)}
      {@const dates = datesAffichees(personne)}
      {@const nomCourt = tronquer(nom, placement.largeurCadre - 2 * PADDING_TEXTE, POLICE_NOM)}
      {@const datesCourtes = tronquer(dates, placement.largeurCadre - 2 * PADDING_TEXTE, POLICE_DATES)}
      <g class="cadre" transform="translate({c.x},{c.y})">
        <title>{nom}{dates ? `\n${dates}` : ''}</title>
        <rect width={placement.largeurCadre} height={placement.hauteurCadre} rx="6" />
        <text class="nom" x={PADDING_TEXTE} y="23">{nomCourt}</text>
        {#if dates}
          <text class="dates" x={PADDING_TEXTE} y="42">{datesCourtes}</text>
        {/if}
      </g>
    {/each}
  </g>
</svg>

<style>
  .arbre {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
  }
  .arbre:active {
    cursor: grabbing;
  }
  .traits {
    fill: none;
    stroke: var(--trait);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .point {
    fill: var(--trait);
  }
  .cadre rect {
    fill: var(--cadre-fond);
    stroke: var(--cadre-bord);
    stroke-width: 1;
  }
  .nom {
    font: 600 13px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    fill: var(--texte);
  }
  .dates {
    font: 400 12px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    fill: var(--texte-doux);
  }
</style>
