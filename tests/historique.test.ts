import { describe, expect, it } from 'vitest';
import { Historique } from '../src/etat/historique';

describe('annuler / rétablir', () => {
  it('annule et rétablit dans l’ordre', () => {
    const h = new Historique(0);
    h.appliquer(1);
    h.appliquer(2);
    expect(h.annuler()).toBe(true);
    expect(h.etat).toBe(1);
    expect(h.annuler()).toBe(true);
    expect(h.etat).toBe(0);
    expect(h.annuler()).toBe(false);
    expect(h.retablir()).toBe(true);
    expect(h.etat).toBe(1);
  });

  it('une nouvelle modification efface le futur', () => {
    const h = new Historique(0);
    h.appliquer(1);
    h.annuler();
    h.appliquer(5);
    expect(h.peutRetablir).toBe(false);
  });

  it('la frappe dans un même champ ne forme qu’une étape', () => {
    const h = new Historique('');
    h.appliquer('J', 'nom', 0);
    h.appliquer('Je', 'nom', 300);
    h.appliquer('Jea', 'nom', 600);
    h.appliquer('Jea!', 'notes', 700);
    h.annuler();
    expect(h.etat).toBe('Jea');
    h.annuler();
    expect(h.etat).toBe('');
  });

  it('pas de fusion au-delà du délai', () => {
    const h = new Historique('');
    h.appliquer('a', 'nom', 0);
    h.appliquer('ab', 'nom', 5000);
    h.annuler();
    expect(h.etat).toBe('a');
  });
});
