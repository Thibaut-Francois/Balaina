import type { ZodIssue } from 'zod';
import type { Arbre, DatePartielle, Personne, Union } from '../model/types';
import { valider, type Avertissement } from '../model/validate';
import { migrer } from './migrations';
import { FORMAT, schemaFichier, VERSION_ACTUELLE } from './schema';

// ---------- Export ----------

/** Copie une date avec un ordre de clés fixe, sans clés vides. */
function dateCanonique(d: DatePartielle): DatePartielle {
  const r: DatePartielle = { annee: d.annee };
  if (d.mois !== undefined) r.mois = d.mois;
  if (d.jour !== undefined) r.jour = d.jour;
  if (d.qualificatif !== undefined) r.qualificatif = d.qualificatif;
  return r;
}

const texteNonVide = (s: string | undefined) => s !== undefined && s !== '';

function personneCanonique(p: Personne): Personne {
  const r: Personne = { id: p.id, prenoms: p.prenoms, nom: p.nom };
  if (texteNonVide(p.autresNoms)) r.autresNoms = p.autresNoms;
  if (texteNonVide(p.genre)) r.genre = p.genre;
  if (p.naissance) r.naissance = dateCanonique(p.naissance);
  if (p.deces) r.deces = p.deces.date ? { decede: true, date: dateCanonique(p.deces.date) } : { decede: true };
  if (texteNonVide(p.notes)) r.notes = p.notes;
  return r;
}

function unionCanonique(u: Union): Union {
  // `enfants` en dernier pour la lisibilité du fichier
  return {
    id: u.id,
    partenaires: [...u.partenaires] as Union['partenaires'],
    type: u.type,
    ...(u.debut ? { debut: dateCanonique(u.debut) } : {}),
    ...(u.fin ? { fin: dateCanonique(u.fin) } : {}),
    enfants: [...u.enfants],
  };
}

/** Sérialise l'arbre en JSON lisible et stable (même arbre ⇒ même texte, hors date d'export). */
export function exporterJSON(arbre: Arbre, maintenant: Date = new Date()): string {
  const fichier = {
    format: FORMAT,
    version: VERSION_ACTUELLE,
    exporteLe: maintenant.toISOString(),
    personnes: arbre.personnes.map(personneCanonique),
    unions: arbre.unions.map(unionCanonique),
  };
  return JSON.stringify(fichier, null, 2) + '\n';
}

// ---------- Import ----------

export type ResultatImport =
  | { ok: true; arbre: Arbre; avertissements: Avertissement[] }
  | { ok: false; erreurs: string[] };

const NOMS_CHAMPS: Record<string, string> = {
  personnes: 'personnes',
  unions: 'unions',
  prenoms: 'prénoms',
  annee: 'année',
  naissance: 'naissance',
  deces: 'décès',
  debut: 'début',
};

function cheminLisible(chemin: (string | number)[]): string {
  return chemin
    .map((c) => (typeof c === 'number' ? `n°${c + 1}` : (NOMS_CHAMPS[c] ?? c)))
    .join(' › ');
}

function messageZod(issue: ZodIssue): string {
  const ou = issue.path.length > 0 ? cheminLisible(issue.path) : 'fichier';
  let quoi: string;
  switch (issue.code) {
    case 'invalid_type':
      quoi = issue.received === 'undefined' ? 'champ obligatoire manquant' : `type inattendu (${issue.received})`;
      break;
    case 'unrecognized_keys':
      quoi = `champ(s) inconnu(s) : ${issue.keys.join(', ')}`;
      break;
    case 'invalid_literal':
      quoi = `valeur attendue : ${JSON.stringify(issue.expected)}`;
      break;
    case 'invalid_enum_value':
      quoi = `valeur « ${String(issue.received)} » non reconnue (attendu : ${issue.options.join(', ')})`;
      break;
    default:
      quoi = issue.message;
  }
  return `${ou} : ${quoi}`;
}

/** Lit un texte JSON : analyse, migration, validation du schéma puis des règles métier. */
export function importerJSON(texte: string): ResultatImport {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreurs: ["Le fichier n'est pas un JSON valide."] };
  }
  if (typeof brut === 'object' && brut !== null && (brut as { format?: unknown }).format !== FORMAT) {
    return { ok: false, erreurs: ["Ce fichier n'est pas un arbre exporté par cette application."] };
  }
  const migration = migrer(brut);
  if (!migration.ok) return { ok: false, erreurs: [migration.erreur] };

  const analyse = schemaFichier.safeParse(migration.donnees);
  if (!analyse.success) {
    const erreurs = analyse.error.issues.slice(0, 20).map(messageZod);
    if (analyse.error.issues.length > 20) erreurs.push(`… et ${analyse.error.issues.length - 20} autre(s) erreur(s).`);
    return { ok: false, erreurs };
  }
  const arbre: Arbre = { personnes: analyse.data.personnes, unions: analyse.data.unions as Union[] };
  const rapport = valider(arbre);
  if (rapport.erreurs.length > 0) return { ok: false, erreurs: rapport.erreurs.map((e) => e.message) };
  return { ok: true, arbre, avertissements: rapport.avertissements };
}
