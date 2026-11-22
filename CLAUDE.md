# Balaina — arbre généalogique local

Application web 100 % locale (aucun serveur distant, aucun compte, fonctionne hors ligne).
Les données ne quittent jamais l'ordinateur : **n'ajouter aucune requête réseau**, aucune police/CDN externe.

## Commandes
- `npm start` : build + serveur local + ouverture du navigateur (usage normal)
- `npm run dev` : serveur de développement
- `npm test` : tests unitaires (Vitest) ; `npm run test:watch`
- `npm run test:e2e` : parcours de bout en bout dans un vrai navigateur (Playwright, `tests/e2e/`, lance son propre serveur sur le port 5174)
- `npm run check` : vérification des types (svelte-check)
- `node scripts/capture.mjs <url> <sortie.png> [l] [h]` : capture d'écran (Playwright) pour la vérification visuelle,
  avec `npm run dev` lancé. En dev, l'URL accepte `?exemple` (charger l'arbre d'exemple), `?centre=P0009&zoom=1`
  (centrer sur une personne) et `?graine=N&taille=T[&realiste]` (afficher un arbre aléatoire des tests).

## Déploiement
GitHub Pages via `.github/workflows/pages.yml` (tests + build à chaque push sur `main`). `base: './'` dans
`vite.config.ts` : chemins relatifs. Le site ne sert que les fichiers statiques ; les données restent dans le navigateur.

## Stack
Vite + TypeScript strict + Svelte 5 (runes). Rendu SVG. Zod pour valider les fichiers importés.
Placement de l'arbre écrit maison (pas d'ELK.js) : nos contraintes (partenaires sur la même ligne,
point d'union, couloirs au-dessus des cadres, écart de demi-fratrie) ne s'expriment pas dans ELK.

## Architecture
- `src/model/` : types, dates partielles, index de lecture, ordres (unions, enfants), validations. Fonctions pures.
  - `commandes.ts` : **toutes** les modifications (ajouter parent/enfant/partenaire, lier une personne existante,
    rattacher un enfant à une fratrie existante (`rattacherEnfant`), compléter une union à parent inconnu (`completerUnion`),
    modifier, supprimer, réordonner). Pures : renvoient un nouvel arbre ou une erreur lisible, vérifient la structure.
- `src/etat/` : `historique.ts` (annuler/rétablir, fusion de la frappe dans un même champ) et
  `document.svelte.ts` (état réactif). L'interface ne modifie l'arbre que via `documentArbre.executer(commande(...))`.
  - `sauvegarde.svelte.ts` : sauvegarde automatique dans IndexedDB (base `balaina`, stockée **au format du fichier
    exporté** pour bénéficier des migrations), suivi « modifications non exportées », ouvrir / enregistrer.
- `src/format/fichiers.ts` : File System Access (Chrome/Edge : « Enregistrer » réécrit le fichier ouvert, handle
  mémorisé dans IndexedDB) avec repli sur `<input type=file>` et téléchargement. `suivi.ts` : logique pure du suivi d'export.
- `src/format/` : schéma Zod du fichier, migrations de version, import/export JSON.
- `src/layout/` : placement pur et déterministe → `{ cadres, points, segments, bornes, avertissements }`.
  - `groupes.ts` : groupes de ligne (union-find sur les partenaires), générations (plus long chemin),
    linéarisation (1 union : voisins ; 2 : un de chaque côté ; 3+ : même côté, ordre chronologique).
    Cycles impossibles (union avec l'enfant de son partenaire, boucle d'unions) → union « coupée », reliée par un trait séparé + avertissement.
  - `placement.ts` : ordre des lignes de haut en bas (un groupe se range sous la famille d'un seul membre « principal »,
    choisi pour minimiser les croisements interdits), passe ascendante d'orientation, puis coordonnées x par
    régression isotonique (moindres carrés sous écarts minimaux), allers-retours haut/bas.
  - `optimisation.ts` (+ `optimisation.worker.ts`) : bouton « Recalculer ». Cherche l'ordre des groupes de chaque
    ligne qui minimise (croisements interdits, croisements, longueur des traits) : balayages par barycentre puis
    recherche locale, chaque essai évalué sur le placement réel. Déterministe (graine tirée de la disposition actuelle).
    Le résultat est stocké dans `arbre.affichage.ordre` (champ facultatif, format v2) : il fixe l'ordre des groupes
    qui y figurent ; les personnes ajoutées ensuite se placent près de leurs parents (stabilité préservée).
  - `routage.ts` : traits orthogonaux ; arches au-dessus des cadres pour les partenaires éloignés ; barres de fratrie
    dans des couloirs entre lignes (pistes attribuées pour limiter les croisements) ; relais pour les filiations longues.
- Tests du placement : `tests/invariants.ts` vérifie toutes les règles d'affichage ; il est appliqué à l'exemple,
  à 100 arbres aléatoires « réalistes » et à 100 arbres « chaotiques ». Toute modification du placement doit les garder verts.
- `src/ui/` : composants Svelte.
- `src/export/` : `svg.ts` construit un SVG autonome de tout l'arbre (fond blanc, couleurs fixes, attributs de
  présentation uniquement) utilisé par les trois sorties : `pdf.ts` (jsPDF + svg2pdf.js, vectoriel, chargé à la demande),
  `image.ts` (PNG/JPEG via canvas, polices intégrées en data URI, limites de taille du navigateur), `impression.ts`
  (zone `#zone-impression` + `@page`). L'impression est un des formats de la boîte « Exporter… » (Ctrl+P l'ouvre sur ce choix). `pagination.ts` : mise en page pure (format, orientation auto, une page ou
  taille réelle découpée en pages ; 1 px = 1/96 de pouce).
- Police : Inter (OFL, `src/assets/polices/`), embarquée. Famille `Inter Balaina` à l'écran (400/600) et
  `Inter Balaina Export` dans les exports (400 = normal, 700 = fichier SemiBold, pour correspondre au « bold » de jsPDF).
  Les troncatures sont mesurées avec cette police : attendre `chargerPolices()` avant tout rendu.
- `exemples/famille-complexe.json` : jeu de test de référence, à vérifier visuellement à chaque phase.

## Règles du modèle (ne pas enfreindre)
- Un enfant est rattaché à une **Union**, jamais directement à une personne. Un enfant appartient à au plus une union.
- Une union a 1 partenaire (autre parent inconnu) ou 2. Une personne peut avoir autant d'unions que nécessaire.
- `genre` est du texte libre, **sans aucun effet** sur les liens ou l'affichage.
- Vocabulaire neutre partout : parent, enfant, partenaire, union. Jamais père/mère/mari/femme.
- Bloquant : cycle d'ascendance, structure invalide. **Jamais bloquant** : incohérence de dates (simple avertissement).
- Ordre des tableaux `personnes` / `unions` = ordre de création. Il sert au placement stable : ne jamais retrier.
  La disposition recalculée vit à part, dans `affichage.ordre` (jamais en réordonnant les tableaux).
- Ordre des unions d'une personne : datées (début, sinon naissance du 1er enfant) triées, puis non datées en ordre de création.
- Ordre des enfants : datés par naissance (le tableau `enfants` départage), puis non datés dans l'ordre du tableau.

## Format de fichier
`{ format: "balaina-arbre", version: 2, exporteLe, personnes, unions, affichage? }` (v1 → v2 : ajout d'`affichage`), JSON indenté, clés en ordre fixe.
Pour changer le format : incrémenter `VERSION_ACTUELLE` (`src/format/schema.ts`), ajouter une migration
dans `src/format/migrations.ts`, garder un fichier de l'ancienne version dans les tests.
Le test d'aller-retour (export → import → export identique) doit toujours passer.

## Affichage (rappels clés)
- Une ligne par génération ; parent au-dessus ; partenaires sur la même ligne ; chaque personne affichée une seule fois.
- Union = petit point neutre sur le trait entre partenaires ; les enfants descendent du point.
- Tous les traits identiques (couleur, épaisseur, plein), uniquement horizontaux/verticaux, ne traversent jamais un cadre.
- 2 unions : un partenaire de chaque côté. 3+ : du même côté, ordre chronologique, traits au-dessus des cadres à hauteurs différentes.
- Écart entre demi-fratries nettement plus large qu'entre frères et sœurs.
- Aucune couleur ni forme liée au genre. Exports toujours sur fond blanc.

## Conventions
- Code et identifiants métier en français (`Personne`, `Union`, `enfantsOrdonnes`), textes d'interface en français.
- Logique dans des fonctions pures testées ; les composants Svelte restent minces.
- Un commit par étape fonctionnelle. Chaque phase est validée par l'utilisateur avant la suivante.
- Aucune fonctionnalité hors cahier des charges sans la proposer d'abord.
