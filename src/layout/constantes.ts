/** Dimensions et espacements du placement (en unités SVG ≈ pixels à zoom 1). */

export const LARGEUR_CADRE = 170;
export const HAUTEUR_CADRE = 56;

/** Écart entre deux partenaires d'une même ligne (place pour le point d'union). */
export const ECART_PARTENAIRES = 48;
/** Écart entre frères et sœurs d'une même union. */
export const ECART_FRATRIE = 28;
/** Écart entre demi-fratries ou familles différentes : nettement plus large. */
export const ECART_FAMILLES = 84;
/** Écart autour d'un relais (passage d'un trait de filiation à travers une ligne). */
export const ECART_RELAIS = 20;
/** Distance minimale entre un point d'union et le bord d'un cadre. */
export const MARGE_POINT = 10;

/** Couloirs au-dessus des cadres (unions vers des partenaires éloignés). */
export const ARCHE_BASE = 16;
export const ARCHE_PAS = 10;
/** Décalage des sorties des arches sur le haut du cadre. */
export const SORTIE_BORD = 14;
export const SORTIE_PAS = 10;

/** Couloirs entre deux lignes (barres de fratrie). */
export const COULOIR_BASE = 22;
export const COULOIR_PAS = 10;
export const COULOIR_APRES = 22;
export const ECART_LIGNES_MIN = 64;

export const RAYON_POINT = 4.5;
export const MARGE_DESSIN = 40;

/** Nombre d'allers-retours de l'ajustement horizontal. */
export const ITERATIONS = 10;
