import { describe, expect, it } from 'vitest';
import { calculerPlacement } from '../src/layout/index';
import { comparer, evaluer, optimiserDisposition } from '../src/layout/optimisation';
import { ajouterEnfant } from '../src/model/commandes';
import type { Arbre } from '../src/model/types';
import { chargerExemple } from './aides';
import { arbreAleatoire, violations } from './invariants';

const appliquer = (a: Arbre, ordre: string[]): Arbre => ({ ...a, affichage: { ordre } });
const score = (a: Arbre) => evaluer(a, calculerPlacement(a));

describe('recalculer la disposition', () => {
  it('supprime des croisements évitables (arbre n°16 : 5 → 0)', () => {
    const a = arbreAleatoire(16, 35, true);
    const r = optimiserDisposition(a, { graine: 1 });
    expect(r.avant.croisements).toBe(5);
    expect(r.apres.croisements).toBe(0);
    expect(r.ameliore).toBe(true);
  });

  it('le résultat appliqué donne exactement le score annoncé, et ne régresse jamais', () => {
    for (const g of [6, 28, 87, 89, 93]) {
      const a = arbreAleatoire(g, 20 + (g % 5) * 15, true);
      const r = optimiserDisposition(a, { essais: 60 });
      expect(comparer(r.apres, r.avant)).toBeLessThanOrEqual(0);
      if (r.ordre) expect(score(appliquer(a, r.ordre)), `graine ${g}`).toEqual(r.apres);
      else expect(r.ameliore).toBe(false);
    }
  });

  it('déterministe : même arbre, même résultat', () => {
    const a = arbreAleatoire(87, 50, true);
    expect(optimiserDisposition(a, { essais: 40 })).toEqual(optimiserDisposition(a, { essais: 40 }));
  });

  it('une disposition quelconque respecte toujours les règles de placement', () => {
    for (const g of [2, 5, 16, 28, 41]) {
      const a = arbreAleatoire(g, 20 + (g % 5) * 15, g % 2 === 0);
      // ordre inversé, puis ordre optimisé
      const inverse = appliquer(a, [...a.personnes].reverse().map((p) => p.id));
      expect(violations(inverse, calculerPlacement(inverse), { croisements: false }), `graine ${g}`).toEqual([]);
      const opt = appliquer(a, optimiserDisposition(a, { essais: 30 }).ordre ?? []);
      expect(violations(opt, calculerPlacement(opt), { croisements: false }), `graine ${g}`).toEqual([]);
    }
  });

  it('l’exemple, déjà sans croisement, reste sans croisement', () => {
    const r = optimiserDisposition(chargerExemple());
    expect(r.apres.croisements).toBe(0);
    expect(r.apres.interdits).toBe(0);
  });

  it('après recalcul, un ajout reste stable : les lignes au-dessus ne bougent pas d’ordre', () => {
    const a0 = arbreAleatoire(16, 35, true);
    const a = appliquer(a0, optimiserDisposition(a0).ordre!);
    const parent = a.unions.find((u) => u.enfants.length > 0)!;
    const r = ajouterEnfant(a, parent.partenaires[0], { union: parent.id }, { nouvelle: { prenoms: 'Nouveau', nom: '' } });
    if (!r.ok) throw new Error(r.erreur);
    const avant = calculerPlacement(a),
      apres = calculerPlacement(r.arbre);
    const ligneNouveau = apres.cadres.find((c) => c.id === r.id)!.ligne;
    const ordre = (pl: typeof avant) =>
      pl.cadres.filter((c) => c.ligne < ligneNouveau).sort((p, q) => p.ligne - q.ligne || p.x - q.x).map((c) => c.id);
    expect(ordre(apres)).toEqual(ordre(avant));
  });
});
