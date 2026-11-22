import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import {
  accesDirectDisponible,
  choisirFichierAOuvrir,
  choisirOuEnregistrer,
  ecrireFichier,
  telecharger,
} from '../format/fichiers';
import { exporterJSON, importerJSON } from '../format/io';
import { marquerExporte, nomParDefaut, suivreModification, type EtatExport } from '../format/suivi';
import type { Arbre } from '../model/types';
import type { Avertissement } from '../model/validate';
import { documentArbre } from './document.svelte';

/**
 * Sauvegarde automatique dans le navigateur (IndexedDB) et lien avec le fichier exporté.
 * Rien ne quitte l'ordinateur : IndexedDB est un stockage local du navigateur.
 */

interface EtatStocke extends EtatExport {
  version: 1;
  /** L'arbre, au format du fichier exporté (les migrations s'appliquent donc aussi ici). */
  texte: string;
  nomFichier: string | null;
}

const CLE_ETAT = 'etat';
const CLE_FICHIER = 'fichier';
const DELAI_ECRITURE = 250;

export type ResultatOuverture =
  | { statut: 'annule' }
  | { statut: 'invalide'; nom: string; erreurs: string[] }
  | { statut: 'pret'; nom: string; arbre: Arbre; avertissements: Avertissement[]; confirmer: () => void };

class Sauvegarde {
  chargee = $state(false);
  modifieDepuis = $state<string | null>(null);
  nomFichier = $state<string | null>(null);
  /** Problème de stockage local (navigation privée, quota…) : l'utilisateur doit être prévenu. */
  erreurStockage = $state<string | null>(null);

  private store: UseStore | undefined;
  private signatureExportee: string | null = null;
  private handle = $state.raw<FileSystemFileHandle | null>(null);
  private minuterie: ReturnType<typeof setTimeout> | undefined;
  private derniereVersion = -1;

  private get magasin(): UseStore {
    this.store ??= createStore('balaina', 'sauvegarde');
    return this.store;
  }

  /** Au démarrage : retrouve l'arbre sauvegardé, puis suit chaque modification. */
  async demarrer(): Promise<void> {
    try {
      const etat = await get<EtatStocke>(CLE_ETAT, this.magasin);
      if (etat) {
        const r = importerJSON(etat.texte);
        if (r.ok) {
          documentArbre.initialiser(r.arbre);
          this.signatureExportee = etat.signatureExportee;
          this.modifieDepuis = etat.modifieDepuis;
          this.nomFichier = etat.nomFichier;
        } else {
          this.erreurStockage = `La sauvegarde du navigateur est illisible : ${r.erreurs[0]}`;
        }
      }
      this.handle = (await get<FileSystemFileHandle>(CLE_FICHIER, this.magasin)) ?? null;
      // Demande au navigateur de ne pas effacer ce stockage de lui-même (sans garantie).
      navigator.storage?.persist?.().catch(() => {});
    } catch {
      this.erreurStockage =
        "Le stockage du navigateur n'est pas disponible (navigation privée ?) : pensez à enregistrer un fichier.";
    }
    this.derniereVersion = documentArbre.version;
    this.chargee = true;
    addEventListener('pagehide', () => this.ecrireMaintenant());
  }

  /** À appeler à chaque changement de l'arbre (effet dans l'interface). */
  surModification(): void {
    if (!this.chargee || documentArbre.version === this.derniereVersion) return;
    this.derniereVersion = documentArbre.version;
    const etat = suivreModification(this.etatExport(), documentArbre.arbre, new Date());
    this.modifieDepuis = etat.modifieDepuis;
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.ecrireMaintenant(), DELAI_ECRITURE);
  }

  private etatExport(): EtatExport {
    return { signatureExportee: this.signatureExportee, modifieDepuis: this.modifieDepuis };
  }

  private ecrireMaintenant(): void {
    if (!this.chargee) return;
    clearTimeout(this.minuterie);
    const etat: EtatStocke = {
      version: 1,
      texte: exporterJSON(documentArbre.arbre),
      nomFichier: this.nomFichier,
      ...this.etatExport(),
    };
    set(CLE_ETAT, etat, this.magasin).then(
      () => (this.erreurStockage = null),
      () =>
        (this.erreurStockage =
          "La sauvegarde automatique dans le navigateur a échoué : enregistrez un fichier pour ne rien perdre."),
    );
  }

  private retenirFichier(nom: string | null, handle: FileSystemFileHandle | null): void {
    this.nomFichier = nom;
    this.handle = handle;
    const op = handle ? set(CLE_FICHIER, handle, this.magasin) : del(CLE_FICHIER, this.magasin);
    op.catch(() => {});
  }

  private marquerAJour(arbre: Arbre): void {
    const e = marquerExporte(arbre);
    this.signatureExportee = e.signatureExportee;
    this.modifieDepuis = null;
    this.ecrireMaintenant();
  }

  // ---------- Fichiers ----------

  /** Ouvre un fichier ; l'arbre n'est remplacé qu'après `confirmer()`. */
  async ouvrir(): Promise<ResultatOuverture> {
    const lu = await choisirFichierAOuvrir();
    if (!lu) return { statut: 'annule' };
    const r = importerJSON(lu.texte);
    if (!r.ok) return { statut: 'invalide', nom: lu.nom, erreurs: r.erreurs };
    return {
      statut: 'pret',
      nom: lu.nom,
      arbre: r.arbre,
      avertissements: r.avertissements,
      confirmer: () => {
        documentArbre.remplacer(r.arbre);
        this.derniereVersion = documentArbre.version;
        this.retenirFichier(lu.nom, lu.handle ?? null);
        this.marquerAJour(r.arbre);
      },
    };
  }

  /**
   * Enregistrer : réécrit le fichier ouvert (Chrome / Edge), sinon demande où enregistrer ;
   * sur les autres navigateurs, télécharge un nouveau fichier.
   */
  async enregistrer(sousUnNouveauNom = false): Promise<{ ok: true; nom: string } | { ok: false; erreur?: string }> {
    const arbre = documentArbre.arbre;
    const texte = exporterJSON(arbre);
    const nom = this.nomFichier ?? nomParDefaut();
    try {
      if (accesDirectDisponible()) {
        let handle = sousUnNouveauNom ? null : this.handle;
        if (!handle) {
          handle = await choisirOuEnregistrer(nom);
          if (!handle) return { ok: false };
        }
        await ecrireFichier(handle, texte);
        this.retenirFichier(handle.name, handle);
      } else {
        telecharger(texte, nom);
        this.retenirFichier(nom, null);
      }
    } catch (e) {
      return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
    }
    this.marquerAJour(arbre);
    return { ok: true, nom: this.nomFichier ?? nom };
  }

  get peutReecrire(): boolean {
    return this.handle !== null && accesDirectDisponible();
  }
}

export const sauvegarde = new Sauvegarde();
