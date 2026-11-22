import type { Resultat } from '../model/commandes';
import { arbreVide, type Arbre } from '../model/types';
import { Historique } from './historique';

/**
 * État de l'arbre ouvert. Toute modification passe par `executer`, qui alimente l'historique
 * (annuler / rétablir) : aucune mutation directe de l'arbre ailleurs dans l'interface.
 */
class DocumentArbre {
  private historique = new Historique<Arbre>(arbreVide());
  /** Version : change à chaque modification (déclenche les recalculs). */
  version = $state(0);
  arbre = $state.raw<Arbre>(arbreVide());
  peutAnnuler = $state(false);
  peutRetablir = $state(false);

  private synchroniser() {
    this.arbre = this.historique.etat;
    this.peutAnnuler = this.historique.peutAnnuler;
    this.peutRetablir = this.historique.peutRetablir;
    this.version++;
  }

  /** Applique le résultat d'une commande. Renvoie le message d'erreur éventuel. */
  executer(resultat: Resultat, cleFusion?: string): { ok: true; id?: string } | { ok: false; erreur: string } {
    if (!resultat.ok) return resultat;
    if (resultat.arbre !== this.historique.etat) {
      this.historique.appliquer(resultat.arbre, cleFusion);
      this.synchroniser();
    }
    return { ok: true, ...(resultat.id ? { id: resultat.id } : {}) };
  }

  /** Arbre retrouvé au démarrage : remplace tout, sans historique (rien à annuler). */
  initialiser(arbre: Arbre) {
    this.historique = new Historique<Arbre>(arbre);
    this.synchroniser();
  }

  /** Remplace l'arbre entier (import, exemple). Annulable. */
  remplacer(arbre: Arbre) {
    this.historique.remplacer(arbre);
    this.synchroniser();
  }

  annuler() {
    if (this.historique.annuler()) this.synchroniser();
  }

  retablir() {
    if (this.historique.retablir()) this.synchroniser();
  }
}

export const documentArbre = new DocumentArbre();
