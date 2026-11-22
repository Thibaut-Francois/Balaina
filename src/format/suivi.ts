import type { Arbre } from '../model/types';
import { exporterJSON } from './io';

/** Empreinte du contenu d'un arbre (indépendante de la date d'export). */
export function signature(arbre: Arbre): string {
  return exporterJSON(arbre, new Date(0));
}

export interface EtatExport {
  /** Empreinte du dernier contenu exporté ou ouvert depuis un fichier (null : jamais). */
  signatureExportee: string | null;
  /** Instant (ISO) depuis lequel l'arbre diffère du dernier fichier ; null si à jour. */
  modifieDepuis: string | null;
}

/**
 * Met à jour l'état d'export après une modification de l'arbre.
 * Revenir exactement au contenu exporté (par ex. en annulant) rend l'arbre « à jour ».
 * Un arbre vide jamais exporté n'a rien à exporter.
 */
export function suivreModification(etat: EtatExport, arbre: Arbre, maintenant: Date): EtatExport {
  const vide = arbre.personnes.length === 0;
  const aJour = etat.signatureExportee === null ? vide : signature(arbre) === etat.signatureExportee;
  if (aJour) return { ...etat, modifieDepuis: null };
  return { ...etat, modifieDepuis: etat.modifieDepuis ?? maintenant.toISOString() };
}

export function marquerExporte(arbre: Arbre): EtatExport {
  return { signatureExportee: signature(arbre), modifieDepuis: null };
}

/** « le 22/11/2026 à 10:42 » */
export function formaterInstant(iso: string): string {
  const d = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `le ${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/** Nom de fichier proposé : arbre-genealogique-2026-11-22.json */
export function nomParDefaut(d = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `arbre-genealogique-${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}.json`;
}
