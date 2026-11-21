import {
  ARCHE_BASE,
  ARCHE_PAS,
  COULOIR_APRES,
  COULOIR_BASE,
  COULOIR_PAS,
  ECART_LIGNES_MIN,
  HAUTEUR_CADRE,
  LARGEUR_CADRE,
  SORTIE_BORD,
  SORTIE_PAS,
} from './constantes';
import { clePersonne, type Structure } from './groupes';
import { encadrement, largeur, type Disposition } from './placement';
import type { PointPlace, Segment } from './types';

/**
 * Étape F : routage orthogonal.
 *  - union entre voisins : trait horizontal à mi-hauteur, point dans l'espace entre les cadres ;
 *  - union vers un partenaire éloigné (3 unions et plus) : arche au-dessus des cadres,
 *    chaque union à sa hauteur, les plus éloignées le plus haut, sorties décalées sur le cadre
 *    du porteur → aucun croisement entre les unions d'une même personne ;
 *  - filiation : du point vers une barre de fratrie dans le couloir sous la ligne, puis vers chaque enfant.
 */

interface Arche {
  union: string;
  ligne: number;
  sortieX: number;
  pointX: number;
  piste: number;
}

interface Barre {
  union: string;
  nature: Segment['nature'];
  /** Barre issue d'un relais (traversée d'une ligne intermédiaire). */
  relais?: string;
  /** Couloir sous la ligne `couloir`. */
  couloir: number;
  min: number;
  max: number;
  /** Verticales arrivant d'en haut / repartant vers le bas. */
  haut: number[];
  bas: { x: number; cible: string }[];
  piste: number;
}

const chevauche = (a: { min: number; max: number }, b: { min: number; max: number }, marge = 6) =>
  a.min <= b.max + marge && b.min <= a.max + marge;

export function router(s: Structure, d: Disposition) {
  const nbLignes = d.lignes.length;
  const rangs = d.lignes.map((l) => new Map(l.map((c, i) => [c, i])));
  const gauche = (c: string) => d.x.get(c)!;
  const centre = (c: string) => d.x.get(c)! + largeur(c) / 2;

  // ---- Arches ----
  const arches: Arche[] = [];
  const archesParPorteur = new Map<string, { union: string; pointX: number; aDroite: boolean }[]>();
  for (const u of s.unions.values()) {
    const e = encadrement(u, rangs[u.ligne]!, d.lignes[u.ligne]!);
    if (!e.arche) continue;
    const liste = archesParPorteur.get(u.porteur) ?? [];
    liste.push({ union: u.id, pointX: d.pointX.get(u.id)!, aDroite: e.porteurAGauche });
    archesParPorteur.set(u.porteur, liste);
  }
  for (const [porteur, liste] of archesParPorteur) {
    const px = gauche(clePersonne(porteur));
    const ligne = d.ligneDe.get(clePersonne(porteur))!;
    for (const cote of [true, false]) {
      const deCeCote = liste
        .filter((a) => a.aDroite === cote)
        .sort((a, b) => Math.abs(a.pointX - px) - Math.abs(b.pointX - px));
      deCeCote.forEach((a, k) => {
        const sortieX = cote ? px + LARGEUR_CADRE - SORTIE_BORD - k * SORTIE_PAS : px + SORTIE_BORD + k * SORTIE_PAS;
        arches.push({ union: a.union, ligne, sortieX, pointX: a.pointX, piste: 0 });
      });
    }
  }
  const pistesArches = new Array<number>(nbLignes).fill(0);
  for (let l = 0; l < nbLignes; l++) {
    const ici = arches
      .filter((a) => a.ligne === l)
      .map((a) => ({ a, min: Math.min(a.sortieX, a.pointX), max: Math.max(a.sortieX, a.pointX) }))
      .sort((p, q) => p.max - p.min - (q.max - q.min) || p.min - q.min);
    const faites: typeof ici = [];
    for (const it of ici) {
      let piste = 1;
      for (const f of faites) if (chevauche(f, it, 0)) piste = Math.max(piste, f.a.piste + 1);
      it.a.piste = piste;
      faites.push(it);
      pistesArches[l] = Math.max(pistesArches[l]!, piste);
    }
  }

  // ---- Barres de fratrie (et morceaux de relais) ----
  const barres: Barre[] = [];
  for (const u of s.unions.values()) {
    const sous = d.dessous.get(u.id) ?? [];
    const px = d.pointX.get(u.id)!;
    const versDistant = (c: string) =>
      c.startsWith('R:') ? d.relais.get(c)!.enfant === u.partenaireDistant : c.slice(2) === u.partenaireDistant;
    const ajouterBarre = (bas: { x: number; cible: string }[], nature: Segment['nature']) => {
      if (bas.length === 0) return;
      const xs = [px, ...bas.map((b) => b.x)];
      barres.push({ union: u.id, nature, couloir: u.ligne, min: Math.min(...xs), max: Math.max(...xs), haut: [px], bas, piste: 0 });
    };
    const versEnfants = sous.filter((c) => !u.partenaireDistant || !versDistant(c));
    ajouterBarre(versEnfants.map((c) => ({ x: centre(c), cible: c })), 'filiation');
    // union coupée : trait séparé vers le partenaire distant (même ligne, ligne suivante ou relais)
    if (u.partenaireDistant) {
      const c = clePersonne(u.partenaireDistant);
      const l = d.ligneDe.get(c)!;
      const cible = l <= u.ligne + 1 ? c : sous.find(versDistant);
      // arrivée décalée du centre, pour ne pas se confondre avec un trait de filiation
      if (cible) ajouterBarre([{ x: cible.startsWith('P:') ? centre(cible) + LARGEUR_CADRE / 4 : centre(cible), cible }], 'union');
    }
  }
  for (const r of d.relais.values()) {
    const distant = s.unions.get(r.union)?.partenaireDistant === r.enfant;
    const x1 = centre(r.cle),
      x2 = centre(r.suivant) + (distant && r.suivant.startsWith('P:') ? LARGEUR_CADRE / 4 : 0);
    barres.push({
      union: r.union,
      nature: distant ? 'union' : 'filiation',
      relais: r.cle,
      couloir: r.ligne,
      min: Math.min(x1, x2),
      max: Math.max(x1, x2),
      haut: [x1],
      bas: [{ x: x2, cible: r.suivant }],
      piste: 0,
    });
  }
  const dedans = (v: number, b: Barre) => v > b.min + 0.5 && v < b.max - 0.5;
  /** Croisements si `a` est au-dessus de `b` dans le couloir. */
  const cout = (a: Barre, b: Barre) =>
    a.bas.filter((v) => dedans(v.x, b)).length + b.haut.filter((v) => dedans(v, a)).length;
  const pistesCouloirs = new Array<number>(nbLignes).fill(0);
  for (let l = 0; l < nbLignes; l++) {
    const ici = barres.filter((b) => b.couloir === l);
    // Score de Copeland : combien de voisins préfèrent que cette barre passe au-dessus d'eux.
    const score = new Map<Barre, number>(ici.map((b) => [b, 0]));
    for (let i = 0; i < ici.length; i++) {
      for (let j = i + 1; j < ici.length; j++) {
        const a = ici[i]!,
          b = ici[j]!;
        if (!chevauche(a, b)) continue;
        const ab = cout(a, b),
          ba = cout(b, a);
        if (ab < ba) score.set(a, score.get(a)! + 1);
        else if (ba < ab) score.set(b, score.get(b)! + 1);
      }
    }
    ici.sort((a, b) => score.get(b)! - score.get(a)! || a.min - b.min || (a.union < b.union ? -1 : 1));
    const faites: Barre[] = [];
    for (const b of ici) {
      let piste = 1;
      for (const f of faites) if (chevauche(f, b)) piste = Math.max(piste, f.piste + 1);
      b.piste = piste;
      faites.push(b);
      pistesCouloirs[l] = Math.max(pistesCouloirs[l]!, piste);
    }
  }

  // ---- Ordonnées des lignes ----
  const espaceArches = (l: number) => (pistesArches[l]! > 0 ? ARCHE_BASE + (pistesArches[l]! - 1) * ARCHE_PAS + 8 : 0);
  const yLigne: number[] = [];
  for (let l = 0; l < nbLignes; l++) {
    if (l === 0) yLigne.push(espaceArches(0));
    else {
      const pistes = Math.max(1, pistesCouloirs[l - 1]!);
      const couloir = Math.max(ECART_LIGNES_MIN, COULOIR_BASE + (pistes - 1) * COULOIR_PAS + COULOIR_APRES);
      yLigne.push(yLigne[l - 1]! + HAUTEUR_CADRE + couloir + espaceArches(l));
    }
  }
  const milieu = (l: number) => yLigne[l]! + HAUTEUR_CADRE / 2;
  const yCouloir = (l: number, piste: number) => yLigne[l]! + HAUTEUR_CADRE + COULOIR_BASE + (piste - 1) * COULOIR_PAS;
  const yArche = (l: number, piste: number) => yLigne[l]! - ARCHE_BASE - (piste - 1) * ARCHE_PAS;

  // ---- Segments ----
  const segments: Segment[] = [];
  const seg = (x1: number, y1: number, x2: number, y2: number, unionId: string, nature: Segment['nature']) => {
    if (x1 === x2 && y1 === y2) return;
    segments.push({ x1, y1, x2, y2, unionId, nature });
  };
  const points: PointPlace[] = [];
  const archeDe = new Map(arches.map((a) => [a.union, a]));

  for (const u of s.unions.values()) {
    const l = u.ligne;
    const px = d.pointX.get(u.id)!;
    const ym = milieu(l);
    points.push({ unionId: u.id, x: px, y: ym });
    const porteur = clePersonne(u.porteur);
    const fantome = u.autre.startsWith('F:');
    const a = archeDe.get(u.id);
    if (a) {
      const ya = yArche(l, a.piste);
      seg(a.sortieX, yLigne[l]!, a.sortieX, ya, u.id, 'union');
      seg(a.sortieX, ya, px, ya, u.id, 'union');
      seg(px, ya, px, ym, u.id, 'union');
      if (!fantome) {
        const autreX = px < gauche(u.autre) ? gauche(u.autre) : gauche(u.autre) + LARGEUR_CADRE;
        seg(px, ym, autreX, ym, u.id, 'union');
      }
    } else {
      const xp = gauche(porteur);
      const bordPorteur = px > xp ? xp + LARGEUR_CADRE : xp;
      if (fantome) seg(bordPorteur, ym, px, ym, u.id, 'union');
      else {
        const xa = gauche(u.autre);
        const bordAutre = px > xa ? xa + LARGEUR_CADRE : xa;
        seg(Math.min(bordPorteur, bordAutre), ym, Math.max(bordPorteur, bordAutre), ym, u.id, 'union');
      }
    }
  }

  // barre qui alimente chaque élément par le haut
  const barreVers = new Map<string, Barre>();
  for (const b of barres) for (const v of b.bas) barreVers.set(v.cible, b);

  for (const b of barres) {
    const yb = yCouloir(b.couloir, b.piste);
    const nature = b.nature;
    if (b.relais) {
      // traversée verticale de la ligne du relais : du couloir au-dessus jusqu'à ce couloir
      const amont = barreVers.get(b.relais);
      const yDepart = amont ? yCouloir(amont.couloir, amont.piste) : yLigne[b.couloir]!;
      seg(b.haut[0]!, yDepart, b.haut[0]!, yb, b.union, nature);
    } else {
      seg(b.haut[0]!, milieu(b.couloir), b.haut[0]!, yb, b.union, nature);
    }
    seg(b.min, yb, b.max, yb, b.union, nature);
    for (const v of b.bas) {
      if (v.cible.startsWith('R:')) continue; // la verticale du relais est tracée par sa propre barre
      const lc = d.ligneDe.get(v.cible)!;
      const yFin = lc > b.couloir ? yLigne[lc]! : yLigne[lc]! + HAUTEUR_CADRE;
      seg(v.x, yb, v.x, yFin, b.union, nature);
    }
  }

  return { segments, points, yLigne };
}
