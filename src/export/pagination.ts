/**
 * Mise en page de l'export PDF et de l'impression (fonctions pures).
 * Unités : le dessin est en px (unités SVG), le papier en mm.
 */

export const FORMATS_PAPIER = {
  A4: { largeur: 210, hauteur: 297, libelle: 'A4' },
  A3: { largeur: 297, hauteur: 420, libelle: 'A3' },
  A2: { largeur: 420, hauteur: 594, libelle: 'A2' },
  A1: { largeur: 594, hauteur: 841, libelle: 'A1' },
  A0: { largeur: 841, hauteur: 1189, libelle: 'A0' },
  Lettre: { largeur: 215.9, hauteur: 279.4, libelle: 'Lettre US' },
} as const;
export type FormatPapier = keyof typeof FORMATS_PAPIER;
export type Orientation = 'auto' | 'portrait' | 'paysage';
export type ModePages = 'une-page' | 'taille-reelle';

/** Taille réelle : 1 px = 1/96 de pouce, comme à l'écran au zoom 100 % (un cadre ≈ 45 mm de large). */
export const MM_PAR_PX = 25.4 / 96;
export const MARGE_MM = 10;

export interface OptionsPages {
  format: FormatPapier;
  orientation: Orientation;
  mode: ModePages;
}

export interface Page {
  /** Position de la page dans la grille (taille réelle). */
  ligne: number;
  colonne: number;
  /** Zone du dessin (en px, dans le repère du dessin) affichée sur cette page. */
  zone: { x: number; y: number; largeur: number; hauteur: number };
}

export interface MiseEnPage {
  papier: { largeur: number; hauteur: number };
  orientation: 'portrait' | 'paysage';
  /** mm par px du dessin. */
  echelle: number;
  colonnes: number;
  lignes: number;
  pages: Page[];
  /** Position (mm) et taille du dessin sur la page, pour le mode « une page ». */
  placement: { x: number; y: number; largeur: number; hauteur: number };
}

function papier(format: FormatPapier, orientation: 'portrait' | 'paysage') {
  const f = FORMATS_PAPIER[format];
  return orientation === 'portrait' ? { largeur: f.largeur, hauteur: f.hauteur } : { largeur: f.hauteur, hauteur: f.largeur };
}

function calculer(
  dessin: { x: number; y: number; largeur: number; hauteur: number },
  format: FormatPapier,
  orientation: 'portrait' | 'paysage',
  mode: ModePages,
): MiseEnPage {
  const p = papier(format, orientation);
  const utileL = p.largeur - 2 * MARGE_MM;
  const utileH = p.hauteur - 2 * MARGE_MM;
  if (mode === 'une-page') {
    // Réduit pour tenir sur la page, sans jamais agrandir au-delà de la taille réelle.
    const echelle = Math.min(utileL / dessin.largeur, utileH / dessin.hauteur, MM_PAR_PX);
    const l = dessin.largeur * echelle,
      h = dessin.hauteur * echelle;
    return {
      papier: p,
      orientation,
      echelle,
      colonnes: 1,
      lignes: 1,
      pages: [{ ligne: 0, colonne: 0, zone: { ...dessin } }],
      placement: { x: (p.largeur - l) / 2, y: (p.hauteur - h) / 2, largeur: l, hauteur: h },
    };
  }
  const echelle = MM_PAR_PX;
  const zoneL = utileL / echelle,
    zoneH = utileH / echelle;
  const colonnes = Math.max(1, Math.ceil(dessin.largeur / zoneL - 1e-9));
  const lignes = Math.max(1, Math.ceil(dessin.hauteur / zoneH - 1e-9));
  // Le dessin est centré dans la grille de pages pour équilibrer les marges.
  const x0 = dessin.x - (colonnes * zoneL - dessin.largeur) / 2;
  const y0 = dessin.y - (lignes * zoneH - dessin.hauteur) / 2;
  const pages: Page[] = [];
  for (let ligne = 0; ligne < lignes; ligne++)
    for (let colonne = 0; colonne < colonnes; colonne++)
      pages.push({ ligne, colonne, zone: { x: x0 + colonne * zoneL, y: y0 + ligne * zoneH, largeur: zoneL, hauteur: zoneH } });
  return {
    papier: p,
    orientation,
    echelle,
    colonnes,
    lignes,
    pages,
    placement: { x: MARGE_MM, y: MARGE_MM, largeur: utileL, hauteur: utileH },
  };
}

/**
 * Mise en page complète. En orientation automatique : la plus grande échelle pour « une page »,
 * le moins de pages pour « taille réelle » (à égalité : paysage, plus naturel pour un arbre).
 */
export function mettreEnPage(dessin: { x: number; y: number; largeur: number; hauteur: number }, o: OptionsPages): MiseEnPage {
  if (o.orientation !== 'auto') return calculer(dessin, o.format, o.orientation, o.mode);
  const paysage = calculer(dessin, o.format, 'paysage', o.mode);
  const portrait = calculer(dessin, o.format, 'portrait', o.mode);
  if (o.mode === 'une-page') return portrait.echelle > paysage.echelle + 1e-9 ? portrait : paysage;
  return portrait.pages.length < paysage.pages.length ? portrait : paysage;
}

// ---------- Images ----------

/** Limites des navigateurs pour un canvas (Chrome, Firefox, Safari). */
export const PIXELS_MAX_COTE = 16384;
export const PIXELS_MAX_AIRE = 120_000_000;

/**
 * Facteur d'agrandissement effectif d'une image : celui demandé, réduit si nécessaire
 * pour respecter les limites du navigateur.
 */
export function echelleImage(largeur: number, hauteur: number, demandee: number): { echelle: number; reduite: boolean } {
  const maxCote = PIXELS_MAX_COTE / Math.max(largeur, hauteur);
  const maxAire = Math.sqrt(PIXELS_MAX_AIRE / (largeur * hauteur));
  const echelle = Math.min(demandee, maxCote, maxAire);
  return { echelle, reduite: echelle < demandee - 1e-9 };
}
