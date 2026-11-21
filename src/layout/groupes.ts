import { unionsChronologiques, type IndexArbre } from '../model/index';

/**
 * Étapes A, B et C du placement :
 *  A. groupes de ligne (personnes reliées par des unions → même ligne),
 *  B. générations (numéro de ligne de chaque groupe),
 *  C. linéarisation (ordre gauche-droite des personnes dans un groupe).
 */

export const clePersonne = (id: string) => `P:${id}`;
export const cleFantome = (unionId: string) => `F:${unionId}`;
export const cleRelais = (unionId: string, enfantId: string, ligne: number) => `R:${unionId}:${enfantId}:${ligne}`;

export interface Groupe {
  id: number;
  membres: string[];
  rangMin: number;
  ligne: number;
  /** Clés d'éléments (personnes et fantômes) de gauche à droite. */
  sequence: string[];
}

/**
 * Union telle que placée :
 *  - `porteur` : la personne d'où partent les traits (celle qui a le plus d'unions),
 *  - `autre` : clé de l'élément à l'autre bout (personne, ou fantôme si l'autre parent est inconnu).
 */
export interface UnionPlacee {
  id: string;
  ligne: number;
  porteur: string;
  autre: string;
  /** Partenaire hors du groupe (union « coupée » : partenaires sur des lignes différentes). */
  partenaireDistant?: string;
}

export interface Structure {
  groupes: Groupe[];
  groupeDe: Map<string, number>;
  unions: Map<string, UnionPlacee>;
  coupees: Set<string>;
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  trouver(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!;
      i = this.parent[i]!;
    }
    return i;
  }
  unir(a: number, b: number) {
    const ra = this.trouver(a),
      rb = this.trouver(b);
    // la plus petite racine gagne : résultat indépendant de l'ordre des appels
    if (ra < rb) this.parent[rb] = ra;
    else if (rb < ra) this.parent[ra] = rb;
  }
}

/** Groupe « porteur » d'une union : celui de son premier partenaire, sauf union coupée (géré plus tard). */
function construireGroupes(idx: IndexArbre, coupees: Set<string>) {
  const ids = [...idx.personnes.keys()];
  const uf = new UnionFind(ids.length);
  for (const u of idx.unions.values()) {
    if (u.partenaires.length === 2 && !coupees.has(u.id)) {
      uf.unir(idx.rangPersonne.get(u.partenaires[0])!, idx.rangPersonne.get(u.partenaires[1])!);
    }
  }
  const racineVersGroupe = new Map<number, number>();
  const groupeDe = new Map<string, number>();
  const membres: string[][] = [];
  ids.forEach((id, rang) => {
    const r = uf.trouver(rang);
    let g = racineVersGroupe.get(r);
    if (g === undefined) {
      g = membres.length;
      racineVersGroupe.set(r, g);
      membres.push([]);
    }
    membres[g]!.push(id);
    groupeDe.set(id, g);
  });
  return { groupeDe, membres };
}

/**
 * Tri topologique des groupes (arc : groupe des parents → groupe de l'enfant).
 * Renvoie l'ordre, ou les groupes restés dans un cycle.
 */
function trierGroupes(
  idx: IndexArbre,
  groupeDe: Map<string, number>,
  nbGroupes: number,
): { ordre: number[]; enfants: Set<number>[]; parents: Set<number>[]; cycle: number[] } {
  const enfants = Array.from({ length: nbGroupes }, () => new Set<number>());
  const parents = Array.from({ length: nbGroupes }, () => new Set<number>());
  for (const u of idx.unions.values()) {
    const sources = new Set(u.partenaires.map((p) => groupeDe.get(p)!));
    for (const e of u.enfants) {
      const ge = groupeDe.get(e)!;
      for (const gs of sources) {
        enfants[gs]!.add(ge);
        parents[ge]!.add(gs);
      }
    }
  }
  const degre = parents.map((s) => s.size);
  const file: number[] = [];
  degre.forEach((d, g) => d === 0 && file.push(g));
  const ordre: number[] = [];
  while (file.length > 0) {
    file.sort((a, b) => a - b);
    const g = file.shift()!;
    ordre.push(g);
    for (const e of [...enfants[g]!].sort((a, b) => a - b)) {
      degre[e]!--;
      if (degre[e] === 0) file.push(e);
    }
  }
  const cycle = degre.flatMap((d, g) => (d > 0 ? [g] : []));
  return { ordre, enfants, parents, cycle };
}

export function construireStructure(idx: IndexArbre): Structure & { avertissements: string[] } {
  const coupees = new Set<string>();
  const avertissements: string[] = [];

  // A + B : on coupe des unions tant que le graphe des groupes contient un cycle
  // (ex. union avec l'enfant de son autre partenaire). Termine : sans aucune union,
  // le graphe est celui de l'ascendance, sans cycle (vérifié par la validation).
  for (;;) {
    const { groupeDe, membres } = construireGroupes(idx, coupees);
    const tri = trierGroupes(idx, groupeDe, membres.length);
    if (tri.cycle.length > 0) {
      const candidate = unionACouper(idx, groupeDe, coupees, new Set(tri.cycle));
      if (candidate === undefined) throw new Error('Placement impossible : cycle sans union à couper');
      coupees.add(candidate);
      continue;
    }

    const ligne = calculerLignes(tri, membres.length);
    const groupes: Groupe[] = membres.map((m, id) => ({
      id,
      membres: m,
      rangMin: Math.min(...m.map((p) => idx.rangPersonne.get(p)!)),
      ligne: ligne[id]!,
      sequence: [],
    }));
    const unions = new Map<string, UnionPlacee>();
    for (const u of idx.unions.values()) {
      if (u.partenaires.length === 1) {
        const p = u.partenaires[0];
        unions.set(u.id, { id: u.id, ligne: ligne[groupeDe.get(p)!]!, porteur: p, autre: cleFantome(u.id) });
      } else if (coupees.has(u.id)) {
        const [a, b] = u.partenaires;
        const la = ligne[groupeDe.get(a)!]!,
          lb = ligne[groupeDe.get(b)!]!;
        const [haut, bas] = la <= lb ? [a, b] : [b, a];
        unions.set(u.id, {
          id: u.id,
          ligne: Math.min(la, lb),
          porteur: haut,
          autre: cleFantome(u.id),
          partenaireDistant: bas,
        });
        avertissements.push(
          `L'union entre ${nomsPartenaires(idx, u.id)} ne peut pas être dessinée sur une seule ligne (un des partenaires se retrouverait au-dessus de lui-même) : elle est reliée par un trait séparé.`,
        );
      }
    }
    const structure: Structure = { groupes, groupeDe, unions, coupees };
    const avertirBoucle = (uid: string) =>
      avertissements.push(
        `L'union entre ${nomsPartenaires(idx, uid)} ferme une boucle d'unions : elle est reliée par un trait séparé.`,
      );
    for (const g of groupes) g.sequence = lineariser(idx, structure, g, avertirBoucle);
    return { ...structure, avertissements };
  }
}

/**
 * Choisit l'union à couper pour briser un cycle du graphe des groupes :
 * on suit un cycle concret (parent → enfant d'un groupe à l'autre) et, dans chaque groupe traversé,
 * le chemin d'unions qui relie la personne d'entrée (l'enfant) à celle de sortie (le parent).
 * Parmi ces unions, la plus récente est coupée.
 */
function unionACouper(
  idx: IndexArbre,
  groupeDe: Map<string, number>,
  coupees: Set<string>,
  residuels: Set<number>,
): string | undefined {
  type Arc = { de: number; vers: number; parent: string; enfant: string };
  const entrants = new Map<number, Arc[]>();
  for (const u of idx.unions.values()) {
    for (const p of u.partenaires) {
      for (const e of u.enfants) {
        const arc = { de: groupeDe.get(p)!, vers: groupeDe.get(e)!, parent: p, enfant: e };
        if (!residuels.has(arc.de) || !residuels.has(arc.vers)) continue;
        entrants.set(arc.vers, [...(entrants.get(arc.vers) ?? []), arc]);
      }
    }
  }
  // Remonte les arcs entrants jusqu'à retomber sur un groupe déjà vu : c'est un cycle.
  let g = Math.min(...residuels);
  const vu = new Map<number, number>();
  const chemin: Arc[] = [];
  while (!vu.has(g)) {
    vu.set(g, chemin.length);
    const arc = entrants.get(g)![0]!;
    chemin.push(arc);
    g = arc.de;
  }
  const cycle = chemin.slice(vu.get(g)!).reverse(); // dans le sens parent → enfant

  // Graphe des unions ordinaires (partenaire ↔ partenaire)
  const voisins = new Map<string, { autre: string; union: string }[]>();
  for (const u of idx.unions.values()) {
    if (u.partenaires.length !== 2 || coupees.has(u.id)) continue;
    const [a, b] = u.partenaires;
    voisins.set(a, [...(voisins.get(a) ?? []), { autre: b, union: u.id }]);
    voisins.set(b, [...(voisins.get(b) ?? []), { autre: a, union: u.id }]);
  }
  const cheminUnions = (depart: string, arrivee: string): string[] => {
    const prec = new Map<string, { de: string; union: string } | null>([[depart, null]]);
    const file = [depart];
    while (file.length > 0) {
      const p = file.shift()!;
      if (p === arrivee) break;
      for (const v of voisins.get(p) ?? []) {
        if (prec.has(v.autre)) continue;
        prec.set(v.autre, { de: p, union: v.union });
        file.push(v.autre);
      }
    }
    const res: string[] = [];
    for (let p = arrivee; prec.get(p); p = prec.get(p)!.de) res.push(prec.get(p)!.union);
    return res;
  };
  let candidate: string | undefined;
  let rangMax = -1;
  for (let i = 0; i < cycle.length; i++) {
    const entree = cycle[i]!.enfant;
    const sortie = cycle[(i + 1) % cycle.length]!.parent;
    for (const uid of cheminUnions(entree, sortie)) {
      const r = idx.rangUnion.get(uid)!;
      if (r > rangMax) {
        rangMax = r;
        candidate = uid;
      }
    }
  }
  return candidate;
}

function nomsPartenaires(idx: IndexArbre, uid: string): string {
  return idx.unions
    .get(uid)!
    .partenaires.map((p) => {
      const x = idx.personnes.get(p)!;
      return `${x.prenoms} ${x.nom}`.trim() || '(sans nom)';
    })
    .join(' et ');
}

/** Étape B : plus long chemin depuis le haut, puis les groupes sans parents descendent au-dessus de leurs enfants. */
function calculerLignes(tri: ReturnType<typeof trierGroupes>, nb: number): number[] {
  const ligne = new Array<number>(nb).fill(0);
  for (const g of tri.ordre) {
    for (const p of tri.parents[g]!) ligne[g] = Math.max(ligne[g]!, ligne[p]! + 1);
  }
  for (const g of [...tri.ordre].reverse()) {
    if (tri.parents[g]!.size === 0 && tri.enfants[g]!.size > 0) {
      ligne[g] = Math.min(...[...tri.enfants[g]!].map((e) => ligne[e]!)) - 1;
    }
  }
  const min = Math.min(0, ...ligne);
  return ligne.map((l) => l - min);
}

/** Unions d'une personne qui se dessinent dans son groupe, dans l'ordre chronologique. */
function unionsDansGroupe(idx: IndexArbre, s: Structure, personneId: string): string[] {
  return unionsChronologiques(idx, personneId).filter((uid) => {
    const u = idx.unions.get(uid)!;
    if (u.partenaires.length === 2 && !s.coupees.has(uid)) return true; // union ordinaire du groupe
    return s.unions.get(uid)?.porteur === personneId; // fantôme (parent inconnu ou union coupée)
  });
}

/** Clé de l'élément à l'autre bout d'une union, vue depuis `personneId`. */
function autreBout(idx: IndexArbre, s: Structure, uid: string, personneId: string): string {
  const u = idx.unions.get(uid)!;
  if (u.partenaires.length === 1 || s.coupees.has(uid)) return cleFantome(uid);
  return clePersonne(u.partenaires[0] === personneId ? u.partenaires[1]! : u.partenaires[0]);
}

/**
 * Étape C : ordre gauche-droite des membres d'un groupe.
 * - 1 union : A ─•─ B ; 2 unions : un partenaire de chaque côté ;
 * - 3 unions et plus : tous les partenaires du même côté, dans l'ordre chronologique.
 * Les chaînes (A-B puis B-C) se prolongent vers l'extérieur.
 * Renseigne aussi `s.unions` pour les unions ordinaires du groupe (porteur / autre).
 */
function lineariser(idx: IndexArbre, s: Structure, g: Groupe, avertir: (uid: string) => void): string[] {
  const nbUnions = (p: string) => unionsDansGroupe(idx, s, p).length;
  // Racine : la personne qui a le plus d'unions (à égalité, la plus ancienne dans l'arbre).
  const racine = [...g.membres].sort(
    (a, b) => nbUnions(b) - nbUnions(a) || idx.rangPersonne.get(a)! - idx.rangPersonne.get(b)!,
  )[0]!;

  const visites = new Set<string>();
  const unionsVues = new Set<string>();

  const enregistrer = (uid: string, depuis: string) => {
    if (s.unions.has(uid)) return;
    const u = idx.unions.get(uid)!;
    const autre = u.partenaires[0] === depuis ? u.partenaires[1]! : u.partenaires[0];
    // Le porteur est celui qui a le plus d'unions ; à égalité, celui depuis lequel on déroule.
    const porteur = nbUnions(autre) > nbUnions(depuis) ? autre : depuis;
    const autreCle = clePersonne(porteur === depuis ? autre : depuis);
    s.unions.set(uid, { id: uid, ligne: g.ligne, porteur, autre: autreCle });
  };

  /** Éléments à ajouter pour l'union `uid` vue depuis `p` (déjà visité), du côté `cote`. */
  const morceau = (uid: string, p: string, cote: 'g' | 'd'): string[] => {
    unionsVues.add(uid);
    const bout = autreBout(idx, s, uid, p);
    if (bout.startsWith('F:')) return [bout];
    const autre = bout.slice(2);
    if (!visites.has(autre)) {
      enregistrer(uid, p);
      return derouler(autre, cote);
    }
    const memeCouple = [...unionsVues].some((v) => {
      const pv = s.unions.get(v);
      return v !== uid && pv && !pv.partenaireDistant && [pv.porteur, pv.autre.slice(2)].sort().join() === [p, autre].sort().join();
    });
    if (memeCouple) {
      enregistrer(uid, p); // couple uni deux fois : les deux unions partagent le même trait
      return [];
    }
    // Boucle d'unions (A-B, B-C, C-A…) : impossible sur une seule ligne sans croisement.
    // L'union qui ferme la boucle est reliée par un trait séparé, comme une union coupée.
    s.coupees.add(uid);
    s.unions.set(uid, { id: uid, ligne: g.ligne, porteur: p, autre: cleFantome(uid), partenaireDistant: autre });
    avertir(uid);
    return [cleFantome(uid)];
  };

  /** Déroule `p` et ses unions restantes, toutes du côté `cote`. Renvoie une liste gauche → droite. */
  function derouler(p: string, cote: 'g' | 'd'): string[] {
    visites.add(p);
    const morceaux: string[][] = [];
    for (const uid of unionsDansGroupe(idx, s, p)) {
      if (unionsVues.has(uid)) continue;
      morceaux.push(morceau(uid, p, cote));
    }
    if (cote === 'd') return [clePersonne(p), ...morceaux.flat()];
    return [...[...morceaux].reverse().flat(), clePersonne(p)];
  }

  const unionsRacine = unionsDansGroupe(idx, s, racine);
  let sequence: string[];
  if (unionsRacine.length === 2) {
    visites.add(racine);
    const gauche = morceau(unionsRacine[0]!, racine, 'g');
    const droite = morceau(unionsRacine[1]!, racine, 'd');
    sequence = [...gauche, clePersonne(racine), ...droite];
  } else {
    sequence = derouler(racine, 'd');
  }
  // Membres non atteints (ne devrait pas arriver : le groupe est connexe) : ajoutés à la fin.
  for (const m of g.membres) if (!visites.has(m)) sequence.push(...derouler(m, 'd'));
  return sequence;
}
