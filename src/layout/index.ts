import { indexer } from '../model/index';
import type { Arbre } from '../model/types';
import { HAUTEUR_CADRE, LARGEUR_CADRE, MARGE_DESSIN } from './constantes';
import { construireStructure } from './groupes';
import { disposer } from './placement';
import { router } from './routage';
import type { Placement } from './types';

export type { Placement, Segment, CadrePlace, PointPlace } from './types';

/**
 * Calcule le placement complet de l'arbre. Fonction pure et déterministe :
 * le même arbre donne toujours exactement le même placement.
 */
export function calculerPlacement(arbre: Arbre): Placement {
  const idx = indexer(arbre);
  const structure = construireStructure(idx);
  const disposition = disposer(idx, structure);
  const { segments, points, yLigne } = router(structure, disposition);

  const cadres = arbre.personnes.map((p) => {
    const cle = `P:${p.id}`;
    const ligne = disposition.ligneDe.get(cle)!;
    return { id: p.id, x: disposition.x.get(cle)!, y: yLigne[ligne]!, ligne };
  });

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of cadres) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + LARGEUR_CADRE);
    maxY = Math.max(maxY, c.y + HAUTEUR_CADRE);
  }
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 0;
  }
  return {
    cadres,
    points: points.sort((a, b) => (a.unionId < b.unionId ? -1 : 1)),
    segments,
    bornes: {
      x: minX - MARGE_DESSIN,
      y: minY - MARGE_DESSIN,
      largeur: maxX - minX + 2 * MARGE_DESSIN,
      hauteur: maxY - minY + 2 * MARGE_DESSIN,
    },
    largeurCadre: LARGEUR_CADRE,
    hauteurCadre: HAUTEUR_CADRE,
    avertissements: structure.avertissements,
  };
}
