import { describe, expect, it } from 'vitest';
import {
  analyserDate,
  comparerDates,
  estCertainementAvant,
  formaterDate,
  formaterDateNue,
} from '../src/model/dates';
import type { DatePartielle } from '../src/model/types';

const ok = (s: string): DatePartielle | undefined => {
  const r = analyserDate(s);
  if (!r.ok) throw new Error(`échec inattendu pour "${s}" : ${r.erreur}`);
  return r.date;
};

describe('analyserDate', () => {
  it.each([
    ['1852', { annee: 1852 }],
    ['vers 1790', { annee: 1790, qualificatif: 'vers' }],
    ['03/1915', { annee: 1915, mois: 3 }],
    ['avant 1700', { annee: 1700, qualificatif: 'avant' }],
    ['après 1900', { annee: 1900, qualificatif: 'apres' }],
    ['apres 1900', { annee: 1900, qualificatif: 'apres' }],
    ['12/03/1950', { annee: 1950, mois: 3, jour: 12 }],
    ['12-03-1950', { annee: 1950, mois: 3, jour: 12 }],
    ['  Vers   3/1915 ', { annee: 1915, mois: 3, qualificatif: 'vers' }],
    ['29/02/2000', { annee: 2000, mois: 2, jour: 29 }],
  ])('« %s »', (saisie, attendu) => {
    expect(ok(saisie)).toEqual(attendu);
  });

  it('une saisie vide signifie « pas de date »', () => {
    expect(ok('')).toBeUndefined();
    expect(ok('   ')).toBeUndefined();
  });

  it.each(['31/02/1950', '29/02/1900', '13/1950', 'demain', '1/2/3/1950', '50', 'vers', '00/1950'])(
    'refuse « %s »',
    (saisie) => {
      expect(analyserDate(saisie).ok).toBe(false);
    },
  );
});

describe('formatage', () => {
  it('notation numérique', () => {
    expect(formaterDateNue({ annee: 1950, mois: 3, jour: 12 })).toBe('12/03/1950');
    expect(formaterDateNue({ annee: 1915, mois: 3 })).toBe('03/1915');
    expect(formaterDateNue({ annee: 1852 })).toBe('1852');
  });
  it('avec qualificatif, ré-analysable', () => {
    for (const s of ['vers 1790', 'avant 1700', 'après 03/1915', '12/03/1950']) {
      expect(formaterDate(ok(s)!)).toBe(s);
    }
  });
});

describe('comparaison', () => {
  it('certainement avant : sans faux positif sur les dates imprécises', () => {
    expect(estCertainementAvant({ annee: 1900 }, { annee: 1901 })).toBe(true);
    expect(estCertainementAvant({ annee: 1900 }, { annee: 1900, mois: 6 })).toBe(false);
    expect(estCertainementAvant({ annee: 1900, qualificatif: 'vers' }, { annee: 1902 })).toBe(false);
    expect(estCertainementAvant({ annee: 1900, qualificatif: 'avant' }, { annee: 1901 })).toBe(true);
    expect(estCertainementAvant({ annee: 1900, qualificatif: 'apres' }, { annee: 1950 })).toBe(false);
  });
  it('tri', () => {
    const dates: DatePartielle[] = [
      { annee: 1950 },
      { annee: 1950, qualificatif: 'avant' },
      { annee: 1949, mois: 12 },
      { annee: 1950, qualificatif: 'apres' },
    ];
    const tri = [...dates].sort(comparerDates).map(formaterDate);
    expect(tri).toEqual(['12/1949', 'avant 1950', '1950', 'après 1950']);
  });
  it('gère les années antérieures à 100', () => {
    expect(estCertainementAvant({ annee: 50 }, { annee: 51 })).toBe(true);
    expect(estCertainementAvant({ annee: 99 }, { annee: 1999 })).toBe(true);
  });
});
