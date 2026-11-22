import { VERSION_ACTUELLE } from './schema';

/**
 * Migrations du format de fichier.
 *
 * `MIGRATIONS[n]` transforme un objet en version n en objet en version n + 1.
 * Pour faire évoluer le format : incrémenter VERSION_ACTUELLE, ajouter la migration
 * correspondante ici, garder un fichier de test de l'ancienne version dans tests/fixtures.
 * Une migration ne doit jamais perdre d'information.
 */
type Migration = (ancien: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // v2 : ajout du champ facultatif `affichage` (disposition recalculée). Rien à transformer.
  1: (v1) => ({ ...v1, version: 2 }),
};

export type ResultatMigration = { ok: true; donnees: Record<string, unknown> } | { ok: false; erreur: string };

export function migrer(
  brut: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  cible: number = VERSION_ACTUELLE,
): ResultatMigration {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return { ok: false, erreur: "Le fichier ne contient pas un objet JSON d'arbre." };
  }
  let donnees = brut as Record<string, unknown>;
  const version = donnees.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, erreur: 'Numéro de version du format absent ou invalide.' };
  }
  if (version > cible) {
    return {
      ok: false,
      erreur: `Ce fichier a été créé par une version plus récente de l'application (format v${version}, cette application lit jusqu'à v${cible}).`,
    };
  }
  for (let v = version; v < cible; v++) {
    const m = migrations[v];
    if (!m) return { ok: false, erreur: `Aucune migration disponible du format v${v} vers v${v + 1}.` };
    donnees = m(donnees);
  }
  return { ok: true, donnees };
}
