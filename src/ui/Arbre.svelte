<script lang="ts">
  import { select } from 'd3-selection';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { onMount } from 'svelte';
  import type { Placement } from '../layout/types';
  import type { Arbre, Personne } from '../model/types';
  import { datesAffichees, nomAffiche, POLICE_DATES, POLICE_NOM, tronquer } from './texte';

  let {
    placement,
    arbre,
    personneSelectionnee = null,
    unionSelectionnee = null,
    onclicpersonne,
    onclicunion,
    onclicfond,
  }: {
    placement: Placement;
    arbre: Arbre;
    personneSelectionnee?: string | null;
    unionSelectionnee?: string | null;
    onclicpersonne?: (id: string, x: number, y: number) => void;
    onclicunion?: (id: string) => void;
    onclicfond?: () => void;
  } = $props();

  let svg: SVGSVGElement;
  let transformation = $state('');
  let comportement: ZoomBehavior<SVGSVGElement, unknown>;
  let survol = $state<string | null>(null);

  const PADDING_TEXTE = 10;
  const personnes = $derived(new Map<string, Personne>(arbre.personnes.map((p) => [p.id, p])));

  /**
   * Mise en évidence d'une union (survol ou sélection de son point) : ses partenaires, ses enfants
   * et ses traits restent nets, le reste est atténué. Au repos, l'affichage est inchangé.
   */
  const evidence = $derived.by(() => {
    const uid = survol ?? unionSelectionnee;
    if (!uid) return null;
    const u = arbre.unions.find((x) => x.id === uid);
    if (!u) return null;
    return { union: uid, personnes: new Set<string>([...u.partenaires, ...u.enfants]) };
  });

  const chemin = (filtre: (unionId: string) => boolean) =>
    placement.segments
      .filter((s) => filtre(s.unionId))
      .map((s) => `M${s.x1} ${s.y1}H${s.x2}V${s.y2}`)
      .join('');
  /** Un seul chemin pour tous les traits : même couleur, même épaisseur, trait plein. */
  const cheminNormal = $derived(chemin((u) => u !== evidence?.union));
  const cheminEvidence = $derived(evidence ? chemin((u) => u === evidence.union) : '');

  export function ajuster() {
    if (!svg || !comportement) return;
    const { width, height } = svg.getBoundingClientRect();
    const b = placement.bornes;
    if (b.largeur <= 0 || b.hauteur <= 0 || width === 0) return;
    const k = Math.min(width / b.largeur, height / b.hauteur, 1.2);
    const t = zoomIdentity
      .translate((width - b.largeur * k) / 2 - b.x * k, (height - b.hauteur * k) / 2 - b.y * k)
      .scale(k);
    select(svg).call(comportement.transform, t);
  }

  /** Centre la vue sur le cadre d'une personne (recherche). */
  export function centrerSur(id: string, k?: number) {
    const c = placement.cadres.find((x) => x.id === id);
    if (!c || !svg || !comportement) return;
    const { width, height } = svg.getBoundingClientRect();
    const echelle = k ?? Math.max(0.8, Number(/scale\(([\d.]+)/.exec(transformation)?.[1] ?? 1));
    const t = zoomIdentity
      .translate(
        width / 2 - (c.x + placement.largeurCadre / 2) * echelle,
        height / 2 - (c.y + placement.hauteurCadre / 2) * echelle,
      )
      .scale(echelle);
    select(svg).call(comportement.transform, t);
  }

  onMount(() => {
    comportement = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', (e) => (transformation = e.transform.toString()));
    select(svg).call(comportement).on('dblclick.zoom', null);
    ajuster();
  });

  function clicCadre(e: MouseEvent, id: string) {
    e.stopPropagation();
    const r = svg.getBoundingClientRect();
    onclicpersonne?.(id, e.clientX - r.left, e.clientY - r.top);
  }
  function clavierCadre(e: KeyboardEvent, id: string) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const cible = (e.currentTarget as SVGGElement).getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    onclicpersonne?.(id, cible.left - r.left + 20, cible.bottom - r.top + 4);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg bind:this={svg} class="arbre" role="application" aria-label="Arbre généalogique" onclick={() => onclicfond?.()}>
  <g transform={transformation}>
    <path class="traits" class:attenue={evidence} d={cheminNormal} />
    {#if evidence}<path class="traits" d={cheminEvidence} />{/if}

    {#each placement.cadres as c (c.id)}
      {@const personne = personnes.get(c.id)!}
      {@const nom = nomAffiche(personne)}
      {@const dates = datesAffichees(personne)}
      <g
        class="cadre"
        class:attenue={evidence && !evidence.personnes.has(c.id)}
        class:selectionne={personneSelectionnee === c.id}
        transform="translate({c.x},{c.y})"
        role="button"
        tabindex="0"
        aria-label="{nom}{dates ? `, ${dates}` : ''}"
        onclick={(e) => clicCadre(e, c.id)}
        onkeydown={(e) => clavierCadre(e, c.id)}
      >
        <title>{nom}{dates ? `\n${dates}` : ''}</title>
        <rect width={placement.largeurCadre} height={placement.hauteurCadre} rx="6" />
        <text class="nom" x={PADDING_TEXTE} y="23">{tronquer(nom, placement.largeurCadre - 2 * PADDING_TEXTE, POLICE_NOM)}</text>
        {#if dates}
          <text class="dates" x={PADDING_TEXTE} y="42">{tronquer(dates, placement.largeurCadre - 2 * PADDING_TEXTE, POLICE_DATES)}</text>
        {/if}
      </g>
    {/each}

    {#each placement.points as p (p.unionId)}
      <g
        class="union"
        class:attenue={evidence && evidence.union !== p.unionId}
        role="button"
        tabindex="0"
        aria-label="Union"
        onpointerenter={() => (survol = p.unionId)}
        onpointerleave={() => (survol = null)}
        onfocus={() => (survol = p.unionId)}
        onblur={() => (survol = null)}
        onclick={(e) => {
          e.stopPropagation();
          onclicunion?.(p.unionId);
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onclicunion?.(p.unionId);
          }
        }}
      >
        <circle class="zone" cx={p.x} cy={p.y} r="11" />
        <circle class="point" cx={p.x} cy={p.y} r={unionSelectionnee === p.unionId ? 6 : 4.5} />
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
    user-select: none;
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
  .attenue {
    opacity: 0.2;
  }
  .cadre {
    cursor: pointer;
  }
  .cadre rect {
    fill: var(--cadre-fond);
    stroke: var(--cadre-bord);
    stroke-width: 1;
  }
  .cadre:hover rect {
    stroke: var(--texte-doux);
  }
  .cadre.selectionne rect {
    stroke: var(--accent);
    stroke-width: 2.5;
  }
  .cadre:focus {
    outline: none;
  }
  .cadre:focus-visible rect {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .nom {
    font: 600 13px 'Inter Balaina', sans-serif;
    fill: var(--texte);
  }
  .dates {
    font: 400 12px 'Inter Balaina', sans-serif;
    fill: var(--texte-doux);
  }
  .union {
    cursor: pointer;
  }
  .union:focus {
    outline: none;
  }
  .zone {
    fill: transparent;
  }
  .point {
    fill: var(--trait);
  }
  .union:hover .point,
  .union:focus-visible .point {
    fill: var(--texte);
  }
</style>
