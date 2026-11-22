import { describe, expect, it } from 'vitest';
import { marquerExporte, nomParDefaut, suivreModification, type EtatExport } from '../src/format/suivi';
import { modifierPersonne } from '../src/model/commandes';
import { arbreVide } from '../src/model/types';
import { chargerExemple } from './aides';

const T1 = new Date('2026-11-22T10:00:00Z');
const T2 = new Date('2026-11-22T11:00:00Z');

describe('modifications non exportées', () => {
  it('arbre vide jamais exporté : rien à signaler', () => {
    const e = suivreModification({ signatureExportee: null, modifieDepuis: null }, arbreVide(), T1);
    expect(e.modifieDepuis).toBeNull();
  });

  it('première modification : « depuis » cette date, conservée ensuite', () => {
    const a = chargerExemple();
    let e: EtatExport = { signatureExportee: null, modifieDepuis: null };
    e = suivreModification(e, a, T1);
    expect(e.modifieDepuis).toBe(T1.toISOString());
    e = suivreModification(e, a, T2);
    expect(e.modifieDepuis).toBe(T1.toISOString());
  });

  it('après export : à jour, puis non exporté à la modification suivante', () => {
    const a = chargerExemple();
    let e = marquerExporte(a);
    e = suivreModification(e, a, T1);
    expect(e.modifieDepuis).toBeNull();
    const r = modifierPersonne(a, 'P0001', { notes: 'x' });
    if (!r.ok) throw new Error();
    e = suivreModification(e, r.arbre, T2);
    expect(e.modifieDepuis).toBe(T2.toISOString());
  });

  it('annuler jusqu’au contenu exporté : de nouveau à jour', () => {
    const a = chargerExemple();
    let e = marquerExporte(a);
    const r = modifierPersonne(a, 'P0001', { notes: 'x' });
    if (!r.ok) throw new Error();
    e = suivreModification(e, r.arbre, T1);
    e = suivreModification(e, structuredClone(a), T2);
    expect(e.modifieDepuis).toBeNull();
  });

  it('nom de fichier par défaut', () => {
    expect(nomParDefaut(new Date(2026, 10, 2))).toBe('arbre-genealogique-2026-11-02.json');
  });
});
