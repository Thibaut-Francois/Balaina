import { indexer, type IndexArbre } from '../model/index';
import type { Arbre } from '../model/types';
import { HAUTEUR_CADRE, LARGEUR_CADRE, MARGE_DESSIN } from './constantes';
import { construireStructure } from './groupes';
import { disposer } from './placement';
import { router } from './routage';
import type { Placement } from './types';

export type { Placement, Segment, CadrePlace, PointPlace } from './types';

/**
 * Disposition recalculée (`arbre.affichage.ordre`) :
 *  - fixe l'ordre des groupes dans chaque ligne (groupes dont un membre figure dans la liste) ;
 *  - remplace l'ordre de création pour les départages (seul usage de `rangPersonne`).
 * Les personnes absentes de la liste (ajoutées depuis) passent après, et se placent près de leurs parents.
 */
function appliquerOrdreAffichage(idx: IndexArbre, arbre: Arbre): Map<string, number> | undefined {
  if (!arbre.affichage) return undefined;
  const rang = new Map<string, number>();
  for (const id of arbre.affichage.ordre) if (idx.personnes.has(id) && !rang.has(id)) rang.set(id, rang.size);
  const listees = new Map(rang);
  const decalage = rang.size;
  arbre.personnes.forEach((p, i) => {
    if (!rang.has(p.id)) rang.set(p.id, decalage + i);
  });
  idx.rangPersonne = rang;
  return listees;
}

/**
 * Calcule le placement complet de l'arbre. Fonction pure et déterministe :
 * le même arbre donne toujours exactement le même placement.
 */
export function calculerPlacement(arbre: Arbre): Placement {
  return calculerPlacementDetaille(arbre).placement;
}

/**
 * Placement, plus la composition de chaque ligne : les groupes (personnes reliées par des unions),
 * de gauche à droite. Sert à « Recalculer la disposition ».
 */
export function calculerPlacementDetaille(arbre: Arbre): { placement: Placement; groupesParLigne: string[][][] } {
  const idx = indexer(arbre);
  const ordreAffichage = appliquerOrdreAffichage(idx, arbre);
  const structure = construireStructure(idx);
  const disposition = disposer(idx, structure, ordreAffichage);

  const groupesParLigne = disposition.lignes.map((ligne) => {
    const res: string[][] = [];
    let groupePrecedent = -1;
    for (const c of ligne) {
      if (!c.startsWith('P:')) continue;
      const id = c.slice(2);
      const g = structure.groupeDe.get(id)!;
      if (g !== groupePrecedent) res.push([]);
      res[res.length - 1]!.push(id);
      groupePrecedent = g;
    }
    return res;
  });
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
  const placement: Placement = {
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
  return { placement, groupesParLigne };
}
