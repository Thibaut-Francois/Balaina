import { describe, expect, it } from 'vitest';
import { chargerExemple } from './aides';
import { enfantsOrdonnes, estAscendant, indexer, unionsChronologiques } from '../src/model/index';
import type { Arbre, Personne, Union } from '../src/model/types';
import { avertissements, erreursStructure, valider } from '../src/model/validate';

const p = (id: string, naissance?: number, extra: Partial<Personne> = {}): Personne => ({
  id,
  prenoms: id,
  nom: 'Test',
  ...(naissance !== undefined ? { naissance: { annee: naissance } } : {}),
  ...extra,
});
const u = (id: string, partenaires: string[], enfants: string[] = [], extra: Partial<Union> = {}): Union => ({
  id,
  partenaires: partenaires as Union['partenaires'],
  type: 'non_precise',
  enfants,
  ...extra,
});

describe('détection de cycle', () => {
  it('arbre sain : aucune erreur', () => {
    const a: Arbre = { personnes: [p('A'), p('B'), p('C')], unions: [u('U1', ['A', 'B'], ['C'])] };
    expect(erreursStructure(a)).toEqual([]);
  });

  it('une personne parent d’elle-même', () => {
    const a: Arbre = { personnes: [p('A'), p('B')], unions: [u('U1', ['A', 'B'], ['A'])] };
    const e = erreursStructure(a);
    expect(e.map((x) => x.code)).toEqual(['cycle']);
  });

  it('cycle sur plusieurs générations', () => {
    // A → B → C → A
    const a: Arbre = {
      personnes: [p('A'), p('B'), p('C')],
      unions: [u('U1', ['A'], ['B']), u('U2', ['B'], ['C']), u('U3', ['C'], ['A'])],
    };
    const e = erreursStructure(a);
    expect(e).toHaveLength(1);
    expect(e[0]!.code).toBe('cycle');
    expect(new Set(e[0]!.ids)).toEqual(new Set(['A', 'B', 'C']));
  });

  it('descendre de deux branches (cousins en union) n’est pas un cycle', () => {
    expect(valider(chargerExemple()).erreurs).toEqual([]);
  });

  it('estAscendant', () => {
    const idx = indexer(chargerExemple());
    expect(estAscendant(idx, 'P0001', 'P0009')).toBe(true); // arrière-grand-parent, par deux branches
    expect(estAscendant(idx, 'P0009', 'P0001')).toBe(false);
    expect(estAscendant(idx, 'P0011', 'P0009')).toBe(false); // partenaire, pas ascendant
  });
});

describe('erreurs de structure', () => {
  it('union sans partenaire, avec 3 partenaires, ou deux fois la même personne', () => {
    for (const partenaires of [[], ['A', 'B', 'C'], ['A', 'A']]) {
      const a: Arbre = { personnes: [p('A'), p('B'), p('C')], unions: [u('U1', partenaires)] };
      expect(erreursStructure(a).map((e) => e.code)).toContain('partenaires_invalides');
    }
  });
  it('enfant de deux unions', () => {
    const a: Arbre = {
      personnes: [p('A'), p('B'), p('C')],
      unions: [u('U1', ['A'], ['C']), u('U2', ['B'], ['C'])],
    };
    expect(erreursStructure(a).map((e) => e.code)).toEqual(['enfant_multiple']);
  });
  it('référence inconnue et identifiant dupliqué', () => {
    const a: Arbre = { personnes: [p('A'), p('A')], unions: [u('U1', ['A', 'Z'])] };
    expect(erreursStructure(a).map((e) => e.code).sort()).toEqual(['id_duplique', 'reference_inconnue']);
  });
});

describe('avertissements de dates (jamais bloquants)', () => {
  it('décès avant naissance', () => {
    const a: Arbre = { personnes: [p('A', 1950, { deces: { decede: true, date: { annee: 1940 } } })], unions: [] };
    const r = valider(a);
    expect(r.erreurs).toEqual([]);
    expect(r.avertissements.map((x) => x.code)).toEqual(['deces_avant_naissance']);
  });
  it('enfant né avant son parent', () => {
    const a: Arbre = { personnes: [p('A', 1950), p('B', 1940)], unions: [u('U1', ['A'], ['B'])] };
    expect(avertissements(a).map((x) => x.code)).toEqual(['enfant_avant_parent']);
  });
  it('pas d’avertissement quand l’imprécision rend l’ordre possible', () => {
    const a: Arbre = {
      personnes: [p('A', undefined, { naissance: { annee: 1950, qualificatif: 'vers' } }), p('B', 1948)],
      unions: [u('U1', ['A'], ['B'])],
    };
    expect(avertissements(a)).toEqual([]);
  });
  it('l’exemple ne déclenche aucun avertissement', () => {
    expect(valider(chargerExemple()).avertissements).toEqual([]);
  });
});

describe('ordre des unions', () => {
  it('chronologique pour la personne à 3 unions', () => {
    const idx = indexer(chargerExemple());
    expect(unionsChronologiques(idx, 'P0009')).toEqual(['U0005', 'U0006', 'U0007']);
  });
  it('trie par date même si l’ordre de création diffère', () => {
    const a: Arbre = {
      personnes: [p('A'), p('B'), p('C'), p('D')],
      unions: [
        u('U1', ['A', 'B'], [], { debut: { annee: 2000 } }),
        u('U2', ['A', 'C'], [], { debut: { annee: 1990 } }),
        u('U3', ['A', 'D']),
      ],
    };
    // U3 n'a aucune date : en fin de liste
    expect(unionsChronologiques(indexer(a), 'A')).toEqual(['U2', 'U1', 'U3']);
  });
  it('sans date de début : la naissance du premier enfant sert de repère', () => {
    const a: Arbre = {
      personnes: [p('A'), p('B'), p('C'), p('E1', 2005), p('E2', 1995)],
      unions: [u('U1', ['A', 'B'], ['E1']), u('U2', ['A', 'C'], ['E2'])],
    };
    expect(unionsChronologiques(indexer(a), 'A')).toEqual(['U2', 'U1']);
  });
});

describe('ordre des enfants', () => {
  it('datés par naissance, puis sans date en fin dans l’ordre manuel', () => {
    const idx = indexer(chargerExemple());
    expect(enfantsOrdonnes(idx, idx.unions.get('U0005')!)).toEqual(['P0012', 'P0013']);
    expect(enfantsOrdonnes(idx, idx.unions.get('U0007')!)).toEqual(['P0017', 'P0018']);
  });
  it('l’ordre manuel départage les enfants sans date', () => {
    const a: Arbre = {
      personnes: [p('A'), p('X'), p('Y', 2000), p('Z')],
      unions: [u('U1', ['A'], ['Z', 'Y', 'X'])],
    };
    const idx = indexer(a);
    expect(enfantsOrdonnes(idx, idx.unions.get('U1')!)).toEqual(['Y', 'Z', 'X']);
  });
});
