<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { documentArbre } from '../etat/document.svelte';
  import { sauvegarde, type ResultatOuverture } from '../etat/sauvegarde.svelte';
  import { accesDirectDisponible } from '../format/fichiers';
  import { formaterInstant } from '../format/suivi';
  import { importerJSON } from '../format/io';
  import { calculerPlacement } from '../layout/index';
  import { indexer } from '../model/index';
  import Arbre from './Arbre.svelte';
  import DialogueAjout from './DialogueAjout.svelte';
  import DialogueExport from './DialogueExport.svelte';
  import DialogueOuverture from './DialogueOuverture.svelte';
  import DialogueRecalcul from './DialogueRecalcul.svelte';
  import DialogueSuppression from './DialogueSuppression.svelte';
  import FichePersonne from './FichePersonne.svelte';
  import MenuPersonne from './MenuPersonne.svelte';
  import PanneauUnion from './PanneauUnion.svelte';
  import Recherche from './Recherche.svelte';
  import { chargerPolices, nomAffiche } from './texte';
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
  let ajout = $state<{ mode: ModeAjout; personneId?: string; unionId?: string } | null>(null);
  let suppression = $state<string | null>(null);
  let exportation = $state<'exporter' | 'imprimer' | null>(null);
  let recalcul = $state(false);
  let ouverture = $state<Exclude<ResultatOuverture, { statut: 'annule' }> | null>(null);
  /** Message bref en bas de l'écran (enregistrement réussi, erreur…). */
  let message = $state<{ texte: string; erreur?: boolean } | null>(null);
  let minuterieMessage: ReturnType<typeof setTimeout> | undefined;
  function informer(texte: string, erreur = false) {
    message = { texte, erreur };
    clearTimeout(minuterieMessage);
    minuterieMessage = setTimeout(() => (message = null), erreur ? 8000 : 3500);
  }

  // Sauvegarde automatique : chaque modification est suivie.
  $effect(() => {
    void documentArbre.version;
    untrack(() => sauvegarde.surModification());
  });

  async function ouvrir() {
    try {
      const r = await sauvegarde.ouvrir();
      if (r.statut !== 'annule') ouverture = r;
    } catch (e) {
      informer(`Impossible de lire le fichier : ${e instanceof Error ? e.message : e}`, true);
    }
  }

  async function enregistrer(sousUnNouveauNom = false) {
    const r = await sauvegarde.enregistrer(sousUnNouveauNom);
    if (r.ok) informer(`Arbre enregistré dans « ${r.nom} ».`);
    else if (r.erreur) informer(`L'enregistrement a échoué : ${r.erreur}`, true);
  }

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

  onMount(async () => {
    await chargerPolices();
    await sauvegarde.demarrer();
    // En développement, `?exemple` charge l'arbre d'exemple.
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
    if (mod && e.key.toLowerCase() === 'p') {
      // Ctrl+P : nos options d'impression (format, pages) plutôt que l'impression brute de l'écran
      e.preventDefault();
      if (arbre.personnes.length > 0) exportation = 'imprimer';
      return;
    }
    if (mod && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'o')) {
      e.preventDefault();
      if (e.key.toLowerCase() === 's') enregistrer(e.shiftKey);
      else ouvrir();
      return;
    }
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
    <div class="groupe">
      <button type="button" class="bouton" onclick={ouvrir} title="Ouvrir un fichier d'arbre (Ctrl+O)">Ouvrir…</button>
      <button
        type="button"
        class="bouton"
        onclick={() => enregistrer()}
        disabled={arbre.personnes.length === 0 && !sauvegarde.nomFichier}
        title={sauvegarde.peutReecrire
          ? `Réécrire « ${sauvegarde.nomFichier} » (Ctrl+S)`
          : accesDirectDisponible()
            ? 'Choisir où enregistrer le fichier (Ctrl+S)'
            : 'Télécharger un fichier .json (Ctrl+S)'}>Enregistrer</button
      >
      {#if accesDirectDisponible()}
        <button type="button" class="bouton" onclick={() => enregistrer(true)} disabled={arbre.personnes.length === 0} title="Enregistrer dans un nouveau fichier (Ctrl+Maj+S)">Enregistrer sous…</button>
      {/if}
    </div>
    {#if arbre.personnes.length > 0}
      <Recherche personnes={arbre.personnes} onchoisir={choisirRecherche} />
    {/if}
    <div class="groupe">
      <button type="button" class="bouton bouton-icone" disabled={!documentArbre.peutAnnuler} onclick={() => documentArbre.annuler()} title="Annuler (Ctrl+Z)" aria-label="Annuler">↶</button>
      <button type="button" class="bouton bouton-icone" disabled={!documentArbre.peutRetablir} onclick={() => documentArbre.retablir()} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↷</button>
    </div>
    {#if arbre.personnes.length > 0}
      <button type="button" class="bouton" onclick={() => vue?.ajuster()}>Ajuster à l'écran</button>
      <button
        type="button"
        class="bouton"
        onclick={() => (recalcul = true)}
        title="Recalculer l'emplacement de toutes les personnes pour éviter les traits qui se croisent">Recalculer</button
      >
      <button type="button" class="bouton" onclick={() => (exportation = 'exporter')} title="PDF, PNG, JPEG ou impression de tout l'arbre (Ctrl+P : impression)">Exporter…</button>
    {/if}
    {#if placement.avertissements.length > 0}
      <span class="avertissement" title={placement.avertissements.join('\n')}>
        ⚠ {placement.avertissements.length} union{placement.avertissements.length > 1 ? 's' : ''} dessinée{placement.avertissements.length > 1 ? 's' : ''} à part
      </span>
    {/if}
    <span class="espace"></span>
    {#if sauvegarde.erreurStockage}
      <span class="etat-sauvegarde alerte" role="status">⚠ {sauvegarde.erreurStockage}</span>
    {:else if sauvegarde.modifieDepuis}
      <span
        class="etat-sauvegarde"
        role="status"
        title="Les modifications sont gardées automatiquement dans ce navigateur, mais ce stockage peut disparaître (nettoyage, autre navigateur…). Le fichier enregistré est la vraie sauvegarde."
        >● Modifications non exportées depuis {formaterInstant(sauvegarde.modifieDepuis)}</span
      >
    {:else if sauvegarde.nomFichier}
      <span class="etat-sauvegarde" role="status" title="Le contenu de l'arbre correspond au dernier fichier enregistré.">✓ {sauvegarde.nomFichier}</span>
    {/if}
  </header>

  <main>
    {#if !sauvegarde.chargee}
      <div class="vide">Chargement…</div>
    {:else if arbre.personnes.length === 0}
      <div class="vide">
        <p>L'arbre est vide.</p>
        <button type="button" class="bouton principal" onclick={() => (ajout = { mode: 'premiere' })}>Créer la première personne</button>
        <button type="button" class="bouton" onclick={ouvrir}>Ouvrir un fichier…</button>
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
      <PanneauUnion
        union={unionPanneau}
        onfermer={() => (unionSelectionnee = null)}
        onajouter={(mode) => (ajout = { mode, unionId: unionPanneau.id })}
      />
    {/if}
  </main>
</div>

{#if ajout}
  <DialogueAjout
    mode={ajout.mode}
    personneId={ajout.personneId}
    unionId={ajout.unionId}
    onfermer={() => (ajout = null)}
    onajoute={(id) => {
      if (ajout?.mode === 'premiere') ouvrirFiche(id);
      else personneSelectionnee = id;
    }}
  />
{/if}
{#if recalcul}
  <DialogueRecalcul onfermer={() => (recalcul = false)} oninformer={informer} />
{/if}
{#if exportation}
  <DialogueExport mode={exportation} {placement} onfermer={() => (exportation = null)} oninformer={informer} />
{/if}
{#if ouverture}
  <DialogueOuverture resultat={ouverture} onfermer={() => (ouverture = null)} />
{/if}
{#if message}
  <div class="message" class:erreur={message.erreur} role={message.erreur ? 'alert' : 'status'}>{message.texte}</div>
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
  .espace {
    flex: 1;
  }
  .etat-sauvegarde {
    font-size: 0.85rem;
    color: var(--texte-doux);
    cursor: help;
  }
  .etat-sauvegarde.alerte {
    color: var(--danger);
  }
  .message {
    position: fixed;
    left: 50%;
    bottom: 1.25rem;
    transform: translateX(-50%);
    padding: 0.6rem 1rem;
    border-radius: 8px;
    background: var(--texte);
    color: var(--fond);
    box-shadow: var(--ombre);
    max-width: min(600px, calc(100vw - 2rem));
    z-index: 50;
  }
  .message.erreur {
    background: var(--danger);
    color: #fff;
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
