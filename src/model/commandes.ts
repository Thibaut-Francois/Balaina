import { enfantsOrdonnes, estAscendant, indexer, parentsDe } from './index';
import type { Arbre, Personne, TypeUnion, Union } from './types';
import { erreursStructure, nomComplet } from './validate';

/**
 * Commandes de modification de l'arbre. Fonctions pures : elles ne modifient jamais l'arbre reçu
 * et renvoient un nouvel arbre (ou une erreur lisible). Ne suppriment jamais une autre personne.
 */

export type DonneesPersonne = Omit<Personne, 'id'>;
/** Une personne existante (lier) ou une nouvelle personne à créer. */
export type RefPersonne = { id: string } | { nouvelle: DonneesPersonne };

export type Resultat = { ok: true; arbre: Arbre; id?: string } | { ok: false; erreur: string };

const echec = (erreur: string): Resultat => ({ ok: false, erreur });

function prochainId(ids: string[], prefixe: 'P' | 'U'): string {
  let max = 0;
  for (const id of ids) {
    const m = id.match(/^[A-Z](\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefixe}${String(max + 1).padStart(4, '0')}`;
}

const nouvelIdUnion = (a: Arbre) => prochainId(a.unions.map((u) => u.id), 'U');

/** Supprime les champs vides (undefined ou chaîne vide) pour garder des données propres. */
function nettoyer(p: Personne): Personne {
  const r = { ...p } as Record<string, unknown>;
  for (const k of Object.keys(r)) if (r[k] === undefined || (k !== 'prenoms' && k !== 'nom' && r[k] === '')) delete r[k];
  return r as unknown as Personne;
}

/** Vérifie l'arbre obtenu : aucune commande ne doit produire un arbre incohérent. */
function conclure(arbre: Arbre, id?: string): Resultat {
  const erreurs = erreursStructure(arbre);
  if (erreurs.length > 0) return echec(erreurs[0]!.message);
  return { ok: true, arbre, ...(id ? { id } : {}) };
}

function resoudre(arbre: Arbre, ref: RefPersonne): { arbre: Arbre; id: string } | { erreur: string } {
  if ('id' in ref) {
    if (!arbre.personnes.some((p) => p.id === ref.id)) return { erreur: 'Personne introuvable.' };
    return { arbre, id: ref.id };
  }
  const id = prochainId(arbre.personnes.map((p) => p.id), 'P');
  const personne = nettoyer({ ...ref.nouvelle, id, prenoms: ref.nouvelle.prenoms.trim(), nom: ref.nouvelle.nom.trim() });
  return { arbre: { ...arbre, personnes: [...arbre.personnes, personne] }, id };
}

const nom = (a: Arbre, id: string) => nomComplet(a.personnes.find((p) => p.id === id));

// ---------- Personnes ----------

export function creerPersonne(arbre: Arbre, donnees: DonneesPersonne): Resultat {
  const r = resoudre(arbre, { nouvelle: donnees });
  if ('erreur' in r) return echec(r.erreur);
  return conclure(r.arbre, r.id);
}

/** Modifie des champs ; une valeur `undefined` efface le champ. */
export function modifierPersonne(arbre: Arbre, id: string, modifs: Partial<DonneesPersonne>): Resultat {
  const i = arbre.personnes.findIndex((p) => p.id === id);
  if (i < 0) return echec('Personne introuvable.');
  const personnes = [...arbre.personnes];
  personnes[i] = nettoyer({ ...personnes[i]!, ...modifs, id });
  return conclure({ ...arbre, personnes }, id);
}

/** Ajoute un parent : crée l'union parente si besoin, ou complète celle qui n'a qu'un parent connu. */
export function ajouterParent(arbre: Arbre, enfantId: string, parent: RefPersonne): Resultat {
  if ('id' in parent && parent.id === enfantId) return echec('Une personne ne peut pas être son propre parent.');
  const idx = indexer(arbre);
  if ('id' in parent && estAscendant(idx, enfantId, parent.id))
    return echec(`${nom(arbre, parent.id)} est un descendant de ${nom(arbre, enfantId)} : ce lien créerait une boucle.`);
  const uid = idx.unionParente.get(enfantId);
  const union = uid ? idx.unions.get(uid)! : undefined;
  if (union && union.partenaires.length >= 2) return echec(`${nom(arbre, enfantId)} a déjà deux parents.`);
  if (union && 'id' in parent && union.partenaires[0] === parent.id) return echec('Cette personne est déjà parent.');

  const r = resoudre(arbre, parent);
  if ('erreur' in r) return echec(r.erreur);
  let unions: Union[];
  if (union) {
    unions = r.arbre.unions.map((u) => (u.id === union.id ? { ...u, partenaires: [u.partenaires[0], r.id] } : u));
  } else {
    unions = [...r.arbre.unions, { id: nouvelIdUnion(r.arbre), partenaires: [r.id], type: 'non_precise', enfants: [enfantId] }];
  }
  return conclure({ ...r.arbre, unions }, r.id);
}

/** Où rattacher un nouvel enfant. */
export type CibleEnfant = { union: string } | { partenaire: RefPersonne } | { autreParentInconnu: true };

export function ajouterEnfant(arbre: Arbre, parentId: string, cible: CibleEnfant, enfant: RefPersonne): Resultat {
  const idx = indexer(arbre);
  if ('id' in enfant) {
    if (enfant.id === parentId) return echec('Une personne ne peut pas être son propre enfant.');
    if (idx.unionParente.has(enfant.id))
      return echec(`${nom(arbre, enfant.id)} a déjà des parents dans l'arbre.`);
    if (estAscendant(idx, enfant.id, parentId))
      return echec(`${nom(arbre, enfant.id)} est un ascendant de ${nom(arbre, parentId)} : ce lien créerait une boucle.`);
  }
  let courant = arbre;
  let unionId: string;
  if ('union' in cible) {
    const u = idx.unions.get(cible.union);
    if (!u || !u.partenaires.includes(parentId)) return echec('Union introuvable.');
    unionId = u.id;
  } else {
    let partenaires: Union['partenaires'] = [parentId];
    if ('partenaire' in cible) {
      if ('id' in cible.partenaire && cible.partenaire.id === parentId) return echec('Choisissez un autre partenaire.');
      const rp = resoudre(courant, cible.partenaire);
      if ('erreur' in rp) return echec(rp.erreur);
      courant = rp.arbre;
      partenaires = [parentId, rp.id];
    }
    unionId = nouvelIdUnion(courant);
    courant = { ...courant, unions: [...courant.unions, { id: unionId, partenaires, type: 'non_precise', enfants: [] }] };
  }
  const re = resoudre(courant, enfant);
  if ('erreur' in re) return echec(re.erreur);
  const unions = re.arbre.unions.map((u) => (u.id === unionId ? { ...u, enfants: [...u.enfants, re.id] } : u));
  return conclure({ ...re.arbre, unions }, re.id);
}

/** Ajoute un partenaire : crée toujours une nouvelle union. */
export function ajouterPartenaire(arbre: Arbre, personneId: string, partenaire: RefPersonne): Resultat {
  if ('id' in partenaire && partenaire.id === personneId) return echec('Choisissez une autre personne.');
  const r = resoudre(arbre, partenaire);
  if ('erreur' in r) return echec(r.erreur);
  const union: Union = { id: nouvelIdUnion(r.arbre), partenaires: [personneId, r.id], type: 'non_precise', enfants: [] };
  return conclure({ ...r.arbre, unions: [...r.arbre.unions, union] }, r.id);
}

/** Description lisible des liens d'une personne, pour la confirmation de suppression. */
export function liensDePersonne(arbre: Arbre, id: string): string[] {
  const idx = indexer(arbre);
  const liens: string[] = [];
  const parents = parentsDe(idx, id);
  if (parents.length > 0) liens.push(`Enfant de ${parents.map((p) => nom(arbre, p)).join(' et ')}`);
  for (const uid of idx.unionsDe.get(id) ?? []) {
    const u = idx.unions.get(uid)!;
    const autre = u.partenaires.find((p) => p !== id);
    const qui = autre ? `avec ${nom(arbre, autre)}` : 'avec un autre parent inconnu';
    const n = u.enfants.length;
    const enfants = enfantsOrdonnes(idx, u).map((e) => nom(arbre, e)).join(', ');
    liens.push(`Union ${qui}${n > 0 ? ` (${n} enfant${n > 1 ? 's' : ''} : ${enfants})` : ''}`);
  }
  return liens;
}

/**
 * Supprime une personne et ses liens, jamais une autre personne.
 * Ses unions perdent ce partenaire ; une union qui n'a plus aucun partenaire est supprimée
 * (ses enfants restent dans l'arbre, sans parents).
 */
export function supprimerPersonne(arbre: Arbre, id: string): Resultat {
  if (!arbre.personnes.some((p) => p.id === id)) return echec('Personne introuvable.');
  const unions: Union[] = [];
  for (const u of arbre.unions) {
    const enfants = u.enfants.filter((e) => e !== id);
    const partenaires = u.partenaires.filter((p) => p !== id);
    if (partenaires.length === 0) continue;
    unions.push({ ...u, partenaires: partenaires as Union['partenaires'], enfants });
  }
  return conclure({ personnes: arbre.personnes.filter((p) => p.id !== id), unions });
}

// ---------- Unions ----------

export interface ModifsUnion {
  type?: TypeUnion;
  debut?: Union['debut'] | null;
  fin?: Union['fin'] | null;
}

export function modifierUnion(arbre: Arbre, id: string, modifs: ModifsUnion): Resultat {
  const i = arbre.unions.findIndex((u) => u.id === id);
  if (i < 0) return echec('Union introuvable.');
  const u: Union = { ...arbre.unions[i]! };
  if (modifs.type) u.type = modifs.type;
  for (const champ of ['debut', 'fin'] as const) {
    if (!(champ in modifs)) continue;
    const v = modifs[champ];
    if (v) u[champ] = v;
    else delete u[champ];
  }
  const unions = [...arbre.unions];
  unions[i] = u;
  return conclure({ ...arbre, unions });
}

/** Supprime une union : ses partenaires et ses enfants restent dans l'arbre. */
export function supprimerUnion(arbre: Arbre, id: string): Resultat {
  if (!arbre.unions.some((u) => u.id === id)) return echec('Union introuvable.');
  return conclure({ ...arbre, unions: arbre.unions.filter((u) => u.id !== id) });
}

/**
 * Déplace un enfant sans date de naissance d'un cran vers la gauche (-1) ou la droite (+1)
 * parmi les enfants sans date (les enfants datés sont toujours triés par naissance).
 */
export function deplacerEnfant(arbre: Arbre, unionId: string, enfantId: string, sens: -1 | 1): Resultat {
  const idx = indexer(arbre);
  const u = idx.unions.get(unionId);
  if (!u) return echec('Union introuvable.');
  const ordre = enfantsOrdonnes(idx, u);
  const sansDate = ordre.filter((e) => !idx.personnes.get(e)?.naissance);
  const i = sansDate.indexOf(enfantId);
  const j = i + sens;
  if (i < 0) return echec('Seuls les enfants sans date de naissance se réordonnent à la main.');
  if (j < 0 || j >= sansDate.length) return { ok: true, arbre };
  [sansDate[i], sansDate[j]] = [sansDate[j]!, sansDate[i]!];
  const dates = ordre.filter((e) => idx.personnes.get(e)?.naissance);
  const unions = arbre.unions.map((x) => (x.id === unionId ? { ...x, enfants: [...dates, ...sansDate] } : x));
  return conclure({ ...arbre, unions });
}
