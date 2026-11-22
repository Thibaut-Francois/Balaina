import { describe, expect, it } from 'vitest';
import { echelleImage, MARGE_MM, mettreEnPage, MM_PAR_PX, PIXELS_MAX_COTE } from '../src/export/pagination';

const dessin = { x: -40, y: -40, largeur: 2000, hauteur: 900 };

describe('une page', () => {
  it('réduit pour tenir dans la zone utile, centré', () => {
    const m = mettreEnPage(dessin, { format: 'A4', orientation: 'paysage', mode: 'une-page' });
    expect(m.papier).toEqual({ largeur: 297, hauteur: 210 });
    expect(m.pages).toHaveLength(1);
    expect(m.placement.largeur).toBeCloseTo(297 - 2 * MARGE_MM);
    expect(m.placement.hauteur).toBeLessThanOrEqual(210 - 2 * MARGE_MM);
    expect(m.placement.y).toBeCloseTo((210 - m.placement.hauteur) / 2);
  });

  it('n’agrandit jamais au-delà de la taille réelle', () => {
    const m = mettreEnPage({ x: 0, y: 0, largeur: 200, hauteur: 100 }, { format: 'A3', orientation: 'auto', mode: 'une-page' });
    expect(m.echelle).toBe(MM_PAR_PX);
  });

  it('orientation automatique : celle qui donne le plus grand dessin', () => {
    expect(mettreEnPage(dessin, { format: 'A4', orientation: 'auto', mode: 'une-page' }).orientation).toBe('paysage');
    const haut = { x: 0, y: 0, largeur: 900, hauteur: 2000 };
    expect(mettreEnPage(haut, { format: 'A4', orientation: 'auto', mode: 'une-page' }).orientation).toBe('portrait');
  });
});

describe('taille réelle sur plusieurs pages', () => {
  it('découpe en grille couvrant tout le dessin', () => {
    const m = mettreEnPage(dessin, { format: 'A4', orientation: 'paysage', mode: 'taille-reelle' });
    const zoneL = (297 - 2 * MARGE_MM) / MM_PAR_PX;
    expect(m.colonnes).toBe(Math.ceil(2000 / zoneL));
    expect(m.pages).toHaveLength(m.colonnes * m.lignes);
    const premiere = m.pages[0]!.zone,
      derniere = m.pages[m.pages.length - 1]!.zone;
    expect(premiere.x).toBeLessThanOrEqual(dessin.x);
    expect(premiere.y).toBeLessThanOrEqual(dessin.y);
    expect(derniere.x + derniere.largeur).toBeGreaterThanOrEqual(dessin.x + dessin.largeur);
    expect(derniere.y + derniere.hauteur).toBeGreaterThanOrEqual(dessin.y + dessin.hauteur);
  });

  it('les pages se suivent sans trou ni chevauchement', () => {
    const m = mettreEnPage(dessin, { format: 'A4', orientation: 'portrait', mode: 'taille-reelle' });
    const [a, b] = m.pages;
    expect(b!.zone.x).toBeCloseTo(a!.zone.x + a!.zone.largeur);
  });

  it('orientation automatique : le moins de pages', () => {
    const auto = mettreEnPage(dessin, { format: 'A4', orientation: 'auto', mode: 'taille-reelle' });
    const p = mettreEnPage(dessin, { format: 'A4', orientation: 'portrait', mode: 'taille-reelle' });
    const l = mettreEnPage(dessin, { format: 'A4', orientation: 'paysage', mode: 'taille-reelle' });
    expect(auto.pages.length).toBe(Math.min(p.pages.length, l.pages.length));
  });
});

describe('images', () => {
  it('garde la résolution demandée quand c’est possible', () => {
    expect(echelleImage(2000, 1000, 2)).toEqual({ echelle: 2, reduite: false });
  });
  it('réduit pour respecter les limites du navigateur', () => {
    const r = echelleImage(10000, 2000, 4);
    expect(r.reduite).toBe(true);
    expect(10000 * r.echelle).toBeLessThanOrEqual(PIXELS_MAX_COTE);
  });
});
