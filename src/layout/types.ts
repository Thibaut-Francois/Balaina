export interface CadrePlace {
  id: string;
  x: number;
  y: number;
  ligne: number;
}

export interface PointPlace {
  unionId: string;
  x: number;
  y: number;
}

/** Segment horizontal ou vertical. Tous les traits ont le même aspect à l'écran. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  unionId: string;
  nature: 'union' | 'filiation';
}

export interface Placement {
  cadres: CadrePlace[];
  points: PointPlace[];
  segments: Segment[];
  bornes: { x: number; y: number; largeur: number; hauteur: number };
  largeurCadre: number;
  hauteurCadre: number;
  /** Cas où les règles de placement n'ont pas pu être toutes respectées. */
  avertissements: string[];
}
