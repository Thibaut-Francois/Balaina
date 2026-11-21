import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exporterJSON, importerJSON } from '../src/format/io';
import { migrer } from '../src/format/migrations';
import { indexer } from '../src/model/index';
import { chargerExemple } from './aides';

const DATE = new Date('2026-11-21T12:00:00.000Z');

describe('fichier d’exemple', () => {
  it('couvre tous les cas demandés', () => {
    const a = chargerExemple();
    const idx = indexer(a);
    // une personne avec 3 unions, des enfants dans chacune
    const unionsCamille = idx.unionsDe.get('P0009')!;
    expect(unionsCamille).toHaveLength(3);
    expect(unionsCamille.every((id) => idx.unions.get(id)!.enfants.length > 0)).toBe(true);
    // un enfant avec un seul parent connu
    expect(a.unions.some((u) => u.partenaires.length === 1 && u.enfants.length > 0)).toBe(true);
    // une union sans enfant
    expect(a.unions.some((u) => u.enfants.length === 0)).toBe(true);
    // chaîne A-B-C : B a deux partenaires distincts
    expect(idx.unionsDe.get('P0019')).toHaveLength(2);
    // décès sans date
    expect(a.personnes.some((p) => p.deces && !p.deces.date)).toBe(true);
    // dates partielles
    expect(a.personnes.some((p) => p.naissance?.qualificatif === 'vers')).toBe(true);
    expect(a.personnes.some((p) => p.naissance?.qualificatif === 'avant')).toBe(true);
    expect(a.personnes.some((p) => p.naissance?.mois !== undefined && p.naissance.jour === undefined)).toBe(true);
  });
});

describe('aller-retour', () => {
  it('exporter puis réimporter redonne exactement le même arbre', () => {
    const a = chargerExemple();
    const texte = exporterJSON(a, DATE);
    const r = importerJSON(texte);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.arbre).toEqual(a);
    // et la sérialisation est stable, octet pour octet
    expect(exporterJSON(r.arbre, DATE)).toBe(texte);
  });

  it('le fichier exporté est lisible et versionné', () => {
    const texte = exporterJSON(chargerExemple(), DATE);
    const brut = JSON.parse(texte);
    expect(brut.format).toBe('balaina-arbre');
    expect(brut.version).toBe(1);
    expect(texte).toContain('\n  "personnes": [');
  });
});

describe('import invalide : messages clairs', () => {
  const erreurs = (texte: string) => {
    const r = importerJSON(texte);
    expect(r.ok).toBe(false);
    return r.ok ? [] : r.erreurs;
  };

  it('pas du JSON', () => {
    expect(erreurs('pas du json')).toEqual(["Le fichier n'est pas un JSON valide."]);
  });
  it('un autre type de fichier', () => {
    expect(erreurs('{"a":1}')[0]).toMatch(/pas un arbre/);
  });
  it('version future', () => {
    expect(erreurs('{"format":"balaina-arbre","version":99,"personnes":[],"unions":[]}')[0]).toMatch(/plus récente/);
  });
  it('champ manquant et date impossible, avec leur emplacement', () => {
    const e = erreurs(
      JSON.stringify({
        format: 'balaina-arbre',
        version: 1,
        personnes: [{ id: 'P1', prenoms: 'A' }, { id: 'P2', prenoms: 'B', nom: 'C', naissance: { annee: 1950, mois: 2, jour: 30 } }],
        unions: [],
      }),
    );
    expect(e).toContain('personnes › n°1 › nom : champ obligatoire manquant');
    expect(e).toContain('personnes › n°2 › naissance : Jour invalide');
  });
  it('union à trois partenaires', () => {
    const fichier = JSON.parse(readFileSync('exemples/famille-complexe.json', 'utf8'));
    fichier.unions[0].partenaires.push('P0003');
    expect(erreurs(JSON.stringify(fichier))[0]).toMatch(/1 ou 2 partenaires/);
  });
  it('cycle refusé à l’import', () => {
    const fichier = JSON.parse(readFileSync('exemples/famille-complexe.json', 'utf8'));
    fichier.unions[3].enfants.push('P0001'); // Jean devient enfant de ses petits-enfants
    expect(erreurs(JSON.stringify(fichier)).join()).toMatch(/propre ascendante/);
  });
});

describe('migrations', () => {
  it('applique la chaîne de migrations jusqu’à la version cible', () => {
    const migrations = {
      1: (d: Record<string, unknown>) => ({ ...d, version: 2, ajout: 'v2' }),
      2: (d: Record<string, unknown>) => ({ ...d, version: 3 }),
    };
    const r = migrer({ format: 'balaina-arbre', version: 1 }, migrations, 3);
    expect(r).toEqual({ ok: true, donnees: { format: 'balaina-arbre', version: 3, ajout: 'v2' } });
  });
  it('signale une migration manquante', () => {
    const r = migrer({ version: 1 }, {}, 2);
    expect(r.ok).toBe(false);
  });
});
