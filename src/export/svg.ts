import type { Placement } from '../layout/types';
import type { Arbre } from '../model/types';
import { datesAffichees, nomAffiche, POLICE_DATES, POLICE_NOM, tronquer } from '../ui/texte';

/**
 * SVG autonome de tout l'arbre pour les exports : fond blanc, rendu sobre, indépendant du thème.
 * Uniquement des attributs de présentation (pas de CSS de l'application), pour que le PDF,
 * les images et l'impression donnent exactement le même dessin.
 */

export const FAMILLE_EXPORT = 'Inter Balaina Export';
const COULEURS = { fond: '#ffffff', trait: '#3d3d3d', cadreFond: '#ffffff', cadreBord: '#8f8f8f', nom: '#111111', dates: '#4a4a4a' };
const PADDING_TEXTE = 10;

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (v: number) => Math.round(v * 100) / 100;

export interface OptionsSvg {
  /** Zone du dessin à montrer (par défaut : tout l'arbre). */
  zone?: { x: number; y: number; largeur: number; hauteur: number };
  /** Taille affichée (attributs width / height), par défaut celle de la zone en px. */
  largeur?: string;
  hauteur?: string;
  /** Polices intégrées (data URI) : nécessaire pour transformer le SVG en image. */
  policesIntegrees?: { regular: string; semibold: string };
}

export function construireSvg(placement: Placement, arbre: Arbre, options: OptionsSvg = {}): string {
  const b = options.zone ?? placement.bornes;
  const personnes = new Map(arbre.personnes.map((p) => [p.id, p]));
  const W = placement.largeurCadre,
    H = placement.hauteurCadre;
  const parties: string[] = [];

  parties.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(b.x)} ${n(b.y)} ${n(b.largeur)} ${n(b.hauteur)}" ` +
      `width="${options.largeur ?? n(b.largeur)}" height="${options.hauteur ?? n(b.hauteur)}">`,
  );
  if (options.policesIntegrees) {
    const { regular, semibold } = options.policesIntegrees;
    parties.push(
      `<style>@font-face{font-family:'${FAMILLE_EXPORT}';src:url(${regular}) format('truetype');font-weight:400}` +
        `@font-face{font-family:'${FAMILLE_EXPORT}';src:url(${semibold}) format('truetype');font-weight:700}</style>`,
    );
  }
  // fond blanc sur tout le dessin (et au-delà pour les pages découpées)
  const tout = placement.bornes;
  const fx = Math.min(b.x, tout.x),
    fy = Math.min(b.y, tout.y);
  const fl = Math.max(b.x + b.largeur, tout.x + tout.largeur) - fx,
    fh = Math.max(b.y + b.hauteur, tout.y + tout.hauteur) - fy;
  parties.push(`<rect x="${n(fx)}" y="${n(fy)}" width="${n(fl)}" height="${n(fh)}" fill="${COULEURS.fond}"/>`);

  const d = placement.segments.map((s) => `M${n(s.x1)} ${n(s.y1)}L${n(s.x2)} ${n(s.y2)}`).join('');
  if (d) {
    parties.push(
      `<path d="${d}" fill="none" stroke="${COULEURS.trait}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="butt"/>`,
    );
  }
  for (const p of placement.points) {
    parties.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="4.5" fill="${COULEURS.trait}"/>`);
  }
  for (const c of placement.cadres) {
    const p = personnes.get(c.id);
    if (!p) continue;
    const nom = tronquer(nomAffiche(p), W - 2 * PADDING_TEXTE, POLICE_NOM);
    const dates = tronquer(datesAffichees(p), W - 2 * PADDING_TEXTE, POLICE_DATES);
    parties.push(
      `<g transform="translate(${n(c.x)},${n(c.y)})">` +
        `<rect width="${W}" height="${H}" rx="6" ry="6" fill="${COULEURS.cadreFond}" stroke="${COULEURS.cadreBord}" stroke-width="1"/>` +
        `<text x="${PADDING_TEXTE}" y="23" font-family="${FAMILLE_EXPORT}" font-size="13" font-weight="bold" fill="${COULEURS.nom}">${echapper(nom)}</text>` +
        (dates
          ? `<text x="${PADDING_TEXTE}" y="42" font-family="${FAMILLE_EXPORT}" font-size="12" font-weight="normal" fill="${COULEURS.dates}">${echapper(dates)}</text>`
          : '') +
        `</g>`,
    );
  }
  parties.push('</svg>');
  return parties.join('');
}
