import type { Placement } from '../layout/types';
import type { Arbre } from '../model/types';
import { mettreEnPage, type MiseEnPage, type OptionsPages } from './pagination';
import { construireSvg } from './svg';

/**
 * Impression directe : une zone dédiée (le reste de l'interface est masqué par la feuille de style
 * d'impression), une page par feuille, dessin vectoriel sur fond blanc.
 */
export function preparerImpression(placement: Placement, arbre: Arbre, options: OptionsPages): MiseEnPage {
  const mise = mettreEnPage(placement.bornes, options);
  nettoyer();

  const style = document.createElement('style');
  style.id = 'style-impression';
  style.textContent = `@page { size: ${mise.papier.largeur}mm ${mise.papier.hauteur}mm; margin: 0; }`;
  document.head.append(style);

  const zone = document.createElement('div');
  zone.id = 'zone-impression';
  const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;
  for (const [i, page] of mise.pages.entries()) {
    const feuille = document.createElement('div');
    feuille.className = 'page';
    feuille.style.width = mm(mise.papier.largeur);
    feuille.style.height = mm(mise.papier.hauteur);
    const p = mise.placement;
    const svg = construireSvg(placement, arbre, {
      zone: options.mode === 'une-page' ? undefined : page.zone,
      largeur: mm(p.largeur),
      hauteur: mm(p.hauteur),
    });
    feuille.innerHTML = `<div style="position:absolute;left:${mm(p.x)};top:${mm(p.y)}">${svg}</div>`;
    if (mise.pages.length > 1) {
      const repere = document.createElement('div');
      repere.className = 'repere';
      repere.textContent = `Page ${i + 1}/${mise.pages.length} — ligne ${page.ligne + 1}, colonne ${page.colonne + 1}`;
      feuille.append(repere);
    }
    zone.append(feuille);
  }
  document.body.append(zone);
  return mise;
}

export function nettoyer(): void {
  document.getElementById('zone-impression')?.remove();
  document.getElementById('style-impression')?.remove();
}

/** Prépare, imprime, puis nettoie. */
export function imprimer(placement: Placement, arbre: Arbre, options: OptionsPages): void {
  preparerImpression(placement, arbre, options);
  addEventListener('afterprint', nettoyer, { once: true });
  // laisse le temps au navigateur de mettre en page les polices avant d'ouvrir la fenêtre d'impression
  requestAnimationFrame(() => requestAnimationFrame(() => print()));
}
