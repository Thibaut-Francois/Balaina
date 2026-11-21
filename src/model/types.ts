/**
 * Modèle de données central.
 *
 * Règle d'or : un enfant n'est jamais rattaché directement à une personne,
 * mais à une Union. Correspondance GEDCOM : Personne = INDI, Union = FAM.
 */

export type Qualificatif = 'vers' | 'avant' | 'apres';

/** Date partielle : année obligatoire, mois et jour optionnels (jour ⇒ mois). */
export interface DatePartielle {
  annee: number;
  mois?: number;
  jour?: number;
  qualificatif?: Qualificatif;
}

export interface Deces {
  decede: true;
  date?: DatePartielle;
}

export interface Personne {
  /** Identifiant stable, ex. "P0001". L'ordre de création sert au placement déterministe. */
  id: string;
  prenoms: string;
  nom: string;
  /** Nom de naissance, d'usage… Visible dans la fiche, pas sur le cadre. */
  autresNoms?: string;
  /** Texte libre, sans aucun impact sur les liens ni sur l'affichage. */
  genre?: string;
  naissance?: DatePartielle;
  deces?: Deces;
  notes?: string;
}

export type TypeUnion = 'mariage' | 'pacs' | 'union_libre' | 'non_precise';

export const TYPES_UNION: readonly TypeUnion[] = ['mariage', 'pacs', 'union_libre', 'non_precise'];

export const LIBELLES_TYPE_UNION: Record<TypeUnion, string> = {
  mariage: 'Mariage',
  pacs: 'PACS',
  union_libre: 'Union libre',
  non_precise: 'Non précisé',
};

export interface Union {
  /** Identifiant stable, ex. "U0001". */
  id: string;
  /** 1 partenaire si l'autre parent est inconnu, 2 au maximum. */
  partenaires: [string] | [string, string];
  type: TypeUnion;
  debut?: DatePartielle;
  fin?: DatePartielle;
  /** Ordre manuel des enfants (départage les enfants sans date ou de même date). */
  enfants: string[];
}

/**
 * L'arbre complet. Les tableaux sont conservés dans l'ordre de création :
 * cet ordre est la base du placement stable et d'un fichier exporté lisible.
 */
export interface Arbre {
  personnes: Personne[];
  unions: Union[];
}

export const arbreVide = (): Arbre => ({ personnes: [], unions: [] });
