import { enfantsOrdonnes, unionsChronologiques, type IndexArbre } from '../model/index';
import {
  ECART_FAMILLES,
  ECART_FRATRIE,
  ECART_PARTENAIRES,
  ECART_RELAIS,
  ITERATIONS,
  LARGEUR_CADRE,
  MARGE_POINT,
} from './constantes';
import { clePersonne, cleRelais, type Structure, type UnionPlacee } from './groupes';

/**
 * Étapes D et E : ordre des éléments dans chaque ligne, puis coordonnées x.
 * Éléments d'une ligne : personnes (« P:id »), fantômes d'union à parent inconnu (« F:union »),
 * relais de filiation qui traversent une ligne intermédiaire (« R:union:enfant:ligne »).
 */

export interface Relais {
  cle: string;
  union: string;
  enfant: string;
  ligne: number;
  /** Élément au-dessus : `null` = le point de l'union. */
  precedent: string | null;
  suivant: string;
}

export interface Disposition {
  lignes: string[][];
  x: Map<string, number>;
  ligneDe: Map<string, number>;
  relais: Map<string, Relais>;
  /** Éléments de la ligne juste sous l'union qui descendent d'elle (enfants et relais). */
  dessous: Map<string, string[]>;
  /** Position du point de chaque union placée. */
  pointX: Map<string, number>;
}

export const largeur = (cle: string) => (cle.startsWith('P:') ? LARGEUR_CADRE : 0);

/** Les deux éléments consécutifs qui encadrent le point d'une union. */
export function encadrement(u: UnionPlacee, rang: Map<string, number>, ligne: string[]) {
  const i = rang.get(clePersonne(u.porteur))!;
  const j = rang.get(u.autre)!;
  if (Math.abs(i - j) === 1) return { gauche: ligne[Math.min(i, j)]!, droite: ligne[Math.max(i, j)]!, arche: false, porteurAGauche: i < j };
  // Arche : le point se place juste à côté de l'autre partenaire, côté porteur.
  if (i < j) return { gauche: ligne[j - 1]!, droite: ligne[j]!, arche: true, porteurAGauche: true };
  return { gauche: ligne[j]!, droite: ligne[j + 1]!, arche: true, porteurAGauche: false };
}

export function disposer(idx: IndexArbre, s: Structure): Disposition {
  const nbLignes = Math.max(0, ...s.groupes.map((g) => g.ligne + 1));
  const ligneDe = new Map<string, number>();
  for (const g of s.groupes) for (const c of g.sequence) ligneDe.set(c, g.ligne);

  // ---- Relais pour les filiations qui sautent des lignes ----
  const relais = new Map<string, Relais>();
  const relaisParLigne: Relais[][] = Array.from({ length: nbLignes }, () => []);
  const ordreEnfant = new Map<string, number>(); // position de l'enfant dans sa fratrie
  const enfantsDe = new Map<string, string[]>();
  for (const u of idx.unions.values()) {
    const ordre = enfantsOrdonnes(idx, u);
    enfantsDe.set(u.id, ordre);
    ordre.forEach((e, i) => ordreEnfant.set(e, i));
  }
  const filiationsLongues: { union: string; cible: string; ligneCible: number }[] = [];
  for (const u of s.unions.values()) {
    for (const e of enfantsDe.get(u.id)!) filiationsLongues.push({ union: u.id, cible: e, ligneCible: ligneDe.get(clePersonne(e))! });
    if (u.partenaireDistant) {
      filiationsLongues.push({ union: u.id, cible: u.partenaireDistant, ligneCible: ligneDe.get(clePersonne(u.partenaireDistant))! });
    }
  }
  for (const { union, cible, ligneCible } of filiationsLongues) {
    const lu = s.unions.get(union)!.ligne;
    let precedent: string | null = null;
    for (let l = lu + 1; l < ligneCible; l++) {
      const cle = cleRelais(union, cible, l);
      const r: Relais = {
        cle,
        union,
        enfant: cible,
        ligne: l,
        precedent,
        suivant: l + 1 === ligneCible ? clePersonne(cible) : cleRelais(union, cible, l + 1),
      };
      relais.set(cle, r);
      relaisParLigne[l]!.push(r);
      ligneDe.set(cle, l);
      precedent = cle;
    }
  }

  // ---- Unions placées (porteur + autre) par ligne ----
  const unionsParLigne: UnionPlacee[][] = Array.from({ length: nbLignes }, () => []);
  for (const u of s.unions.values()) unionsParLigne[u.ligne]!.push(u);
  // Union qu'il faut rejoindre au-dessus de chaque élément.
  const parentDe = (cle: string): { union: string; rangEnfant: number } | undefined => {
    if (cle.startsWith('R:')) {
      const r = relais.get(cle)!;
      return { union: r.union, rangEnfant: ordreEnfant.get(r.enfant) ?? 0 };
    }
    if (!cle.startsWith('P:')) return undefined;
    const id = cle.slice(2);
    const u = idx.unionParente.get(id);
    if (u) return { union: u, rangEnfant: ordreEnfant.get(id)! };
    // partenaire distant d'une union coupée : rattaché à cette union
    for (const up of s.unions.values()) if (up.partenaireDistant === id) return { union: up.id, rangEnfant: 1e6 };
    return undefined;
  };
  /** Élément situé juste au-dessus (ligne précédente) dans la chaîne vers l'union, ou null si c'est le point. */
  const ancre = (cle: string): string | null | undefined => {
    const p = parentDe(cle);
    if (!p) return undefined;
    const lu = s.unions.get(p.union)!.ligne;
    const l = ligneDe.get(cle)!;
    if (l <= lu) return undefined; // partenaire distant sur la même ligne : pas d'ancre au-dessus
    if (l - 1 === lu) return null;
    const enfant = cle.startsWith('R:') ? relais.get(cle)!.enfant : cle.slice(2);
    return cleRelais(p.union, enfant, l - 1);
  };

  const groupeParCle = new Map<string, number>();
  for (const g of s.groupes) for (const c of g.sequence) groupeParCle.set(c, g.id);
  const unionsParentesDuGroupe = s.groupes.map((g) => {
    const set = new Set<string>();
    for (const c of g.sequence) {
      const p = parentDe(c);
      if (p) set.add(p.union);
    }
    return set;
  });
  const ecart = (a: string, b: string): number => {
    if (a.startsWith('R:') || b.startsWith('R:')) return ECART_RELAIS;
    const ga = groupeParCle.get(a)!,
      gb = groupeParCle.get(b)!;
    if (ga === gb) return ECART_PARTENAIRES;
    const pa = unionsParentesDuGroupe[ga]!;
    for (const u of unionsParentesDuGroupe[gb]!) if (pa.has(u)) return ECART_FRATRIE;
    return ECART_FAMILLES;
  };

  // ---- Étape D : ordre des lignes, de haut en bas (barycentres) ----
  const lignes: string[][] = [];
  const x = new Map<string, number>();
  const pointX = new Map<string, number>();
  const centre = (c: string) => x.get(c)! + largeur(c) / 2;
  const rangs: Map<string, number>[] = [];

  const calculerPoints = (l: number) => {
    const ligne = lignes[l]!;
    // Plusieurs unions peuvent partager le même espace (ex. un couple qui s'est uni deux fois) :
    // l'espace est alors partagé en parts égales, dans l'ordre chronologique.
    const parEspace = new Map<string, { u: UnionPlacee; gauche: string; droite: string }[]>();
    for (const u of unionsParLigne[l]!) {
      const e = encadrement(u, rangs[l]!, ligne);
      const cle = `${e.gauche}|${e.droite}`;
      parEspace.set(cle, [...(parEspace.get(cle) ?? []), { u, gauche: e.gauche, droite: e.droite }]);
    }
    for (const liste of parEspace.values()) {
      const { gauche, droite } = liste[0]!;
      const gaucheBord = x.get(gauche)! + largeur(gauche);
      const droiteBord = x.get(droite)!;
      liste.sort((a, b) => rangChrono(a.u.id) - rangChrono(b.u.id));
      const part = (droiteBord - gaucheBord) / liste.length;
      liste.forEach(({ u }, k) => {
        const g = gaucheBord + k * part,
          d = g + part;
        let px = (g + d) / 2;
        const dessous = dessousDe.get(u.id);
        if (dessous && dessous.length > 0 && lignes[l + 1] && x.has(dessous[0]!)) px = centreBloc(dessous);
        const min = g + MARGE_POINT,
          max = d - MARGE_POINT;
        pointX.set(u.id, min > max ? (g + d) / 2 : Math.min(max, Math.max(min, px)));
      });
    }
  };
  const rangChrono = (uid: string) => {
    const u = idx.unions.get(uid)!;
    return unionsChronologiques(idx, u.partenaires[0]).indexOf(uid);
  };
  const centreBloc = (cles: string[]) => {
    let min = Infinity,
      max = -Infinity;
    for (const c of cles) {
      min = Math.min(min, x.get(c)!);
      max = Math.max(max, x.get(c)! + largeur(c));
    }
    return (min + max) / 2;
  };
  const dessousDe = new Map<string, string[]>();

  const positionAncre = (cle: string): number | undefined => {
    const a = ancre(cle);
    if (a === undefined) return undefined;
    const p = parentDe(cle)!;
    if (a === null) return (pointX.get(p.union) ?? 0) + p.rangEnfant * 1e-3;
    return x.has(a) ? centre(a) : undefined;
  };

  // Unions avec enfants, par groupe de ligne (pour compter les croisements interdits).
  const unionsAvecEnfantsDuGroupe = new Map<number, string[]>();
  for (const u of s.unions.values()) {
    if (idx.unions.get(u.id)!.enfants.length === 0) continue;
    const g = s.groupeDe.get(u.porteur)!;
    unionsAvecEnfantsDuGroupe.set(g, [...(unionsAvecEnfantsDuGroupe.get(g) ?? []), u.id]);
  }
  /**
   * Nombre d'autres unions de la même famille (même groupe de ligne) dont le point se trouve entre
   * l'ancre `depuis` d'un enfant de `unionId` et la position `vers` où cet enfant serait rangé.
   */
  const unionsTraversees = (unionId: string, depuis: number, vers: number): number => {
    const g = s.groupeDe.get(s.unions.get(unionId)!.porteur)!;
    const [a, b] = depuis < vers ? [depuis, vers] : [vers, depuis];
    let n = 0;
    for (const v of unionsAvecEnfantsDuGroupe.get(g) ?? []) {
      if (v === unionId) continue;
      const pv = pointX.get(v);
      if (pv !== undefined && pv > a + 1e-6 && pv < b - 1e-6) n++;
    }
    return n;
  };

  const sequenceBase = new Map(s.groupes.map((g) => [g.id, g.sequence]));
  const inverse = new Map<number, boolean>();
  /** Membres rangés sous une autre famille que celle de leurs parents (reliés par un trait plus long). */
  const etrangers = new Set<string>();

  /** Ordre de toutes les lignes, de haut en bas. `forcees` impose l'orientation de certains groupes. */
  const ordonner = (forcees: Map<number, boolean>) => {
    lignes.length = 0;
    rangs.length = 0;
    x.clear();
    pointX.clear();
    etrangers.clear();
    for (let l = 0; l < nbLignes; l++) {
      type Unite = { cles: string[]; cleTri: number; rang: number };
      const unites: Unite[] = [];
      for (const g of s.groupes) {
        if (g.ligne !== l) continue;
        const base = sequenceBase.get(g.id)!;
        let inv = forcees.get(g.id);
        if (inv === undefined) {
          // Orientation : on retourne le groupe si cela aligne mieux les membres sur leurs parents.
          inv = false;
          const connus = base.flatMap((c, i) => {
            const a = positionAncre(c);
            return a === undefined ? [] : [{ a, i }];
          });
          if (connus.length >= 2) {
            const ma = connus.reduce((s2, c) => s2 + c.a, 0) / connus.length;
            const mi = connus.reduce((s2, c) => s2 + c.i, 0) / connus.length;
            const cov = connus.reduce((s2, c) => s2 + (c.a - ma) * (c.i - mi), 0);
            inv = cov < -1e-9;
          }
        }
        inverse.set(g.id, inv);
        const seq = inv ? [...base].reverse() : base;
        // Le groupe se range sous la famille d'un seul de ses membres, le « principal » : les fratries
        // de deux unions d'une même personne ne peuvent ainsi pas s'entremêler. Priorité aux membres
        // dont un parent a plusieurs unions (là où les croisements sont interdits), puis au premier
        // entré dans l'arbre. Les autres membres sont reliés à leurs parents par des traits plus longs.
        // Le choix minimise d'abord les croisements interdits : un membre rangé loin de ses parents
        // fait passer le trait de leur union au-dessus des autres unions de leur famille.
        const candidats = seq.flatMap((c) => {
          const an = positionAncre(c);
          return an === undefined ? [] : [{ c, a: an, u: parentDe(c)!.union }];
        });
        let principal: { a: number; cout: number; prio: number; rang: number; cle: string } | undefined;
        for (const { c, a: an } of candidats) {
          let cout = 0;
          for (const autre of candidats) {
            if (autre.c === c || autre.u === parentDe(c)!.union) continue;
            cout += unionsTraversees(autre.u, autre.a, an);
          }
          const rang = c.startsWith('P:') ? idx.rangPersonne.get(c.slice(2))! : Infinity;
          const pu = parentDe(c);
          const multi = pu ? idx.unions.get(pu.union)!.partenaires.some((p) => idx.unionsDe.get(p)!.length > 1) : false;
          const prio = multi ? 0 : 1;
          if (
            !principal ||
            cout < principal.cout ||
            (cout === principal.cout && (prio < principal.prio || (prio === principal.prio && rang < principal.rang)))
          )
            principal = { a: an, cout, prio, rang, cle: c };
        }
        if (principal) {
          const up = parentDe(principal.cle)!.union;
          for (const c of seq) if (parentDe(c) && parentDe(c)!.union !== up) etrangers.add(c);
        }
        unites.push({ cles: seq, cleTri: principal?.a ?? Infinity, rang: g.rangMin });
        g.sequence = seq;
      }
      for (const r of relaisParLigne[l]!) {
        unites.push({ cles: [r.cle], cleTri: positionAncre(r.cle) ?? Infinity, rang: idx.rangPersonne.get(r.enfant) ?? 0 });
      }
      unites.sort(
        (a, b) =>
          (a.cleTri === b.cleTri ? 0 : a.cleTri < b.cleTri ? -1 : 1) || a.rang - b.rang || (a.cles[0]! < b.cles[0]! ? -1 : 1),
      );
      const ligne = unites.flatMap((u) => u.cles);
      lignes.push(ligne);
      rangs.push(new Map(ligne.map((c, i) => [c, i])));
      // placement compact provisoire
      let cur = 0;
      ligne.forEach((c, i) => {
        if (i > 0) cur += largeur(ligne[i - 1]!) + ecart(ligne[i - 1]!, c);
        x.set(c, cur);
      });
      calculerPoints(l);
    }
    // éléments directement sous chaque union
    dessousDe.clear();
    for (const u of s.unions.values()) {
      const sous = lignes[u.ligne + 1]?.filter((c) => {
        const p = parentDe(c);
        return p?.union === u.id && ancre(c) === null;
      });
      dessousDe.set(u.id, sous ?? []);
    }
  };

  /**
   * Passe ascendante : pour chaque groupe dont plusieurs unions ont des enfants, choisit l'orientation
   * qui évite qu'un enfant rangé sous une autre famille ne fasse passer le trait de son union
   * par-dessus une autre union de la même personne.
   */
  const orientationsParLesEnfants = (): Map<number, boolean> => {
    const forcees = new Map<number, boolean>();
    for (const g of s.groupes) {
      const membres = new Set(g.membres);
      const unionsG = unionsParLigne[g.ligne]!.filter((u) => membres.has(u.porteur) && dessousDe.get(u.id)!.length > 0);
      if (unionsG.length < 2) continue;
      const gL = x.get(g.sequence[0]!)!;
      const gR = x.get(g.sequence[g.sequence.length - 1]!)! + largeur(g.sequence[g.sequence.length - 1]!);
      const cout = (miroir: boolean) => {
        const pos = (u: UnionPlacee) => (miroir ? gL + gR - pointX.get(u.id)! : pointX.get(u.id)!);
        let n = 0;
        for (const u of unionsG) {
          for (const c of dessousDe.get(u.id)!) {
            if (!etrangers.has(c)) continue;
            const a = pos(u),
              b = centre(c);
            for (const v of unionsG) {
              if (v === u) continue;
              const pv = pos(v);
              if (pv > Math.min(a, b) && pv < Math.max(a, b)) n++;
            }
          }
        }
        return n;
      };
      const actuel = cout(false),
        retourne = cout(true);
      if (actuel === 0 && retourne === 0) continue;
      forcees.set(g.id, retourne < actuel ? !inverse.get(g.id) : inverse.get(g.id)!);
    }
    return forcees;
  };

  ordonner(new Map());
  for (let passe = 0; passe < 2; passe++) {
    const forcees = orientationsParLesEnfants();
    if (forcees.size === 0) break;
    ordonner(forcees);
  }

  // ---- Étape E : coordonnées x par ajustements successifs (moindres carrés sous contraintes d'écart) ----
  const separations = lignes.map((ligne) =>
    ligne.slice(0, -1).map((c, i) => largeur(c) + ecart(c, ligne[i + 1]!)),
  );
  const resoudre = (l: number, cibles: number[], poids: number[]) => {
    const ligne = lignes[l]!;
    const res = isotonique(cibles, poids, separations[l]!);
    ligne.forEach((c, i) => x.set(c, res[i]!));
  };

  /** Fait suivre les éléments sans cible le déplacement moyen de leur groupe. */
  const ciblesParGroupe = (l: number, deltas: Map<string, number[]>, rigide: boolean) => {
    const ligne = lignes[l]!;
    const cibles: number[] = [],
      poids: number[] = [];
    const deplacementGroupe = new Map<number, { somme: number; n: number }>();
    for (const c of ligne) {
      const g = groupeParCle.get(c);
      const d = deltas.get(c);
      if (g === undefined || !d) continue;
      const acc = deplacementGroupe.get(g) ?? { somme: 0, n: 0 };
      acc.somme += d.reduce((a, b) => a + b, 0) / d.length;
      acc.n++;
      deplacementGroupe.set(g, acc);
    }
    for (const c of ligne) {
      const g = groupeParCle.get(c);
      const d = deltas.get(c);
      const acc = g !== undefined ? deplacementGroupe.get(g) : undefined;
      let delta: number;
      let w: number;
      if (d && !(rigide && acc)) {
        delta = d.reduce((a, b) => a + b, 0) / d.length;
        w = d.length;
      } else if (acc) {
        delta = acc.somme / acc.n;
        w = d ? d.length : 0.5;
      } else {
        delta = 0;
        w = 0.1;
      }
      cibles.push(x.get(c)! + delta);
      poids.push(w);
    }
    return { cibles, poids };
  };

  const passeDescendante = (l: number) => {
    const deltas = new Map<string, number[]>();
    const ajouter = (c: string, d: number) => {
      const t = deltas.get(c) ?? [];
      t.push(d);
      deltas.set(c, t);
    };
    for (const u of unionsParLigne[l - 1]!) {
      const sous = dessousDe.get(u.id)!;
      if (sous.length === 0) continue;
      const d = pointX.get(u.id)! - centreBloc(sous);
      for (const c of sous) ajouter(c, d);
    }
    for (const c of lignes[l]!) {
      const a = ancre(c);
      if (a) ajouter(c, centre(a) - centre(c));
    }
    const { cibles, poids } = ciblesParGroupe(l, deltas, true);
    resoudre(l, cibles, poids);
    calculerPoints(l);
    if (l > 0) calculerPoints(l - 1);
  };

  const passeMontante = (l: number) => {
    const deltas = new Map<string, number[]>();
    const ajouter = (c: string, d: number) => {
      const t = deltas.get(c) ?? [];
      t.push(d);
      deltas.set(c, t);
    };
    for (const u of unionsParLigne[l]!) {
      const sous = dessousDe.get(u.id)!;
      if (sous.length === 0) continue;
      const d = centreBloc(sous) - pointX.get(u.id)!;
      const e = encadrement(u, rangs[l]!, lignes[l]!);
      ajouter(e.gauche, d);
      ajouter(e.droite, d);
    }
    for (const c of lignes[l]!) {
      const r = relais.get(c);
      if (r && x.has(r.suivant)) ajouter(c, centre(r.suivant) - centre(c));
    }
    const { cibles, poids } = ciblesParGroupe(l, deltas, false);
    resoudre(l, cibles, poids);
    calculerPoints(l);
  };

  for (let l = 0; l < nbLignes; l++) calculerPoints(l);
  for (let l = 1; l < nbLignes; l++) passeDescendante(l);
  for (let it = 0; it < ITERATIONS; it++) {
    for (let l = nbLignes - 2; l >= 0; l--) passeMontante(l);
    for (let l = 1; l < nbLignes; l++) passeDescendante(l);
  }

  // normalisation : tout commence à x = 0
  let min = Infinity;
  for (const v of x.values()) min = Math.min(min, v);
  if (Number.isFinite(min)) {
    for (const [c, v] of x) x.set(c, v - min);
    for (const [u, v] of pointX) pointX.set(u, v - min);
  }
  for (let l = 0; l < nbLignes; l++) calculerPoints(l);

  return { lignes, x, ligneDe, relais, dessous: dessousDe, pointX };
}

/**
 * Régression isotonique pondérée (algorithme PAV) avec écarts minimaux :
 * minimise Σ wᵢ (xᵢ - tᵢ)² sous xᵢ₊₁ - xᵢ ≥ sepᵢ. Exact, en O(n).
 */
export function isotonique(cibles: number[], poids: number[], sep: number[]): number[] {
  const n = cibles.length;
  const decalage = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) decalage[i] = decalage[i - 1]! + sep[i - 1]!;
  const blocs: { valeur: number; poids: number; debut: number; fin: number }[] = [];
  for (let i = 0; i < n; i++) {
    let b = { valeur: cibles[i]! - decalage[i]!, poids: Math.max(poids[i]!, 1e-6), debut: i, fin: i };
    while (blocs.length > 0 && blocs[blocs.length - 1]!.valeur >= b.valeur) {
      const p = blocs.pop()!;
      const w = p.poids + b.poids;
      b = { valeur: (p.valeur * p.poids + b.valeur * b.poids) / w, poids: w, debut: p.debut, fin: b.fin };
    }
    blocs.push(b);
  }
  const res = new Array<number>(n);
  for (const b of blocs) for (let i = b.debut; i <= b.fin; i++) res[i] = b.valeur + decalage[i]!;
  return res;
}
