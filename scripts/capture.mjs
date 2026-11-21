// Capture d'écran du rendu (vérification visuelle à chaque phase).
// Usage : node scripts/capture.mjs <url> <fichier.png> [largeur] [hauteur]
// Nécessite un serveur lancé (npm run dev ou npm start).
import { chromium } from '@playwright/test';

const [url = 'http://127.0.0.1:5173/', sortie = 'capture.png', largeur = '1600', hauteur = '1000'] = process.argv.slice(2);
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: sortie });
await navigateur.close();
if (erreurs.length) {
  console.error('Erreurs dans la page :\n' + erreurs.join('\n'));
  process.exit(1);
}
console.log(`Capture enregistrée : ${sortie}`);
