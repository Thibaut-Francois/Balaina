import type { DatePartielle, Qualificatif } from './types';

/** Écart (en années) pris en compte autour d'une date « vers ». */
const MARGE_VERS_ANNEES = 5;

export function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

export function joursDansMois(annee: number, mois: number): number {
  if (mois === 2) return estBissextile(annee) ? 29 : 28;
  return [4, 6, 9, 11].includes(mois) ? 30 : 31;
}

/** Vérifie la cohérence interne d'une date partielle. Renvoie un message d'erreur ou null. */
export function erreurDate(d: DatePartielle): string | null {
  if (!Number.isInteger(d.annee) || d.annee < 1 || d.annee > 9999) return 'Année invalide';
  if (d.jour !== undefined && d.mois === undefined) return 'Un jour nécessite un mois';
  if (d.mois !== undefined && (!Number.isInteger(d.mois) || d.mois < 1 || d.mois > 12)) return 'Mois invalide';
  if (d.jour !== undefined) {
    if (!Number.isInteger(d.jour) || d.jour < 1 || d.jour > joursDansMois(d.annee, d.mois!)) return 'Jour invalide';
  }
  return null;
}

const QUALIFICATIFS: [RegExp, Qualificatif][] = [
  [/^(vers|env\.?|environ|~|ca\.?|circa)\s*/i, 'vers'],
  [/^(avant|av\.?|<)\s*/i, 'avant'],
  [/^(après|apres|ap\.?|>)\s*/i, 'apres'],
];

export type ResultatAnalyse = { ok: true; date: DatePartielle | undefined } | { ok: false; erreur: string };

/**
 * Analyse une saisie libre : "1852", "vers 1790", "03/1915", "12/03/1950", "avant 1700", "après 1900".
 * Séparateurs acceptés : / - . et espace. Une saisie vide donne `undefined` (pas de date).
 */
export function analyserDate(saisie: string): ResultatAnalyse {
  let texte = saisie.trim();
  if (texte === '') return { ok: true, date: undefined };

  let qualificatif: Qualificatif | undefined;
  for (const [motif, q] of QUALIFICATIFS) {
    const m = texte.match(motif);
    if (m) {
      qualificatif = q;
      texte = texte.slice(m[0].length).trim();
      break;
    }
  }

  const morceaux = texte.split(/[\/\-.\s]+/).filter((s) => s !== '');
  if (morceaux.length === 0 || morceaux.length > 3 || !morceaux.every((s) => /^\d+$/.test(s))) {
    return { ok: false, erreur: 'Format attendu : JJ/MM/AAAA, MM/AAAA ou AAAA (avec « vers », « avant », « après »)' };
  }
  const nombres = morceaux.map(Number);
  const annee = nombres[nombres.length - 1]!;
  if (morceaux[morceaux.length - 1]!.length < 3) {
    return { ok: false, erreur: "L'année doit être écrite en entier (ex. 1852)" };
  }
  const date: DatePartielle = { annee };
  if (nombres.length >= 2) date.mois = nombres[nombres.length - 2];
  if (nombres.length === 3) date.jour = nombres[0];
  if (qualificatif) date.qualificatif = qualificatif;

  const err = erreurDate(date);
  if (err) return { ok: false, erreur: err };
  return { ok: true, date };
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

/** Partie numérique : "12/03/1950", "03/1915", "1852". */
export function formaterDateNue(d: DatePartielle): string {
  const parts: string[] = [];
  if (d.jour !== undefined) parts.push(deuxChiffres(d.jour));
  if (d.mois !== undefined) parts.push(deuxChiffres(d.mois));
  parts.push(String(d.annee));
  return parts.join('/');
}

const LIBELLES_QUALIF: Record<Qualificatif, string> = { vers: 'vers', avant: 'avant', apres: 'après' };

/** Forme lisible et ré-analysable : "vers 1790", "après 03/1915". */
export function formaterDate(d: DatePartielle): string {
  const nue = formaterDateNue(d);
  return d.qualificatif ? `${LIBELLES_QUALIF[d.qualificatif]} ${nue}` : nue;
}

/** Numéro de jour approximatif (assez précis pour comparer des dates). */
function numeroJour(annee: number, mois: number, jour: number): number {
  const d = new Date(0);
  d.setUTCFullYear(annee, mois - 1, jour); // gère aussi les années < 100
  return d.getTime() / 86_400_000;
}

function debutPeriode(d: DatePartielle): number {
  return numeroJour(d.annee, d.mois ?? 1, d.jour ?? 1);
}

function finPeriode(d: DatePartielle): number {
  const mois = d.mois ?? 12;
  const jour = d.jour ?? joursDansMois(d.annee, mois);
  return numeroJour(d.annee, mois, jour);
}

/** Intervalle [min, max] (en jours) dans lequel la date réelle se trouve certainement. */
export function intervalle(d: DatePartielle): [number, number] {
  const debut = debutPeriode(d);
  const fin = finPeriode(d);
  switch (d.qualificatif) {
    case 'avant':
      return [-Infinity, fin];
    case 'apres':
      return [debut, Infinity];
    case 'vers':
      return [debut - MARGE_VERS_ANNEES * 366, fin + MARGE_VERS_ANNEES * 366];
    default:
      return [debut, fin];
  }
}

/** Vrai seulement si `a` est certainement antérieure à `b` (aucun faux positif). */
export function estCertainementAvant(a: DatePartielle, b: DatePartielle): boolean {
  return intervalle(a)[1] < intervalle(b)[0];
}

/** Clé numérique pour trier des dates partielles (estimation ponctuelle). */
export function cleTri(d: DatePartielle): number {
  const debut = debutPeriode(d);
  switch (d.qualificatif) {
    case 'avant':
      return debut - 0.5;
    case 'apres':
      return finPeriode(d) + 0.5;
    default:
      return debut;
  }
}

export function comparerDates(a: DatePartielle, b: DatePartielle): number {
  return cleTri(a) - cleTri(b);
}
