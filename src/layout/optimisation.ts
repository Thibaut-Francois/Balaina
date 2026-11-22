import { indexer } from '../model/index';
import type { Arbre } from '../model/types';
import { calculerPlacementDetaille } from './index';
import type { Placement, Segment } from './types';

/**
 * « Recalculer la disposition » : recherche un ordre de priorité des personnes qui réduit les croisements.
 *
 * Le placement normal est stable (l'ordre de création départage les familles) ; il peut donc laisser des
 * croisements qu'un autre ordre éviterait. Cette recherche explore d'autres ordres et garde le meilleur.
 * Elle est déterministe (graine fixe, nombre d'essais fonction de la taille de l'arbre).
 */

export interface Score {
  /** Croisements entre les traits de deux unions d'une même personne (à éviter absolument). */
  interdits: number;
  /** Tous les croisements entre traits d'unions différentes. */
  croisements: number;
  /** Longueur totale des traits (départage : un dessin plus compact). */
  longueur: number;
}

export function comparer(a: Score, b: Score): number {
  return a.interdits - b.interdits || a.croisements - b.croisements || a.longueur - b.longueur;
}

/** Compte les croisements d'un placement (segments horizontaux × verticaux, contacts aux extrémités exclus). */
export function evaluer(arbre: Arbre, placement: Placement): Score {
  const partenaires = new Map<string, readonly string[]>();
  for (const u of arbre.unions) partenaires.set(u.id, u.partenaires);
  /** Deux unions ayant un partenaire commun (hors couple uni deux fois, qui partage son trait). */
  const memePersonne = (a: string, b: string) => {
    const pa = partenaires.get(a),
      pb = partenaires.get(b);
    if (!pa || !pb) return false;
    if ([...pa].sort().join() === [...pb].sort().join()) return false;
    return pa.some((p) => pb.includes(p));
  };

  const horizontaux: Segment[] = [];
  const verticaux: Segment[] = [];
  let longueur = 0;
  for (const s of placement.segments) {
    longueur += Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
    if (s.y1 === s.y2) horizontaux.push(s);
    else if (s.x1 === s.x2) verticaux.push(s);
  }
  horizontaux.sort((a, b) => a.y1 - b.y1);
  const ys = horizontaux.map((h) => h.y1);
  const premierAuDessus = (y: number) => {
    let bas = 0,
      haut = ys.length;
    while (bas < haut) {
      const m = (bas + haut) >> 1;
      if (ys[m]! <= y) bas = m + 1;
      else haut = m;
    }
    return bas;
  };
  const e = 0.5;
  let croisements = 0,
    interdits = 0;
  for (const v of verticaux) {
    const y1 = Math.min(v.y1, v.y2),
      y2 = Math.max(v.y1, v.y2);
    for (let i = premierAuDessus(y1 + e); i < horizontaux.length && ys[i]! < y2 - e; i++) {
      const h = horizontaux[i]!;
      if (h.unionId === v.unionId) continue;
      const x1 = Math.min(h.x1, h.x2),
        x2 = Math.max(h.x1, h.x2);
      if (v.x1 <= x1 + e || v.x1 >= x2 - e) continue;
      croisements++;
      if (memePersonne(h.unionId, v.unionId)) interdits++;
    }
  }
  return { interdits, croisements, longueur: Math.round(longueur) };
}

/** Ordre de priorité actuel : celui de la disposition enregistrée, complété par l'ordre de création. */
export function ordreEffectif(arbre: Arbre): string[] {
  const vus = new Set<string>();
  const res: string[] = [];
  const ids = new Set(arbre.personnes.map((p) => p.id));
  for (const id of arbre.affichage?.ordre ?? []) if (ids.has(id) && !vus.has(id)) (vus.add(id), res.push(id));
  for (const p of arbre.personnes) if (!vus.has(p.id)) (vus.add(p.id), res.push(p.id));
  return res;
}

function generateur(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nombre d'essais : la recherche reste de l'ordre de quelques secondes même pour quelques centaines de personnes. */
export const essaisPour = (nbPersonnes: number) => Math.max(30, Math.min(400, Math.floor(50000 / (nbPersonnes + 20))));

/** Graine tirée de la disposition actuelle : un nouveau clic explore d'autres pistes, de façon reproductible. */
export function graineDe(arbre: Arbre): number {
  let h = 2166136261;
  for (const c of ordreEffectif(arbre).join(',')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export interface ResultatOptimisation {
  /** Disposition à enregistrer ; `null` si rien de mieux n'a été trouvé (garder l'arbre tel quel). */
  ordre: string[] | null;
  avant: Score;
  apres: Score;
  /** Vrai si la disposition trouvée est meilleure que l'actuelle. */
  ameliore: boolean;
}

/**
 * Recherche de la disposition. L'état exploré est l'ordre des groupes dans chaque ligne
 * (un groupe = des personnes reliées par des unions). Mouvements :
 *  1. balayages par barycentre (chaque groupe vers la position moyenne de ses parents et de ses enfants),
 *  2. échanges de groupes voisins et déplacements d'un groupe dans sa ligne.
 * Chaque essai est évalué sur le placement réel ; il n'est gardé que s'il améliore le score.
 */
export function optimiserDisposition(
  arbre: Arbre,
  options: { essais?: number; graine?: number; progression?: (fait: number, total: number) => void } = {},
): ResultatOptimisation {
  const essais = options.essais ?? essaisPour(arbre.personnes.length);
  const alea = generateur(options.graine ?? graineDe(arbre));
  const idx = indexer(arbre);

  const aplatir = (lignes: string[][][]) => lignes.flat(2);
  const noter = (a: Arbre) => {
    const d = calculerPlacementDetaille(a);
    return { score: evaluer(a, d.placement), placement: d.placement, lignes: d.groupesParLigne };
  };
  const avec = (ordre: string[]): Arbre => ({ ...arbre, affichage: { ordre } });

  const initial = noter(arbre);
  const avant = initial.score;
  // Point de départ : la disposition actuelle, figée telle quelle.
  let courant = noter(avec(aplatir(initial.lignes)));
  let fait = 1;
  if (comparer(courant.score, avant) > 0) courant = { ...initial };
  let meilleurOrdre = aplatir(courant.lignes);

  /**
   * Essaie un nouvel ordre des groupes. Avec `jusqua`, seules les lignes 0..jusqua sont fixées :
   * les lignes du dessous se réorganisent librement sous leurs parents (sinon elles resteraient figées).
   */
  const essayer = (lignes: string[][][], jusqua = lignes.length - 1) => {
    fait++;
    options.progression?.(fait, essais);
    const ordre = aplatir(lignes.slice(0, jusqua + 1));
    const r = noter(avec(ordre));
    if (comparer(r.score, courant.score) >= 0) return false;
    // On garde la disposition obtenue entièrement figée : c'est elle qui sera enregistrée,
    // et elle doit donner exactement ce score.
    const fige = aplatir(r.lignes);
    const rf = noter(avec(fige));
    if (comparer(rf.score, courant.score) >= 0) return false;
    courant = rf;
    meilleurOrdre = fige;
    return true;
  };

  // Voisins de chaque personne dans les autres lignes : parents et enfants.
  const voisins = new Map<string, string[]>();
  for (const p of arbre.personnes) {
    const v: string[] = [];
    const up = idx.unionParente.get(p.id);
    if (up) v.push(...idx.unions.get(up)!.partenaires);
    for (const u of idx.unionsDe.get(p.id) ?? []) v.push(...idx.unions.get(u)!.enfants);
    voisins.set(p.id, v);
  }

  // 0. Familles rangées selon la position moyenne de toute leur descendance (vue d'ensemble).
  const descendance = (g: string[]) => {
    const vus = new Set<string>();
    const pile = [...g];
    while (pile.length) {
      const p = pile.pop()!;
      for (const u of idx.unionsDe.get(p) ?? [])
        for (const e of idx.unions.get(u)!.enfants) if (!vus.has(e)) (vus.add(e), pile.push(e));
    }
    return [...vus];
  };
  for (let l = 0; l < courant.lignes.length && fait < essais; l++) {
    const groupes = courant.lignes[l]!;
    if (groupes.length < 2) continue;
    const x = new Map(courant.placement.cadres.map((c) => [c.id, c.x]));
    const cle = new Map(
      groupes.map((g) => {
        const d = descendance(g);
        const ids = d.length > 0 ? d : g;
        return [g, ids.reduce((s2, id) => s2 + x.get(id)!, 0) / ids.length];
      }),
    );
    const position = new Map(groupes.map((g, i) => [g, i]));
    const tri = [...groupes].sort((a, b) => cle.get(a)! - cle.get(b)! || position.get(a)! - position.get(b)!);
    if (!tri.every((g, i) => g === groupes[i])) essayer(courant.lignes.map((ligne, i) => (i === l ? tri : ligne)), l);
  }

  // 1. Balayages par barycentre, alternativement vers le bas et vers le haut.
  for (let balayage = 0; balayage < 4 && fait < essais; balayage++) {
    let ameliore = false;
    const nb = courant.lignes.length;
    for (let k = 0; k < nb && fait < essais; k++) {
      const l = balayage % 2 === 0 ? k : nb - 1 - k;
      const groupes = courant.lignes[l]!;
      if (groupes.length < 2) continue;
      const x = new Map(courant.placement.cadres.map((c) => [c.id, c.x]));
      const position = new Map(groupes.map((g, i) => [g, i]));
      const cle = (g: string[]) => {
        const vs = g.flatMap((id) => voisins.get(id)!).filter((v) => !g.includes(v));
        if (vs.length === 0) return g.reduce((s2, id) => s2 + x.get(id)!, 0) / g.length;
        return vs.reduce((s2, v) => s2 + x.get(v)!, 0) / vs.length;
      };
      const tri = [...groupes].sort((a, b) => cle(a) - cle(b) || position.get(a)! - position.get(b)!);
      if (tri.every((g, i) => g === groupes[i])) continue;
      const lignes = courant.lignes.map((ligne, i) => (i === l ? tri : ligne));
      // vers le bas : la descendance suit ; vers le haut : les parents s'alignent sur des enfants fixés
      if (essayer(lignes, balayage % 2 === 0 ? l : lignes.length - 1)) ameliore = true;
    }
    if (!ameliore && balayage > 0) break;
  }

  // 2. Recherche locale : échanger deux groupes voisins, ou déplacer un groupe dans sa ligne.
  while (fait < essais && courant.score.croisements > 0) {
    const lignesMulti = courant.lignes.map((g, i) => (g.length >= 2 ? i : -1)).filter((i) => i >= 0);
    if (lignesMulti.length === 0) break;
    const l = lignesMulti[Math.floor(alea() * lignesMulti.length)]!;
    const groupes = [...courant.lignes[l]!];
    const i = Math.floor(alea() * groupes.length);
    if (alea() < 0.6) {
      const j = i + (alea() < 0.5 ? -1 : 1);
      if (j < 0 || j >= groupes.length) continue;
      [groupes[i], groupes[j]] = [groupes[j]!, groupes[i]!];
    } else {
      const [g] = groupes.splice(i, 1);
      groupes.splice(Math.floor(alea() * (groupes.length + 1)), 0, g!);
    }
    const lignes = courant.lignes.map((ligne, k) => (k === l ? groupes : ligne));
    essayer(lignes, alea() < 0.5 ? l : lignes.length - 1);
  }
  options.progression?.(essais, essais);
  const ameliore = comparer(courant.score, avant) < 0;
  return { ordre: ameliore ? meilleurOrdre : null, avant, apres: ameliore ? courant.score : avant, ameliore };
}
