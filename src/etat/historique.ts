/**
 * Historique annuler / rétablir, générique et sans dépendance à l'interface.
 * Chaque état est une valeur immuable ; on conserve les états précédents (arbres de quelques
 * centaines de personnes : quelques Mo au pire, largement acceptable).
 *
 * Fusion : des modifications successives portant la même `cleFusion` à moins de `delaiFusion` ms
 * (ex. la frappe dans un champ) ne forment qu'une seule étape d'annulation.
 */
export class Historique<T> {
  private passe: T[] = [];
  private futur: T[] = [];
  private derniereCle: string | undefined;
  private dernierInstant = 0;

  constructor(
    private courant: T,
    private readonly limite = 200,
    private readonly delaiFusion = 1500,
  ) {}

  get etat(): T {
    return this.courant;
  }
  get peutAnnuler(): boolean {
    return this.passe.length > 0;
  }
  get peutRetablir(): boolean {
    return this.futur.length > 0;
  }

  appliquer(nouveau: T, cleFusion?: string, maintenant = Date.now()): void {
    const fusion =
      cleFusion !== undefined && cleFusion === this.derniereCle && maintenant - this.dernierInstant < this.delaiFusion;
    if (!fusion) {
      this.passe.push(this.courant);
      if (this.passe.length > this.limite) this.passe.shift();
    }
    this.courant = nouveau;
    this.futur = [];
    this.derniereCle = cleFusion;
    this.dernierInstant = maintenant;
  }

  annuler(): boolean {
    const precedent = this.passe.pop();
    if (precedent === undefined) return false;
    this.futur.push(this.courant);
    this.courant = precedent;
    this.derniereCle = undefined;
    return true;
  }

  retablir(): boolean {
    const suivant = this.futur.pop();
    if (suivant === undefined) return false;
    this.passe.push(this.courant);
    this.courant = suivant;
    this.derniereCle = undefined;
    return true;
  }

  /** Remplace tout (ex. import d'un fichier) ; l'opération reste annulable. */
  remplacer(nouveau: T): void {
    this.appliquer(nouveau);
  }
}
