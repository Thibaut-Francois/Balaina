# Balaina — arbre généalogique local

Application web 100 % locale (aucun serveur distant, aucun compte, fonctionne hors ligne).
Les données ne quittent jamais l'ordinateur : **n'ajouter aucune requête réseau**, aucune police/CDN externe.

## Commandes
- `npm start` : build + serveur local + ouverture du navigateur (usage normal)
- `npm run dev` : serveur de développement
- `npm test` : tests unitaires (Vitest) ; `npm run test:watch`
- `npm run check` : vérification des types (svelte-check)

## Stack
Vite + TypeScript strict + Svelte 5 (runes). Rendu SVG. Zod pour valider les fichiers importés.
Placement de l'arbre écrit maison (pas d'ELK.js) : nos contraintes (partenaires sur la même ligne,
point d'union, couloirs au-dessus des cadres, écart de demi-fratrie) ne s'expriment pas dans ELK.

## Architecture
- `src/model/` : types, dates partielles, index de lecture, ordres (unions, enfants), validations. Fonctions pures.
- `src/format/` : schéma Zod du fichier, migrations de version, import/export JSON.
- `src/layout/` (phase 2) : placement pur et déterministe → `{ cadres, points, segments, bornes }`.
- `src/ui/` : composants Svelte. `src/export/` (phase 5) : PDF, PNG/JPEG, impression.
- `exemples/famille-complexe.json` : jeu de test de référence, à vérifier visuellement à chaque phase.

## Règles du modèle (ne pas enfreindre)
- Un enfant est rattaché à une **Union**, jamais directement à une personne. Un enfant appartient à au plus une union.
- Une union a 1 partenaire (autre parent inconnu) ou 2. Une personne peut avoir autant d'unions que nécessaire.
- `genre` est du texte libre, **sans aucun effet** sur les liens ou l'affichage.
- Vocabulaire neutre partout : parent, enfant, partenaire, union. Jamais père/mère/mari/femme.
- Bloquant : cycle d'ascendance, structure invalide. **Jamais bloquant** : incohérence de dates (simple avertissement).
- Ordre des tableaux `personnes` / `unions` = ordre de création. Il sert au placement stable : ne jamais retrier.
- Ordre des unions d'une personne : datées (début, sinon naissance du 1er enfant) triées, puis non datées en ordre de création.
- Ordre des enfants : datés par naissance (le tableau `enfants` départage), puis non datés dans l'ordre du tableau.

## Format de fichier
`{ format: "balaina-arbre", version, exporteLe, personnes, unions }`, JSON indenté, clés en ordre fixe.
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
