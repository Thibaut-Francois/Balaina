import urlRegular from '../assets/polices/Inter_400Regular.ttf?url';
import urlSemibold from '../assets/polices/Inter_600SemiBold.ttf?url';

/** Fichiers de police embarqués dans l'application (servis localement, jamais téléchargés d'Internet). */
let cache: Promise<{ regular: string; semibold: string }> | undefined;

function enBase64(octets: ArrayBuffer): string {
  const t = new Uint8Array(octets);
  let s = '';
  for (let i = 0; i < t.length; i += 0x8000) s += String.fromCharCode(...t.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Polices en base64 (TTF). */
export function policesBase64(): Promise<{ regular: string; semibold: string }> {
  cache ??= Promise.all(
    [urlRegular, urlSemibold].map(async (u) => enBase64(await (await fetch(u)).arrayBuffer())),
  ).then(([regular, semibold]) => ({ regular: regular!, semibold: semibold! }));
  return cache;
}
