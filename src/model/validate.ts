import { erreurDate, estCertainementAvant, formaterDate } from './dates';
import { indexer, type IndexArbre } from './index';
import type { Arbre, DatePartielle, Personne } from './types';

/** Problème bloquant : l'arbre est incohérent et ne peut pas être accepté. */
export interface Erreur {
  code:
    | 'id_duplique'
    | 'reference_inconnue'
    | 'partenaires_invalides'
    | 'enfant_multiple'
    | 'cycle'
    | 'date_invalide';
  message: string;
  ids: string[];
}

/** Incohérence probable signalée à l'utilisateur, jamais bloquante. */
export interface Avertissement {
  code: 'deces_avant_naissance' | 'enfant_avant_parent' | 'union_fin_avant_debut';
  message: string;
  ids: string[];
}

export interface RapportValidation {
  erreurs: Erreur[];
  avertissements: Avertissement[];
}

export const nomComplet = (p: Personne | undefined): string =>
  p ? [p.prenoms, p.nom].filter((s) => s.trim() !== '').join(' ') || '(sans nom)' : '(inconnu)';

/** Erreurs structurelles et cycles : tout ce qui rend l'arbre inutilisable. */
export function erreursStructure(arbre: Arbre): Erreur[] {
  const erreurs: Erreur[] = [];
  const idsVus = new Set<string>();
  for (const id of [...arbre.personnes.map((p) => p.id), ...arbre.unions.map((u) => u.id)]) {
    if (idsVus.has(id)) erreurs.push({ code: 'id_duplique', message: `Identifiant en double : ${id}`, ids: [id] });
    idsVus.add(id);
  }
  const personnes = new Set(arbre.personnes.map((p) => p.id));

  const verifierDate = (d: DatePartielle | undefined, quoi: string, id: string) => {
    if (!d) return;
    const e = erreurDate(d);
    if (e) erreurs.push({ code: 'date_invalide', message: `${quoi} : ${e}`, ids: [id] });
  };
  for (const p of arbre.personnes) {
    verifierDate(p.naissance, `Naissance de ${nomComplet(p)}`, p.id);
    verifierDate(p.deces?.date, `Décès de ${nomComplet(p)}`, p.id);
  }

  const parentDe = new Map<string, string>();
  for (const u of arbre.unions) {
    verifierDate(u.debut, `Début de l'union ${u.id}`, u.id);
    verifierDate(u.fin, `Fin de l'union ${u.id}`, u.id);
    const nb = u.partenaires.length;
    if (nb < 1 || nb > 2 || (nb === 2 && u.partenaires[0] === u.partenaires[1])) {
      erreurs.push({
        code: 'partenaires_invalides',
        message: `L'union ${u.id} doit avoir 1 ou 2 partenaires distincts`,
        ids: [u.id],
      });
    }
    for (const ref of [...u.partenaires, ...u.enfants]) {
      if (!personnes.has(ref)) {
        erreurs.push({
          code: 'reference_inconnue',
          message: `L'union ${u.id} fait référence à une personne inconnue : ${ref}`,
          ids: [u.id, ref],
        });
      }
    }
    for (const e of u.enfants) {
      const deja = parentDe.get(e);
      if (deja !== undefined) {
        erreurs.push({
          code: 'enfant_multiple',
          message: `${e} est enfant de deux unions (${deja} et ${u.id}) ou listé deux fois`,
          ids: [e, deja, u.id],
        });
      } else parentDe.set(e, u.id);
    }
  }
  if (erreurs.length > 0) return erreurs; // la détection de cycle suppose des références saines

  const cycle = trouverCycle(indexer(arbre));
  if (cycle) {
    const idx = indexer(arbre);
    erreurs.push({
      code: 'cycle',
      message: `Une personne ne peut pas être sa propre ascendante : ${cycle
        .map((id) => nomComplet(idx.personnes.get(id)))
        .join(' → ')}`,
      ids: cycle,
    });
  }
  return erreurs;
}

/**
 * Cherche un cycle d'ascendance (personne → parents → … → elle-même).
 * Renvoie le chemin du cycle ou null. DFS itératif à trois couleurs.
 */
export function trouverCycle(idx: IndexArbre): string[] | null {
  const BLANC = 0,
    GRIS = 1,
    NOIR = 2;
  const couleur = new Map<string, number>();
  const parents = (id: string): string[] => {
    const u = idx.unionParente.get(id);
    return u ? [...(idx.unions.get(u)?.partenaires ?? [])] : [];
  };
  for (const depart of idx.personnes.keys()) {
    if ((couleur.get(depart) ?? BLANC) !== BLANC) continue;
    const chemin: string[] = [];
    const pile: { id: string; suivants: string[] }[] = [{ id: depart, suivants: parents(depart) }];
    couleur.set(depart, GRIS);
    chemin.push(depart);
    while (pile.length > 0) {
      const sommet = pile[pile.length - 1]!;
      const suivant = sommet.suivants.shift();
      if (suivant === undefined) {
        couleur.set(sommet.id, NOIR);
        pile.pop();
        chemin.pop();
        continue;
      }
      const c = couleur.get(suivant) ?? BLANC;
      if (c === GRIS) {
        // Cycle : du point de rencontre jusqu'au sommet, sens descendant (ascendant → descendant).
        const debut = chemin.indexOf(suivant);
        return [...chemin.slice(debut), suivant].reverse();
      }
      if (c === BLANC) {
        couleur.set(suivant, GRIS);
        chemin.push(suivant);
        pile.push({ id: suivant, suivants: parents(suivant) });
      }
    }
  }
  return null;
}

/** Incohérences de dates : avertissements uniquement. */
export function avertissements(arbre: Arbre): Avertissement[] {
  const idx = indexer(arbre);
  const res: Avertissement[] = [];
  for (const p of arbre.personnes) {
    if (p.naissance && p.deces?.date && estCertainementAvant(p.deces.date, p.naissance)) {
      res.push({
        code: 'deces_avant_naissance',
        message: `${nomComplet(p)} : décès (${formaterDate(p.deces.date)}) avant la naissance (${formaterDate(p.naissance)})`,
        ids: [p.id],
      });
    }
  }
  for (const u of arbre.unions) {
    if (u.debut && u.fin && estCertainementAvant(u.fin, u.debut)) {
      res.push({
        code: 'union_fin_avant_debut',
        message: `Union ${u.id} : fin (${formaterDate(u.fin)}) avant le début (${formaterDate(u.debut)})`,
        ids: [u.id],
      });
    }
    for (const e of u.enfants) {
      const enfant = idx.personnes.get(e);
      if (!enfant?.naissance) continue;
      for (const pid of u.partenaires) {
        const parent = idx.personnes.get(pid);
        if (parent?.naissance && estCertainementAvant(enfant.naissance, parent.naissance)) {
          res.push({
            code: 'enfant_avant_parent',
            message: `${nomComplet(enfant)} est né·e (${formaterDate(enfant.naissance)}) avant son parent ${nomComplet(
              parent,
            )} (${formaterDate(parent.naissance)})`,
            ids: [enfant.id, parent.id],
          });
        }
      }
    }
  }
  return res;
}

export function valider(arbre: Arbre): RapportValidation {
  const erreurs = erreursStructure(arbre);
  return { erreurs, avertissements: erreurs.length > 0 ? [] : avertissements(arbre) };
}
