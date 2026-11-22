import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { Placement } from '../layout/types';
import type { Arbre } from '../model/types';
import { mettreEnPage, type MiseEnPage, type OptionsPages } from './pagination';
import { policesBase64 } from './polices';
import { construireSvg, FAMILLE_EXPORT } from './svg';

/**
 * PDF vectoriel : le texte reste du texte (police embarquée), les traits restent des traits,
 * net à toute taille. Tout l'arbre est exporté, quelle que soit la partie visible à l'écran.
 */
export async function genererPdf(placement: Placement, arbre: Arbre, options: OptionsPages): Promise<{ blob: Blob; mise: MiseEnPage }> {
  const mise = mettreEnPage(placement.bornes, options);
  const orientation = mise.orientation === 'portrait' ? 'portrait' : 'landscape';
  const doc = new jsPDF({ unit: 'mm', format: [mise.papier.largeur, mise.papier.hauteur], orientation, compress: true });
  doc.setProperties({ title: 'Arbre généalogique', creator: 'Balaina' });

  const { regular, semibold } = await policesBase64();
  doc.addFileToVFS('Inter-Regular.ttf', regular);
  doc.addFont('Inter-Regular.ttf', FAMILLE_EXPORT, 'normal');
  doc.addFileToVFS('Inter-SemiBold.ttf', semibold);
  doc.addFont('Inter-SemiBold.ttf', FAMILLE_EXPORT, 'bold');

  // svg2pdf lit un élément SVG du document : on l'insère, invisible, le temps de la conversion.
  const hote = document.createElement('div');
  hote.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
  hote.innerHTML = construireSvg(placement, arbre);
  document.body.append(hote);
  const svg = hote.querySelector('svg')!;
  const b = placement.bornes;
  try {
    for (const [i, page] of mise.pages.entries()) {
      if (i > 0) doc.addPage([mise.papier.largeur, mise.papier.hauteur], orientation);
      if (options.mode === 'une-page') {
        await doc.svg(svg, { x: mise.placement.x, y: mise.placement.y, width: mise.placement.largeur, height: mise.placement.hauteur });
      } else {
        // Tout le dessin, décalé, puis limité à la zone utile (pas de débordement dans les marges).
        const { x, y, largeur, hauteur } = mise.placement;
        doc.saveGraphicsState();
        doc.rect(x, y, largeur, hauteur, null);
        doc.clip();
        doc.discardPath();
        await doc.svg(svg, {
          x: x + (b.x - page.zone.x) * mise.echelle,
          y: y + (b.y - page.zone.y) * mise.echelle,
          width: b.largeur * mise.echelle,
          height: b.hauteur * mise.echelle,
        });
        doc.restoreGraphicsState();
        if (mise.pages.length > 1) {
          doc.setFont(FAMILLE_EXPORT, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(
            `Page ${i + 1}/${mise.pages.length} — ligne ${page.ligne + 1}, colonne ${page.colonne + 1}`,
            mise.papier.largeur - x,
            mise.papier.hauteur - 4,
            { align: 'right' },
          );
        }
      }
    }
  } finally {
    hote.remove();
  }
  return { blob: doc.output('blob'), mise };
}
