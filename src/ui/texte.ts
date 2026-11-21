import { formaterDate } from '../model/dates';
import type { Personne } from '../model/types';

export const POLICE_NOM = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const POLICE_DATES = '400 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function nomAffiche(p: Personne): string {
  return [p.prenoms, p.nom].map((s) => s.trim()).filter(Boolean).join(' ') || 'Sans nom';
}

/** Dates en notation généalogique : « ° 12/03/1950  † 04/07/2020 », « † » seul si décès sans date. */
export function datesAffichees(p: Personne): string {
  const parts: string[] = [];
  if (p.naissance) parts.push(`° ${formaterDate(p.naissance)}`);
  if (p.deces) parts.push(p.deces.date ? `† ${formaterDate(p.deces.date)}` : '†');
  return parts.join('   ');
}

let contexte: CanvasRenderingContext2D | null | undefined;
function mesurer(texte: string, police: string): number {
  if (contexte === undefined) contexte = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!contexte) return texte.length * 7; // hors navigateur : estimation
  contexte.font = police;
  return contexte.measureText(texte).width;
}

const cache = new Map<string, string>();

/** Tronque proprement un texte (avec « … ») pour qu'il tienne dans `largeurMax`. */
export function tronquer(texte: string, largeurMax: number, police: string): string {
  const cle = `${police}|${largeurMax}|${texte}`;
  const deja = cache.get(cle);
  if (deja !== undefined) return deja;
  let res = texte;
  if (mesurer(texte, police) > largeurMax) {
    let bas = 0,
      haut = texte.length;
    while (bas < haut) {
      const m = Math.ceil((bas + haut) / 2);
      if (mesurer(texte.slice(0, m).trimEnd() + '…', police) <= largeurMax) bas = m;
      else haut = m - 1;
    }
    res = texte.slice(0, bas).trimEnd() + '…';
  }
  cache.set(cle, res);
  return res;
}
