import { describe, expect, it } from 'vitest';
import {
  ajouterEnfant,
  ajouterParent,
  ajouterPartenaire,
  completerUnion,
  rattacherEnfant,
  creerPersonne,
  deplacerEnfant,
  liensDePersonne,
  modifierPersonne,
  modifierUnion,
  supprimerPersonne,
  supprimerUnion,
  type Resultat,
} from '../src/model/commandes';
import { enfantsOrdonnes, indexer } from '../src/model/index';
import { arbreVide, type Arbre } from '../src/model/types';
import { chargerExemple } from './aides';

const ok = (r: Resultat) => {
  if (!r.ok) throw new Error(r.erreur);
  return r;
};
const nouvelle = (prenoms: string, annee?: number) => ({
  nouvelle: { prenoms, nom: 'Test', ...(annee ? { naissance: { annee } } : {}) },
});

describe('créer et modifier', () => {
  it('première personne dans un arbre vide', () => {
    const r = ok(creerPersonne(arbreVide(), { prenoms: ' Alix ', nom: 'Martin' }));
    expect(r.arbre.personnes).toEqual([{ id: 'P0001', prenoms: 'Alix', nom: 'Martin' }]);
    expect(r.id).toBe('P0001');
  });

  it('modification immédiate, champ vidé = champ supprimé', () => {
    let a = ok(creerPersonne(arbreVide(), { prenoms: 'A', nom: 'B', notes: 'x' })).arbre;
    a = ok(modifierPersonne(a, 'P0001', { notes: '', naissance: { annee: 1950 } })).arbre;
    expect(a.personnes[0]).toEqual({ id: 'P0001', prenoms: 'A', nom: 'B', naissance: { annee: 1950 } });
  });

  it('ne modifie jamais l’arbre reçu', () => {
    const a = chargerExemple();
    const copie = structuredClone(a);
    ajouterEnfant(a, 'P0009', { union: 'U0007' }, nouvelle('X'));
    supprimerPersonne(a, 'P0009');
    expect(a).toEqual(copie);
  });
});

describe('ajouter un parent', () => {
  it('sans parents : crée une union avec ce parent', () => {
    let a = ok(creerPersonne(arbreVide(), { prenoms: 'E', nom: '' })).arbre;
    const r = ok(ajouterParent(a, 'P0001', nouvelle('Parent1')));
    a = r.arbre;
    expect(a.unions).toEqual([{ id: 'U0001', partenaires: ['P0002'], type: 'non_precise', enfants: ['P0001'] }]);
  });

  it('avec un seul parent connu : devient le second partenaire de cette union', () => {
    const a = chargerExemple(); // Maël (P0023) : union U0011 avec Hugo seul
    const r = ok(ajouterParent(a, 'P0023', nouvelle('Autre parent')));
    expect(r.arbre.unions.find((u) => u.id === 'U0011')!.partenaires).toEqual(['P0013', r.id]);
  });

  it('avec deux parents : refusé', () => {
    const r = ajouterParent(chargerExemple(), 'P0009', nouvelle('X'));
    expect(r.ok).toBe(false);
  });

  it('lier un descendant comme parent : refusé (boucle)', () => {
    const r = ajouterParent(chargerExemple(), 'P0011', { id: 'P0012' }); // Léa parent de Sacha, son propre parent
    expect(r.ok).toBe(false);
  });
});

describe('ajouter un enfant', () => {
  it('dans une union existante', () => {
    const r = ok(ajouterEnfant(chargerExemple(), 'P0009', { union: 'U0006' }, nouvelle('Nouvel enfant', 2005)));
    expect(r.arbre.unions.find((u) => u.id === 'U0006')!.enfants).toEqual(['P0015', r.id]);
  });

  it('avec un nouveau partenaire : nouvelle union', () => {
    const avant = chargerExemple();
    const r = ok(ajouterEnfant(avant, 'P0009', { partenaire: nouvelle('Nouveau partenaire') }, nouvelle('Bébé')));
    const u = r.arbre.unions[r.arbre.unions.length - 1]!;
    expect(u.id).toBe('U0013');
    expect(u.partenaires[0]).toBe('P0009');
    expect(u.enfants).toEqual([r.id]);
    expect(r.arbre.personnes).toHaveLength(avant.personnes.length + 2);
  });

  it('autre parent inconnu', () => {
    let a = ok(creerPersonne(arbreVide(), { prenoms: 'P', nom: '' })).arbre;
    a = ok(ajouterEnfant(a, 'P0001', { autreParentInconnu: true }, nouvelle('E'))).arbre;
    expect(a.unions).toEqual([{ id: 'U0001', partenaires: ['P0001'], type: 'non_precise', enfants: ['P0002'] }]);
  });

  it('lier une personne existante sans parents (relier deux branches)', () => {
    let a: Arbre = ok(creerPersonne(arbreVide(), { prenoms: 'P', nom: '' })).arbre;
    a = ok(creerPersonne(a, { prenoms: 'E', nom: '' })).arbre;
    a = ok(ajouterEnfant(a, 'P0001', { autreParentInconnu: true }, { id: 'P0002' })).arbre;
    expect(a.personnes).toHaveLength(2);
    expect(a.unions[0]!.enfants).toEqual(['P0002']);
  });

  it('lier une personne qui a déjà des parents : refusé', () => {
    expect(ajouterEnfant(chargerExemple(), 'P0011', { autreParentInconnu: true }, { id: 'P0012' }).ok).toBe(false);
  });

  it('lier un ascendant comme enfant : refusé (boucle)', () => {
    let a = ok(creerPersonne(arbreVide(), { prenoms: 'A', nom: '' })).arbre;
    a = ok(ajouterEnfant(a, 'P0001', { autreParentInconnu: true }, nouvelle('B'))).arbre;
    const r = ajouterEnfant(a, 'P0002', { autreParentInconnu: true }, { id: 'P0001' });
    expect(r.ok).toBe(false);
  });
});

describe('lier à une union existante', () => {
  // Personne isolée, sans parents ni union, ajoutée à l'exemple.
  const avecIsole = () => ok(creerPersonne(chargerExemple(), { prenoms: 'Isolé', nom: 'X' }));

  it('rattacher une personne existante à une fratrie existante', () => {
    const { arbre, id } = avecIsole();
    const r = ok(rattacherEnfant(arbre, 'U0005', { id: id! }));
    expect(r.arbre.unions.find((u) => u.id === 'U0005')!.enfants).toEqual(['P0013', 'P0012', id]);
  });

  it('rattacher une nouvelle personne à une fratrie', () => {
    const r = ok(rattacherEnfant(chargerExemple(), 'U0011', nouvelle('Petit frère de Maël')));
    expect(r.arbre.unions.find((u) => u.id === 'U0011')!.enfants).toEqual(['P0023', r.id]);
  });

  it('refuse une personne qui a déjà des parents, un partenaire de l’union ou un ascendant', () => {
    const a = chargerExemple();
    expect(rattacherEnfant(a, 'U0005', { id: 'P0015' }).ok).toBe(false); // Inès a déjà des parents
    expect(rattacherEnfant(a, 'U0005', { id: 'P0009' }).ok).toBe(false); // Camille, partenaire de l'union
    // Jean (ancêtre de Camille, sans parents) ne peut pas devenir l'enfant de Camille
    const r = rattacherEnfant(a, 'U0005', { id: 'P0001' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/boucle/);
  });

  it('compléter une union dont l’autre parent est inconnu, avec une personne existante', () => {
    const { arbre, id } = avecIsole();
    const r = ok(completerUnion(arbre, 'U0011', { id: id! }));
    expect(r.arbre.unions.find((u) => u.id === 'U0011')!.partenaires).toEqual(['P0013', id]);
    expect(r.arbre.unions).toHaveLength(arbre.unions.length); // aucune union créée
  });

  it('compléter : refusé si l’union a deux partenaires, ou si la personne en descend', () => {
    const a = chargerExemple();
    expect(completerUnion(a, 'U0005', nouvelle('X')).ok).toBe(false);
    expect(completerUnion(a, 'U0011', { id: 'P0023' }).ok).toBe(false); // Maël, enfant de cette union
  });

  it('ajouter un parent à un enfant qui n’a qu’un parent connu complète la même union (toute la fratrie)', () => {
    let a = ok(rattacherEnfant(chargerExemple(), 'U0011', nouvelle('Sœur de Maël'))).arbre;
    const r = ok(ajouterParent(a, 'P0023', nouvelle('Autre parent')));
    a = r.arbre;
    const u = a.unions.find((x) => x.id === 'U0011')!;
    expect(u.partenaires).toEqual(['P0013', r.id]);
    expect(u.enfants).toHaveLength(2);
  });

  it('enfant « avec un nouveau partenaire » qui est déjà uni au parent : l’union existante est réutilisée', () => {
    const a = chargerExemple();
    const r = ok(ajouterEnfant(a, 'P0009', { partenaire: { id: 'P0014' } }, nouvelle('Enfant')));
    expect(r.arbre.unions).toHaveLength(a.unions.length);
    expect(r.arbre.unions.find((u) => u.id === 'U0006')!.enfants).toEqual(['P0015', r.id]);
  });
});

describe('ajouter un partenaire', () => {
  it('crée une nouvelle union, même entre deux personnes déjà unies (remariage)', () => {
    const r = ok(ajouterPartenaire(chargerExemple(), 'P0009', { id: 'P0011' }));
    expect(r.arbre.unions.filter((u) => u.partenaires.includes('P0011'))).toHaveLength(2);
  });
});

describe('supprimer', () => {
  it('liste les liens concernés', () => {
    expect(liensDePersonne(chargerExemple(), 'P0009')).toEqual([
      'Enfant de Claude Moreau et Dominique Lefèvre',
      'Union avec Sacha Bernard (2 enfants : Léa Bernard, Hugo Bernard)',
      'Union avec Nadia Roux (1 enfant : Inès-Marguerite Roux-Moreau de Villeneuve)',
      'Union avec Morgan Faure (2 enfants : Noé Faure, Lou Faure)',
    ]);
  });

  it('supprimer une personne ne supprime jamais une autre personne', () => {
    const a = chargerExemple();
    const r = ok(supprimerPersonne(a, 'P0009'));
    expect(r.arbre.personnes).toHaveLength(a.personnes.length - 1);
    // ses unions gardent l'autre partenaire et les enfants
    expect(r.arbre.unions.find((u) => u.id === 'U0005')).toMatchObject({ partenaires: ['P0011'], enfants: ['P0013', 'P0012'] });
    // et elle n'est plus enfant de ses parents
    expect(r.arbre.unions.find((u) => u.id === 'U0004')!.enfants).toEqual([]);
  });

  it('une union sans plus aucun partenaire disparaît, ses enfants restent', () => {
    const a = chargerExemple();
    const r = ok(supprimerPersonne(a, 'P0013')); // Hugo, seul parent connu de Maël
    expect(r.arbre.unions.some((u) => u.id === 'U0011')).toBe(false);
    expect(r.arbre.personnes.some((p) => p.id === 'P0023')).toBe(true);
  });

  it('supprimer une union garde toutes les personnes', () => {
    const a = chargerExemple();
    const r = ok(supprimerUnion(a, 'U0007'));
    expect(r.arbre.personnes).toEqual(a.personnes);
  });
});

describe('unions', () => {
  it('modifier type et dates, effacer une date', () => {
    let a = ok(modifierUnion(chargerExemple(), 'U0005', { type: 'pacs', fin: null })).arbre;
    a = ok(modifierUnion(a, 'U0005', { debut: { annee: 1984, qualificatif: 'vers' } })).arbre;
    expect(a.unions.find((u) => u.id === 'U0005')).toEqual({
      id: 'U0005',
      partenaires: ['P0009', 'P0011'],
      type: 'pacs',
      debut: { annee: 1984, qualificatif: 'vers' },
      enfants: ['P0013', 'P0012'],
    });
  });

  it('réordonner à la main les enfants sans date', () => {
    let a = chargerExemple();
    a = ok(ajouterEnfant(a, 'P0009', { union: 'U0007' }, nouvelle('Sans date'))).arbre; // P0025
    const ordre = (x: Arbre) => {
      const idx = indexer(x);
      return enfantsOrdonnes(idx, idx.unions.get('U0007')!);
    };
    expect(ordre(a)).toEqual(['P0017', 'P0018', 'P0025']);
    a = ok(deplacerEnfant(a, 'U0007', 'P0025', -1)).arbre;
    expect(ordre(a)).toEqual(['P0017', 'P0025', 'P0018']);
    // un enfant daté ne se déplace pas à la main
    expect(deplacerEnfant(a, 'U0007', 'P0017', 1).ok).toBe(false);
  });
});
