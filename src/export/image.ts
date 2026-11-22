import type { Placement } from '../layout/types';
import type { Arbre } from '../model/types';
import { echelleImage } from './pagination';
import { policesBase64 } from './polices';
import { construireSvg } from './svg';

export type FormatImage = 'png' | 'jpeg';

/** Image matricielle de tout l'arbre, fond blanc. `echelle` = facteur de résolution (1 = écran au zoom 100 %). */
export async function genererImage(
  placement: Placement,
  arbre: Arbre,
  format: FormatImage,
  echelleDemandee: number,
): Promise<{ blob: Blob; largeur: number; hauteur: number; reduite: boolean }> {
  const b = placement.bornes;
  const { echelle, reduite } = echelleImage(b.largeur, b.hauteur, echelleDemandee);
  const largeur = Math.round(b.largeur * echelle),
    hauteur = Math.round(b.hauteur * echelle);

  // Les polices doivent être intégrées au SVG : une image SVG ne peut rien charger d'autre.
  const p = await policesBase64();
  const svg = construireSvg(placement, arbre, {
    largeur: String(largeur),
    hauteur: String(hauteur),
    policesIntegrees: { regular: `data:font/ttf;base64,${p.regular}`, semibold: `data:font/ttf;base64,${p.semibold}` },
  });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => {
      img.onload = () => ok();
      img.onerror = () => ko(new Error("Impossible de préparer l'image."));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Le navigateur n'a pas pu créer une image aussi grande.");
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(img, 0, 0, largeur, hauteur);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, format === 'png' ? 'image/png' : 'image/jpeg', 0.92));
    if (!blob) throw new Error("Le navigateur n'a pas pu créer une image aussi grande.");
    return { blob, largeur, hauteur, reduite };
  } finally {
    URL.revokeObjectURL(url);
  }
}
