<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import type { MessageDeOptimiseur } from '../layout/optimisation.worker';
  import type { Score } from '../layout/optimisation';
  import { appliquerDisposition } from '../model/commandes';
  import Dialogue from './Dialogue.svelte';

  let props: { onfermer: () => void; oninformer: (texte: string, erreur?: boolean) => void } = $props();
  const arbre = untrack(() => documentArbre.arbre);
  let avancement = $state(0);
  let worker: Worker | undefined;

  const decrire = (s: Score) =>
    `${s.croisements} croisement${s.croisements > 1 ? 's' : ''}` +
    (s.interdits > 0 ? ` dont ${s.interdits} entre unions d'une même personne` : '');

  onMount(() => {
    worker = new Worker(new URL('../layout/optimisation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MessageDeOptimiseur>) => {
      const m = e.data;
      if (m.type === 'progression') avancement = m.fait / m.total;
      else if (m.type === 'erreur') {
        props.oninformer(`Le recalcul a échoué : ${m.message}`, true);
        props.onfermer();
      } else {
        const r = m.resultat;
        if (r.ordre && documentArbre.arbre === arbre) {
          documentArbre.executer(appliquerDisposition(arbre, r.ordre));
          props.oninformer(
            r.apres.croisements < r.avant.croisements || r.apres.interdits < r.avant.interdits
              ? `Disposition recalculée : ${decrire(r.avant)} → ${decrire(r.apres)}. (Ctrl+Z pour revenir en arrière)`
              : `Disposition recalculée : même nombre de croisements, traits plus courts. (Ctrl+Z pour revenir en arrière)`,
          );
        } else {
          props.oninformer(
            r.avant.croisements === 0
              ? 'Aucun croisement : la disposition actuelle est déjà la meilleure.'
              : `Aucune meilleure disposition trouvée (${decrire(r.avant)}). Un nouvel essai peut explorer d'autres pistes.`,
          );
        }
        props.onfermer();
      }
    };
    worker.postMessage({ arbre: $state.snapshot(arbre) });
    return () => worker?.terminate();
  });
</script>

<Dialogue titre="Recalcul de la disposition" onfermer={props.onfermer}>
  <p>Recherche d'une disposition des familles qui évite les traits qui se croisent…</p>
  <progress max="1" value={avancement} aria-label="Avancement">{Math.round(avancement * 100)} %</progress>
  <p class="aide">
    Toute la disposition peut changer. Elle est ensuite conservée : les personnes ajoutées plus tard se placent sans
    bouleverser le reste.
  </p>
  {#snippet actions()}
    <button type="button" class="bouton" onclick={props.onfermer}>Annuler</button>
  {/snippet}
</Dialogue>

<style>
  progress {
    width: 100%;
    height: 0.75rem;
  }
</style>
