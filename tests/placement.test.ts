import { describe, expect, it } from 'vitest';
import { calculerPlacement } from '../src/layout/index';
import { construireStructure } from '../src/layout/groupes';
import { isotonique } from '../src/layout/placement';
import { indexer } from '../src/model/index';
import { valider } from '../src/model/validate';
import type { Arbre } from '../src/model/types';
import { chargerExemple } from './aides';
import { arbreAleatoire, violations } from './invariants';

const cadreDe = (pl: ReturnType<typeof calculerPlacement>, id: string) => pl.cadres.find((c) => c.id === id)!;

describe('générations', () => {
  const pl = calculerPlacement(chargerExemple());
  const ligne = (id: string) => cadreDe(pl, id).ligne;

  it('un parent est au-dessus de ses enfants, les partenaires sur la même ligne', () => {
    expect(ligne('P0001')).toBe(ligne('P0002'));
    expect(ligne('P0003')).toBe(ligne('P0001') + 1);
    expect(ligne('P0009')).toBe(ligne('P0007') + 1);
  });

  it('chaîne A-B-C sur la même ligne', () => {
    expect(new Set([ligne('P0012'), ligne('P0019'), ligne('P0020')]).size).toBe(1);
  });

  it('union entre générations : les partenaires restent alignés, la filiation s’allonge', () => {
    // Henri (gendre de Jean) et Simone (petite-fille de Jean)
    expect(ligne('P0006')).toBe(ligne('P0010'));
    expect(ligne('P0004')).toBe(ligne('P0006'));
    expect(ligne('P0004') - ligne('P0001')).toBeGreaterThan(1);
  });

  it('cousins en union sur la même ligne', () => {
    expect(ligne('P0007')).toBe(ligne('P0008'));
  });

  it('conjoint sans parents connus : placé sur la ligne de son partenaire', () => {
    expect(ligne('P0011')).toBe(ligne('P0009'));
    expect(ligne('P0005')).toBe(ligne('P0003'));
  });

  it('cas impossible : union avec l’enfant de son autre partenaire → union coupée, signalée', () => {
    // A + B → C ; puis A + C : C devrait être à la fois sur la ligne de A et en dessous.
    const a: Arbre = {
      personnes: ['A', 'B', 'C'].map((id) => ({ id, prenoms: id, nom: '' })),
      unions: [
        { id: 'U1', partenaires: ['A', 'B'], type: 'non_precise', enfants: ['C'] },
        { id: 'U2', partenaires: ['A', 'C'], type: 'non_precise', enfants: [] },
      ],
    };
    expect(valider(a).erreurs).toEqual([]);
    const s = construireStructure(indexer(a));
    expect([...s.coupees]).toEqual(['U2']);
    const p = calculerPlacement(a);
    expect(p.avertissements).toHaveLength(1);
    expect(violations(a, p)).toEqual([]);
  });
});

describe('ordre des unions et des enfants', () => {
  const arbre = chargerExemple();
  const pl = calculerPlacement(arbre);
  const x = (id: string) => cadreDe(pl, id).x;

  it('3 unions : partenaires du même côté, dans l’ordre chronologique', () => {
    const c = x('P0009');
    const partenaires = [x('P0011'), x('P0014'), x('P0016')];
    const memeCote = partenaires.every((v) => v > c) || partenaires.every((v) => v < c);
    expect(memeCote).toBe(true);
    const dist = partenaires.map((v) => Math.abs(v - c));
    expect(dist[0]).toBeLessThan(dist[1]!);
    expect(dist[1]).toBeLessThan(dist[2]!);
  });

  it('2 unions : un partenaire de chaque côté', () => {
    // Yanis : Léa d'un côté, Chloé de l'autre ; Henri : Jeanne et Simone
    expect(Math.sign(x('P0012') - x('P0019'))).toBe(-Math.sign(x('P0020') - x('P0019')));
    expect(Math.sign(x('P0004') - x('P0006'))).toBe(-Math.sign(x('P0010') - x('P0006')));
  });

  it('les groupes d’enfants suivent l’ordre des unions', () => {
    const sens = Math.sign(x('P0014') - x('P0009'));
    const centre = (ids: string[]) => ids.reduce((s, id) => s + x(id), 0) / ids.length;
    const g1 = centre(['P0012', 'P0013']),
      g2 = centre(['P0015']),
      g3 = centre(['P0017', 'P0018']);
    expect(Math.sign(g2 - g1)).toBe(sens);
    expect(Math.sign(g3 - g2)).toBe(sens);
  });

  it('enfants triés par naissance, sans date en fin de groupe', () => {
    const sens = Math.sign(x('P0014') - x('P0009'));
    expect(Math.sign(x('P0013') - x('P0012'))).toBe(sens); // Léa (1986) avant Hugo (1989)
    expect(Math.sign(x('P0018') - x('P0017'))).toBe(sens); // Noé avant Lou (sans date)
  });

  it('demi-fratries séparées par un espace nettement plus large', () => {
    const W = pl.largeurCadre;
    // Hugo (union 1) et Inès (union 2) sont voisins dans la ligne
    const ecartDemi = Math.abs(x('P0015') - x('P0013')) - W;
    const ecartFratrie = Math.abs(x('P0018') - x('P0017')) - W;
    expect(ecartDemi).toBeGreaterThanOrEqual(2 * ecartFratrie);
  });

  it('les enfants sont regroupés sous leur point d’union', () => {
    for (const u of arbre.unions) {
      const enfants = u.enfants.map((e) => cadreDe(pl, e));
      if (enfants.length < 2) continue;
      const pt = pl.points.find((p) => p.unionId === u.id)!;
      const min = Math.min(...enfants.map((c) => c.x)),
        max = Math.max(...enfants.map((c) => c.x + pl.largeurCadre));
      // le point est au-dessus du bloc formé par ses enfants
      expect(pt.x, u.id).toBeGreaterThanOrEqual(min - 1);
      expect(pt.x, u.id).toBeLessThanOrEqual(max + 1);
    }
  });
});

describe('invariants d’affichage', () => {
  it('fichier d’exemple : aucune violation', () => {
    const a = chargerExemple();
    expect(violations(a, calculerPlacement(a))).toEqual([]);
  });

  const graines = Array.from({ length: 100 }, (_, i) => i + 1);
  const taille = (g: number) => 20 + (g % 5) * 15;

  it('100 arbres réalistes : règles structurelles toujours respectées', () => {
    for (const g of graines) {
      const a = arbreAleatoire(g, taille(g), true);
      expect(valider(a).erreurs, `graine ${g}`).toEqual([]);
      expect(violations(a, calculerPlacement(a), { croisements: false }), `graine ${g}`).toEqual([]);
    }
  });

  it('100 arbres réalistes : croisements entre unions d’une même personne quasi inexistants', () => {
    // Cas résiduels connus : les enfants d'une même union forment des couples avec des familles
    // placées de part et d'autre de la fratrie voisine ; le trait passe alors forcément au-dessus.
    const touches = graines.filter((g) => {
      const a = arbreAleatoire(g, taille(g), true);
      return violations(a, calculerPlacement(a)).length > 0;
    });
    expect(touches.length).toBeLessThanOrEqual(5);
  });

  it('100 arbres chaotiques (demi-frères unis, boucles d’unions…) : placement toujours valide', () => {
    for (const g of graines) {
      const a = arbreAleatoire(g, taille(g));
      expect(valider(a).erreurs, `graine ${g}`).toEqual([]);
      expect(violations(a, calculerPlacement(a), { croisements: false }), `graine ${g}`).toEqual([]);
    }
  });

  it('arbre vide et personne seule', () => {
    expect(calculerPlacement({ personnes: [], unions: [] }).cadres).toEqual([]);
    const p = calculerPlacement({ personnes: [{ id: 'P1', prenoms: 'A', nom: 'B' }], unions: [] });
    expect(p.cadres).toHaveLength(1);
  });
});

describe('déterminisme et stabilité', () => {
  it('deux calculs donnent exactement le même résultat', () => {
    const a = chargerExemple();
    expect(calculerPlacement(a)).toEqual(calculerPlacement(structuredClone(a)));
  });

  it('ajouter un enfant ne change pas l’ordre des lignes au-dessus', () => {
    const a = chargerExemple();
    const avant = calculerPlacement(a);
    const b = structuredClone(a);
    b.personnes.push({ id: 'P0099', prenoms: 'Nouveau', nom: 'Bernard' });
    b.unions.find((u) => u.id === 'U0011')!.enfants.push('P0099');
    const apres = calculerPlacement(b);
    const ligneMax = cadreDe(apres, 'P0099').ligne;
    const ordre = (pl: typeof avant) =>
      [...pl.cadres]
        .filter((c) => c.ligne < ligneMax)
        .sort((p, q) => p.ligne - q.ligne || p.x - q.x)
        .map((c) => c.id);
    expect(ordre(apres)).toEqual(ordre(avant));
  });
});

describe('performance', () => {
  it('500 personnes : placement en moins d’une seconde', () => {
    const a = arbreAleatoire(7, 500, true);
    const debut = performance.now();
    const pl = calculerPlacement(a);
    const duree = performance.now() - debut;
    expect(pl.cadres).toHaveLength(500);
    expect(duree).toBeLessThan(1000);
  });
});

describe('résolution isotonique', () => {
  it('respecte les écarts minimaux et reste au plus près des cibles', () => {
    expect(isotonique([0, 0, 0], [1, 1, 1], [10, 10])).toEqual([-10, 0, 10]);
    expect(isotonique([0, 100], [1, 1], [10])).toEqual([0, 100]);
  });
});
