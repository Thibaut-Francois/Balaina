export type ModeAjout =
  | 'premiere'
  | 'parent'
  | 'enfant'
  | 'partenaire'
  /** Depuis une union : ajouter un enfant (nouveau ou existant) à cette fratrie. */
  | 'enfant-union'
  /** Depuis une union à un seul parent connu : ajouter l'autre parent. */
  | 'parent-union';
