import { cleTri } from './dates';
import type { Arbre, Personne, Union } from './types';

/**
 * Index de lecture calculé à partir d'un Arbre (jamais stocké dans le fichier).
 * Toutes les listes respectent l'ordre de création, pour un comportement déterministe.
 */
export interface IndexArbre {
  personnes: Map<string, Personne>;
  unions: Map<string, Union>;
  /** Rang de création d'une personne (position dans arbre.personnes). */
  rangPersonne: Map<string, number>;
  rangUnion: Map<string, number>;
  /** Union dont la personne est enfant. */
  unionParente: Map<string, string>;
  /** Unions où la personne est partenaire, dans l'ordre de création. */
  unionsDe: Map<string, string[]>;
}

export function indexer(arbre: Arbre): IndexArbre {
  const idx: IndexArbre = {
    personnes: new Map(),
    unions: new Map(),
    rangPersonne: new Map(),
    rangUnion: new Map(),
    unionParente: new Map(),
    unionsDe: new Map(),
  };
  arbre.personnes.forEach((p, i) => {
    idx.personnes.set(p.id, p);
    idx.rangPersonne.set(p.id, i);
    idx.unionsDe.set(p.id, []);
  });
  arbre.unions.forEach((u, i) => {
    idx.unions.set(u.id, u);
    idx.rangUnion.set(u.id, i);
    for (const p of u.partenaires) idx.unionsDe.get(p)?.push(u.id);
    for (const e of u.enfants) if (!idx.unionParente.has(e)) idx.unionParente.set(e, u.id);
  });
  return idx;
}

/** Parents (partenaires de l'union parente) d'une personne. */
export function parentsDe(idx: IndexArbre, personneId: string): string[] {
  const u = idx.unionParente.get(personneId);
  return u ? [...idx.unions.get(u)!.partenaires] : [];
}

/** L'autre partenaire d'une union, ou undefined (autre parent inconnu). */
export function autrePartenaire(union: Union, personneId: string): string | undefined {
  return union.partenaires.find((p) => p !== personneId);
}

/**
 * Clé chronologique d'une union : date de début, sinon naissance du premier enfant daté.
 * undefined si rien n'est connu.
 */
export function cleChronoUnion(idx: IndexArbre, union: Union): number | undefined {
  if (union.debut) return cleTri(union.debut);
  let min: number | undefined;
  for (const e of union.enfants) {
    const n = idx.personnes.get(e)?.naissance;
    if (n) {
      const k = cleTri(n);
      if (min === undefined || k < min) min = k;
    }
  }
  return min;
}

/**
 * Unions d'une personne dans l'ordre chronologique : unions datées (début, sinon naissance
 * du premier enfant) triées par date, puis unions sans aucune date, dans l'ordre de création.
 */
export function unionsChronologiques(idx: IndexArbre, personneId: string): string[] {
  const ids = idx.unionsDe.get(personneId) ?? [];
  const cles = ids.map((id) => ({
    id,
    cle: cleChronoUnion(idx, idx.unions.get(id)!) ?? Infinity,
    rang: idx.rangUnion.get(id)!,
  }));
  cles.sort((a, b) => (a.cle === b.cle ? 0 : a.cle < b.cle ? -1 : 1) || a.rang - b.rang);
  return cles.map((u) => u.id);
}

/**
 * Ordre d'affichage des enfants d'une union :
 * enfants datés triés par naissance (le tableau `enfants` départage les égalités),
 * puis enfants sans date, dans l'ordre manuel du tableau.
 */
export function enfantsOrdonnes(idx: IndexArbre, union: Union): string[] {
  const dates: { id: string; cle: number; rang: number }[] = [];
  const sansDate: string[] = [];
  union.enfants.forEach((id, rang) => {
    const n = idx.personnes.get(id)?.naissance;
    if (n) dates.push({ id, cle: cleTri(n), rang });
    else sansDate.push(id);
  });
  dates.sort((a, b) => a.cle - b.cle || a.rang - b.rang);
  return [...dates.map((d) => d.id), ...sansDate];
}

/** Vrai si `ascendantId` est un ascendant (strict) de `personneId`. */
export function estAscendant(idx: IndexArbre, ascendantId: string, personneId: string): boolean {
  const vus = new Set<string>();
  const pile = parentsDe(idx, personneId);
  while (pile.length > 0) {
    const p = pile.pop()!;
    if (p === ascendantId) return true;
    if (vus.has(p)) continue;
    vus.add(p);
    pile.push(...parentsDe(idx, p));
  }
  return false;
}
