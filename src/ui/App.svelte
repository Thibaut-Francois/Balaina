<script lang="ts">
  import { onMount } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import { importerJSON } from '../format/io';
  import { calculerPlacement } from '../layout/index';
  import { indexer } from '../model/index';
  import Arbre from './Arbre.svelte';
  import DialogueAjout from './DialogueAjout.svelte';
  import DialogueSuppression from './DialogueSuppression.svelte';
  import FichePersonne from './FichePersonne.svelte';
  import MenuPersonne from './MenuPersonne.svelte';
  import PanneauUnion from './PanneauUnion.svelte';
  import Recherche from './Recherche.svelte';
  import { nomAffiche } from './texte';
  import type { ModeAjout } from './types';

  const arbre = $derived(documentArbre.arbre);
  const placement = $derived(calculerPlacement(arbre));
  const idx = $derived(indexer(arbre));

  let vue: ReturnType<typeof Arbre> | undefined = $state();
  /** Personne mise en avant (fiche ouverte ou résultat de recherche). */
  let personneSelectionnee = $state<string | null>(null);
  let ficheOuverte = $state(false);
  let unionSelectionnee = $state<string | null>(null);
  let menu = $state<{ id: string; x: number; y: number } | null>(null);
  let ajout = $state<{ mode: ModeAjout; personneId?: string } | null>(null);
  let suppression = $state<string | null>(null);

  const personneFiche = $derived(ficheOuverte && personneSelectionnee ? idx.personnes.get(personneSelectionnee) : undefined);
  const unionPanneau = $derived(unionSelectionnee ? idx.unions.get(unionSelectionnee) : undefined);

  // Si la personne ou l'union disparaît (suppression, annuler), on ferme ce qui la concerne.
  $effect(() => {
    if (personneSelectionnee && !idx.personnes.has(personneSelectionnee)) {
      personneSelectionnee = null;
      ficheOuverte = false;
    }
    if (unionSelectionnee && !idx.unions.has(unionSelectionnee)) unionSelectionnee = null;
  });

  function toutFermer() {
    menu = null;
    ficheOuverte = false;
    personneSelectionnee = null;
    unionSelectionnee = null;
  }

  function ouvrirFiche(id: string) {
    unionSelectionnee = null;
    personneSelectionnee = id;
    ficheOuverte = true;
  }

  function choisirRecherche(id: string) {
    unionSelectionnee = null;
    personneSelectionnee = id;
    vue?.centrerSur(id);
  }

  const dansUnChamp = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  };

  onMount(() => {
    // En développement, `?exemple` charge l'arbre d'exemple (en attendant l'import, phase 4).
    const params = new URLSearchParams(location.search);
    if (import.meta.env.DEV && params.has('exemple')) {
      import('../../exemples/famille-complexe.json').then((m) => {
        const r = importerJSON(JSON.stringify(m.default));
        if (r.ok) documentArbre.remplacer(r.arbre);
      });
    }
    if (import.meta.env.DEV && params.has('graine')) {
      import('../../tests/invariants').then(({ arbreAleatoire }) =>
        documentArbre.remplacer(
          arbreAleatoire(Number(params.get('graine')), Number(params.get('taille') ?? 40), params.has('realiste')),
        ),
      );
    }
    const centre = params.get('centre');
    if (centre) setTimeout(() => vue?.centrerSur(centre, Number(params.get('zoom') ?? 1)), 100);
  });

  function clavier(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !dansUnChamp(e)) {
      const touche = e.key.toLowerCase();
      if (touche === 'z' && !e.shiftKey) {
        e.preventDefault();
        documentArbre.annuler();
      } else if (touche === 'y' || (touche === 'z' && e.shiftKey)) {
        e.preventDefault();
        documentArbre.retablir();
      }
    }
    if (e.key === 'Escape' && !ajout && !suppression && !menu) toutFermer();
  }
</script>

<svelte:window onkeydown={clavier} />

<div class="app">
  <header>
    <h1>Balaina</h1>
    {#if arbre.personnes.length > 0}
      <Recherche personnes={arbre.personnes} onchoisir={choisirRecherche} />
    {/if}
    <div class="groupe">
      <button type="button" class="bouton bouton-icone" disabled={!documentArbre.peutAnnuler} onclick={() => documentArbre.annuler()} title="Annuler (Ctrl+Z)" aria-label="Annuler">↶</button>
      <button type="button" class="bouton bouton-icone" disabled={!documentArbre.peutRetablir} onclick={() => documentArbre.retablir()} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↷</button>
    </div>
    {#if arbre.personnes.length > 0}
      <button type="button" class="bouton" onclick={() => vue?.ajuster()}>Ajuster à l'écran</button>
    {/if}
    {#if placement.avertissements.length > 0}
      <span class="avertissement" title={placement.avertissements.join('\n')}>
        ⚠ {placement.avertissements.length} union{placement.avertissements.length > 1 ? 's' : ''} dessinée{placement.avertissements.length > 1 ? 's' : ''} à part
      </span>
    {/if}
  </header>

  <main>
    {#if arbre.personnes.length === 0}
      <div class="vide">
        <p>L'arbre est vide.</p>
        <button type="button" class="bouton principal" onclick={() => (ajout = { mode: 'premiere' })}>Créer la première personne</button>
      </div>
    {:else}
      <Arbre
        bind:this={vue}
        {placement}
        {arbre}
        {personneSelectionnee}
        {unionSelectionnee}
        onclicpersonne={(id, x, y) => {
          unionSelectionnee = null;
          personneSelectionnee = id;
          menu = { id, x, y };
        }}
        onclicunion={(id) => {
          menu = null;
          ficheOuverte = false;
          personneSelectionnee = null;
          unionSelectionnee = id;
        }}
        onclicfond={toutFermer}
      />
    {/if}

    <!-- Recréé à chaque ouverture, pour se positionner au nouvel endroit -->
    {#key menu}
      {@const p = menu ? idx.personnes.get(menu.id) : undefined}
      {#if menu && p}
        <MenuPersonne
          x={menu.x}
          y={menu.y}
          nom={nomAffiche(p)}
          deuxParents={(idx.unions.get(idx.unionParente.get(p.id) ?? '')?.partenaires.length ?? 0) >= 2}
          onfermer={() => (menu = null)}
          onmodifier={() => ouvrirFiche(p.id)}
          onajouter={(mode) => (ajout = { mode, personneId: p.id })}
          onsupprimer={() => (suppression = p.id)}
        />
      {/if}
    {/key}

    {#if personneFiche}
      <FichePersonne personne={personneFiche} onfermer={() => (ficheOuverte = false)} />
    {:else if unionPanneau}
      <PanneauUnion union={unionPanneau} onfermer={() => (unionSelectionnee = null)} />
    {/if}
  </main>
</div>

{#if ajout}
  <DialogueAjout
    mode={ajout.mode}
    personneId={ajout.personneId}
    onfermer={() => (ajout = null)}
    onajoute={(id) => {
      if (ajout?.mode === 'premiere') ouvrirFiche(id);
      else personneSelectionnee = id;
    }}
  />
{/if}
{#if suppression}
  <DialogueSuppression personneId={suppression} onfermer={() => (suppression = null)} />
{/if}

<style>
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--bordure);
    background: var(--surface);
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.1rem;
    margin: 0 0.5rem 0 0;
  }
  .groupe {
    display: flex;
    gap: 0.25rem;
  }
  .avertissement {
    font-size: 0.85rem;
    color: var(--avertissement);
  }
  main {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .vide {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--texte-doux);
  }
</style>
