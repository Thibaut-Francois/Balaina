import { readFileSync } from 'node:fs';
import { importerJSON } from '../src/format/io';
import type { Arbre } from '../src/model/types';

export function chargerExemple(): Arbre {
  const r = importerJSON(readFileSync('exemples/famille-complexe.json', 'utf8'));
  if (!r.ok) throw new Error(r.erreurs.join('\n'));
  return r.arbre;
}
