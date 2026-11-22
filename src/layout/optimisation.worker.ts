/// <reference lib="webworker" />
import type { Arbre } from '../model/types';
import { optimiserDisposition, type ResultatOptimisation } from './optimisation';

/** Calcul en arrière-plan : l'interface reste fluide pendant la recherche. */
export type MessageVersOptimiseur = { arbre: Arbre };
export type MessageDeOptimiseur =
  | { type: 'progression'; fait: number; total: number }
  | { type: 'fin'; resultat: ResultatOptimisation }
  | { type: 'erreur'; message: string };

const envoyer = (m: MessageDeOptimiseur) => postMessage(m);

onmessage = (e: MessageEvent<MessageVersOptimiseur>) => {
  try {
    let dernier = 0;
    const resultat = optimiserDisposition(e.data.arbre, {
      progression: (fait, total) => {
        const maintenant = performance.now();
        if (maintenant - dernier > 100) {
          dernier = maintenant;
          envoyer({ type: 'progression', fait, total });
        }
      },
    });
    envoyer({ type: 'fin', resultat });
  } catch (err) {
    envoyer({ type: 'erreur', message: err instanceof Error ? err.message : String(err) });
  }
};
