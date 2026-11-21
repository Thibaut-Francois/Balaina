import { indexer } from '../src/model/index';
import type { Arbre, Personne, Union } from '../src/model/types';
import type { Placement, Segment } from '../src/layout/types';

/** Vérifie les règles d'affichage et renvoie la liste des violations (vide si tout va bien). */
export function violations(arbre: Arbre, pl: Placement, options = { croisements: true }): string[] {
  const res: string[] = [];
  const idx = indexer(arbre);
  const W = pl.largeurCadre,
    H = pl.hauteurCadre;

  // 0. coordonnées toutes finies
  const finis = [
    ...pl.cadres.flatMap((c) => [c.x, c.y]),
    ...pl.points.flatMap((p) => [p.x, p.y]),
    ...pl.segments.flatMap((s) => [s.x1, s.y1, s.x2, s.y2]),
  ].every(Number.isFinite);
  if (!finis) res.push('coordonnées non finies (NaN ou infini)');

  // 1. chaque personne exactement une fois
  const vus = new Map<string, number>();
  for (const c of pl.cadres) vus.set(c.id, (vus.get(c.id) ?? 0) + 1);
  for (const p of arbre.personnes) if (vus.get(p.id) !== 1) res.push(`${p.id} affiché ${vus.get(p.id) ?? 0} fois`);
  const cadre = new Map(pl.cadres.map((c) => [c.id, c]));

  // 2. partenaires sur la même ligne (sauf unions signalées comme impossibles)
  const nbCoupees = pl.avertissements.length;
  let partenairesSepares = 0;
  for (const u of arbre.unions) {
    if (u.partenaires.length === 2 && cadre.get(u.partenaires[0])!.ligne !== cadre.get(u.partenaires[1]!)!.ligne)
      partenairesSepares++;
  }
  if (partenairesSepares > nbCoupees) res.push(`${partenairesSepares} unions sur deux lignes, ${nbCoupees} signalées`);

  // 3. parent au-dessus de l'enfant
  for (const u of arbre.unions)
    for (const e of u.enfants)
      for (const p of u.partenaires)
        if (cadre.get(p)!.ligne >= cadre.get(e)!.ligne) res.push(`parent ${p} pas au-dessus de ${e}`);

  // 4. pas de chevauchement de cadres
  const parLigne = new Map<number, typeof pl.cadres>();
  for (const c of pl.cadres) parLigne.set(c.ligne, [...(parLigne.get(c.ligne) ?? []), c]);
  for (const cs of parLigne.values()) {
    const tri = [...cs].sort((a, b) => a.x - b.x);
    for (let i = 1; i < tri.length; i++)
      if (tri[i]!.x < tri[i - 1]!.x + W - 1e-6) res.push(`cadres ${tri[i - 1]!.id} et ${tri[i]!.id} se chevauchent`);
  }

  // 5. segments horizontaux ou verticaux
  for (const s of pl.segments)
    if (Math.abs(s.x1 - s.x2) > 1e-6 && Math.abs(s.y1 - s.y2) > 1e-6) res.push(`segment oblique (${s.unionId})`);

  // 6. aucun segment ne traverse un cadre
  for (const s of pl.segments) {
    for (const c of pl.cadres) {
      if (traverseRect(s, c.x, c.y, W, H)) res.push(`un trait de ${s.unionId} traverse le cadre ${c.id}`);
    }
  }

  // 7. aucun croisement entre les traits de deux unions d'une même personne
  const segmentsDe = new Map<string, Segment[]>();
  for (const s of pl.segments) segmentsDe.set(s.unionId, [...(segmentsDe.get(s.unionId) ?? []), s]);
  const memeCouple = (a: string, b: string) => {
    const pa = [...idx.unions.get(a)!.partenaires].sort().join();
    return pa === [...idx.unions.get(b)!.partenaires].sort().join();
  };
  for (const p of options.croisements ? arbre.personnes : []) {
    const us = idx.unionsDe.get(p.id)!;
    for (let i = 0; i < us.length; i++)
      for (let j = i + 1; j < us.length; j++) {
        // un couple uni deux fois partage le même trait d'union : ce n'est pas un croisement
        if (memeCouple(us[i]!, us[j]!)) continue;
        for (const a of segmentsDe.get(us[i]!) ?? [])
          for (const b of segmentsDe.get(us[j]!) ?? [])
            if (secoupent(a, b)) res.push(`croisement entre ${us[i]} et ${us[j]} (unions de ${p.id})`);
      }
  }

  // 8. chaque union a un point, posé sur un de ses traits d'union
  for (const u of arbre.unions) {
    const pt = pl.points.find((x) => x.unionId === u.id);
    if (!pt) {
      res.push(`pas de point pour ${u.id}`);
      continue;
    }
    const sur = (segmentsDe.get(u.id) ?? []).some((s) => s.nature === 'union' && surSegment(pt.x, pt.y, s));
    if (!sur) res.push(`le point de ${u.id} n'est pas sur un trait d'union`);
  }

  // 9. chaque enfant est relié : un segment de filiation de son union arrive sur le haut de son cadre
  for (const u of arbre.unions) {
    for (const e of u.enfants) {
      const c = cadre.get(e)!;
      const ok = (segmentsDe.get(u.id) ?? []).some(
        (s) =>
          s.nature === 'filiation' &&
          s.x1 === s.x2 &&
          Math.abs(Math.max(s.y1, s.y2) - c.y) < 1e-6 &&
          s.x1 > c.x &&
          s.x1 < c.x + W,
      );
      if (!ok) res.push(`l'enfant ${e} n'est pas relié à ${u.id}`);
    }
  }
  return res;
}

function traverseRect(s: Segment, x: number, y: number, w: number, h: number): boolean {
  const e = 0.5; // les traits peuvent toucher le bord
  const [xa, xb] = [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)];
  const [ya, yb] = [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)];
  return xb > x + e && xa < x + w - e && yb > y + e && ya < y + h - e;
}

function surSegment(px: number, py: number, s: Segment): boolean {
  const e = 1e-6;
  return (
    px >= Math.min(s.x1, s.x2) - e &&
    px <= Math.max(s.x1, s.x2) + e &&
    py >= Math.min(s.y1, s.y2) - e &&
    py <= Math.max(s.y1, s.y2) + e
  );
}

/** Croisement ou superposition de deux segments orthogonaux (contact aux extrémités toléré). */
function secoupent(a: Segment, b: Segment): boolean {
  const e = 0.5;
  const ha = a.y1 === a.y2,
    hb = b.y1 === b.y2;
  const ax = [Math.min(a.x1, a.x2), Math.max(a.x1, a.x2)] as const;
  const ay = [Math.min(a.y1, a.y2), Math.max(a.y1, a.y2)] as const;
  const bx = [Math.min(b.x1, b.x2), Math.max(b.x1, b.x2)] as const;
  const by = [Math.min(b.y1, b.y2), Math.max(b.y1, b.y2)] as const;
  if (ha !== hb) {
    const [h, v] = ha ? [{ x: ax, y: a.y1 }, { y: by, x: b.x1 }] : [{ x: bx, y: b.y1 }, { y: ay, x: a.x1 }];
    return v.x > h.x[0] + e && v.x < h.x[1] - e && h.y > v.y[0] + e && h.y < v.y[1] - e;
  }
  if (ha) return Math.abs(a.y1 - b.y1) < e && Math.min(ax[1], bx[1]) - Math.max(ax[0], bx[0]) > e;
  return Math.abs(a.x1 - b.x1) < e && Math.min(ay[1], by[1]) - Math.max(ay[0], by[0]) > e;
}

// ---------- Générateur d'arbres aléatoires (graine fixe) ----------

export function generateur(graine: number) {
  let s = graine >>> 0;
  const alea = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return alea;
}

/**
 * Arbre aléatoire.
 * - `realiste` : les unions entre branches ne relient que des personnes sans union ni parent commun
 *   (cousins, familles sans lien), comme dans une vraie généalogie ;
 * - sinon (chaotique) : n'importe quelle paire sans lien d'ascendance (demi-frères, boucles d'unions…),
 *   pour éprouver la robustesse du placement.
 */
export function arbreAleatoire(graine: number, taille: number, realiste = false): Arbre {
  const alea = generateur(graine);
  const personnes: Personne[] = [];
  const unions: Union[] = [];
  const parentUnion = new Map<string, string>();
  let np = 0,
    nu = 0;
  const nouvellePersonne = (annee?: number): string => {
    const id = `P${String(++np).padStart(4, '0')}`;
    personnes.push({ id, prenoms: `Prénom${np}`, nom: `Nom${np}`, ...(annee ? { naissance: { annee } } : {}) });
    return id;
  };
  const nouvelleUnion = (partenaires: string[], annee?: number): Union => {
    const u: Union = {
      id: `U${String(++nu).padStart(4, '0')}`,
      partenaires: partenaires as Union['partenaires'],
      type: 'non_precise',
      enfants: [],
      ...(annee ? { debut: { annee } } : {}),
    };
    unions.push(u);
    return u;
  };
  const ascendants = (id: string): Set<string> => {
    const res = new Set<string>();
    const pile = [id];
    while (pile.length) {
      const u = parentUnion.get(pile.pop()!);
      if (!u) continue;
      for (const p of unions.find((x) => x.id === u)!.partenaires) if (!res.has(p)) (res.add(p), pile.push(p));
    }
    return res;
  };
  const choisir = <T>(t: T[]): T => t[Math.floor(alea() * t.length)]!;
  /** Les parents de p et ceux de q sont-ils reliés entre eux par des unions (même ligne de couples) ? */
  const memeFamilleRecomposee = (p: string, q: string) => {
    const up = parentUnion.get(p),
      uq = parentUnion.get(q);
    if (!up || !uq) return false;
    const vus = new Set<string>(unions.find((x) => x.id === up)!.partenaires);
    const pile = [...vus];
    while (pile.length) {
      const x = pile.pop()!;
      for (const u of unions) {
        if (u.partenaires.length !== 2 || !u.partenaires.includes(x as never)) continue;
        for (const y of u.partenaires) if (!vus.has(y)) (vus.add(y), pile.push(y));
      }
    }
    return unions.find((x) => x.id === uq)!.partenaires.some((y) => vus.has(y));
  };
  const parentDirect = (enfant: string, parent: string) => {
    const u = parentUnion.get(enfant);
    return !!u && unions.find((x) => x.id === u)!.partenaires.includes(parent as never);
  };

  const nbUnions = (id: string) => unions.filter((u) => u.partenaires.includes(id as never)).length;
  /** Personne choisie pour une union : surtout des personnes sans union, parfois un remariage. */
  const choisirPartenaire = (): string => {
    for (let essai = 0; essai < 6; essai++) {
      const p = choisir(personnes).id;
      const n = nbUnions(p);
      if (n === 0 || alea() < (n < 3 ? 0.25 : 0.08)) return p;
    }
    return choisir(personnes).id;
  };

  const a = nouvellePersonne(1900),
    b = nouvellePersonne(1902);
  nouvelleUnion([a, b], 1925);
  while (personnes.length < taille) {
    const r = alea();
    if (r < 0.55 && unions.length > 0) {
      // un enfant dans une union existante
      const u = choisir(unions);
      const e = nouvellePersonne(alea() < 0.85 ? 1900 + Math.floor(alea() * 120) : undefined);
      u.enfants.push(e);
      parentUnion.set(e, u.id);
    } else if (r < 0.88) {
      // une nouvelle union avec une nouvelle personne (remariage possible)
      const p = choisirPartenaire();
      const q = nouvellePersonne();
      nouvelleUnion([p, q], alea() < 0.7 ? 1920 + Math.floor(alea() * 100) : undefined);
    } else if (r < 0.94) {
      // union à un seul parent connu
      nouvelleUnion([choisirPartenaire()]);
    } else {
      // union entre deux personnes existantes (cousins, branches reliées), sans ascendance directe
      const p = choisirPartenaire(),
        q = choisirPartenaire();
      if (p === q || ascendants(p).has(q) || ascendants(q).has(p)) continue;
      if (realiste) {
        const memesParents = parentUnion.has(p) && parentUnion.get(p) === parentUnion.get(q);
        const parentsCommuns = [...ascendants(p)].some((x) => ascendants(q).has(x) && parentDirect(p, x) && parentDirect(q, x));
        // Enfants de deux unions d'une même famille recomposée (A-B, B-C, C-D…) : si une fratrie
        // intermédiaire les sépare, un croisement est géométriquement inévitable. Exclu du test strict.
        const recomposee = memeFamilleRecomposee(p, q);
        if (nbUnions(p) > 0 || nbUnions(q) > 0 || memesParents || parentsCommuns || recomposee) continue;
      }
      nouvelleUnion([p, q]);
    }
  }
  return { personnes, unions };
}
