import type { Score, ResultatOptimisation } from '../layout/optimisation';
import type { MessageDeOptimiseur } from '../layout/optimisation.worker';
import type { Arbre } from '../model/types';

/** Lance la recherche de disposition dans un worker (l'interface reste fluide). `arreter` l'interrompt. */
export function lancerRecalcul(arbre: Arbre, progression: (part: number) => void) {
  const worker = new Worker(new URL('../layout/optimisation.worker.ts', import.meta.url), { type: 'module' });
  let rejeter: (e: Error) => void = () => {};
  const promesse = new Promise<ResultatOptimisation>((resoudre, rej) => {
    rejeter = rej;
    worker.onmessage = (e: MessageEvent<MessageDeOptimiseur>) => {
      const m = e.data;
      if (m.type === 'progression') progression(m.fait / m.total);
      else {
        worker.terminate();
        if (m.type === 'erreur') rej(new Error(m.message));
        else resoudre(m.resultat);
      }
    };
  });
  worker.postMessage({ arbre });
  return {
    promesse,
    arreter: () => {
      worker.terminate();
      rejeter(new Error('interrompu'));
    },
  };
}

export const decrireScore = (s: Score) =>
  `${s.croisements} croisement${s.croisements > 1 ? 's' : ''}` +
  (s.interdits > 0 ? ` dont ${s.interdits} entre unions d'une même personne` : '');

/** Message affiché après un recalcul. */
export function messageRecalcul(r: ResultatOptimisation): string {
  if (r.ordre)
    return r.apres.croisements < r.avant.croisements || r.apres.interdits < r.avant.interdits
      ? `Disposition recalculée : ${decrireScore(r.avant)} → ${decrireScore(r.apres)}. (Ctrl+Z pour revenir en arrière)`
      : 'Disposition recalculée : même nombre de croisements, traits plus courts. (Ctrl+Z pour revenir en arrière)';
  return r.avant.croisements === 0
    ? 'Aucun croisement : la disposition actuelle est déjà la meilleure.'
    : `Aucune meilleure disposition trouvée (${decrireScore(r.avant)}). Un nouvel essai peut explorer d'autres pistes.`;
}
