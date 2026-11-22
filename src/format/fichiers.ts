/**
 * Accès aux fichiers depuis le navigateur, 100 % local.
 * - Chrome / Edge : API File System Access, « Enregistrer » réécrit le fichier ouvert.
 * - Autres navigateurs : sélection classique à l'ouverture, téléchargement à l'enregistrement.
 */

const TYPES: FilePickerAcceptType[] = [{ description: 'Arbre généalogique (JSON)', accept: { 'application/json': ['.json'] } }];

export const accesDirectDisponible = (): boolean =>
  typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;

const estAnnulation = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export interface FichierLu {
  texte: string;
  nom: string;
  handle?: FileSystemFileHandle;
}

/** Demande un fichier à ouvrir. `null` si l'utilisateur annule. */
export async function choisirFichierAOuvrir(): Promise<FichierLu | null> {
  if (accesDirectDisponible()) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
      const fichier = await handle!.getFile();
      return { texte: await fichier.text(), nom: fichier.name, handle };
    } catch (e) {
      if (estAnnulation(e)) return null;
      throw e;
    }
  }
  return new Promise((resoudre, rejeter) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.append(input);
    const fin = () => input.remove();
    input.addEventListener('change', async () => {
      const fichier = input.files?.[0];
      fin();
      if (!fichier) return resoudre(null);
      try {
        resoudre({ texte: await fichier.text(), nom: fichier.name });
      } catch (e) {
        rejeter(e);
      }
    });
    input.addEventListener('cancel', () => {
      fin();
      resoudre(null);
    });
    input.click();
  });
}

/** Demande où enregistrer (Chrome / Edge). `null` si l'utilisateur annule. */
export async function choisirOuEnregistrer(nomPropose: string): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker({ suggestedName: nomPropose, types: TYPES });
  } catch (e) {
    if (estAnnulation(e)) return null;
    throw e;
  }
}

/** Réécrit un fichier déjà choisi. Demande l'autorisation d'écriture si nécessaire. */
export async function ecrireFichier(handle: FileSystemFileHandle, texte: string): Promise<void> {
  const options = { mode: 'readwrite' as const };
  if ((await handle.queryPermission?.(options)) !== 'granted') {
    if ((await handle.requestPermission?.(options)) !== 'granted') {
      throw new DOMException("L'autorisation d'écrire dans le fichier a été refusée.", 'NotAllowedError');
    }
  }
  const flux = await handle.createWritable();
  await flux.write(texte);
  await flux.close();
}

/** Téléchargement d'un nouveau fichier (navigateurs sans accès direct). */
export function telecharger(texte: string, nom: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([texte], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
