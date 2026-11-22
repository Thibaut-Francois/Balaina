import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const cadres = (page: Page) => page.locator('g.cadre');
const exemple = readFileSync('exemples/famille-complexe.json', 'utf8');

/** Simule un navigateur sans accès direct aux fichiers (Firefox, Safari). */
const sansAccesDirect = (page: Page) =>
  page.addInitScript(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
  });

async function creerPersonne(page: Page, prenoms: string) {
  await page.getByRole('button', { name: 'Créer la première personne' }).click();
  await page.locator('dialog[open]').getByLabel('Prénom(s)').fill(prenoms);
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(cadres(page)).toHaveCount(1);
}

async function ouvrirFichier(page: Page, nom: string, contenu: string) {
  const choix = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Ouvrir…' }).click();
  await (await choix).setFiles({ name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) });
}

test('sauvegarde automatique : l’arbre est retrouvé après rechargement', async ({ page }) => {
  await page.goto('/');
  await creerPersonne(page, 'Alix');
  await expect(page.getByText(/Modifications non exportées depuis le \d\d\/\d\d\/\d{4} à \d\d:\d\d/)).toBeVisible();
  await page.waitForTimeout(400); // écriture différée
  await page.reload();
  await expect(cadres(page)).toHaveCount(1);
  await expect(page.locator('text.nom', { hasText: 'Alix' })).toBeVisible();
  await expect(page.getByText(/Modifications non exportées/)).toBeVisible();
});

test('enregistrer sans accès direct : téléchargement d’un fichier JSON valide', async ({ page }) => {
  await sansAccesDirect(page);
  await page.goto('/');
  await creerPersonne(page, 'Alix');
  await expect(page.getByRole('button', { name: 'Enregistrer sous…' })).toHaveCount(0);
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const d = await telechargement;
  expect(d.suggestedFilename()).toMatch(/^arbre-genealogique-\d{4}-\d\d-\d\d\.json$/);
  const contenu = JSON.parse(readFileSync(await d.path(), 'utf8'));
  expect(contenu).toMatchObject({ format: 'balaina-arbre', version: 1, personnes: [{ prenoms: 'Alix' }] });
  await expect(page.getByText(/Modifications non exportées/)).toHaveCount(0);
  await expect(page.getByText(`✓ ${d.suggestedFilename()}`)).toBeVisible();
});

test('ouvrir un fichier : confirmation avant de remplacer, annulable', async ({ page }) => {
  await sansAccesDirect(page);
  await page.goto('/');
  await creerPersonne(page, 'Alix');
  await ouvrirFichier(page, 'famille-complexe.json', exemple);
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('24 personnes et 12 unions');
  await expect(dlg).toContainText("remplacera l'arbre actuel (1 personne)");
  await expect(dlg).toContainText('modifications non exportées');
  await dlg.getByRole('button', { name: 'Remplacer l’arbre' }).click();
  await expect(cadres(page)).toHaveCount(24);
  await expect(page.getByText('✓ famille-complexe.json')).toBeVisible();
  // l'ancien arbre reste récupérable
  await page.keyboard.press('Control+z');
  await expect(cadres(page)).toHaveCount(1);
});

test('fichier invalide : message clair, arbre inchangé', async ({ page }) => {
  await sansAccesDirect(page);
  await page.goto('/');
  await creerPersonne(page, 'Alix');
  const casse = JSON.parse(exemple);
  casse.personnes[1].naissance = { annee: 1950, mois: 13 };
  delete casse.unions[0].type;
  await ouvrirFichier(page, 'abime.json', JSON.stringify(casse));
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('Fichier invalide');
  await expect(dlg).toContainText('personnes › n°2 › naissance : Mois invalide');
  await expect(dlg).toContainText('unions › n°1 › type : champ obligatoire manquant');
  await dlg.getByRole('button', { name: 'Fermer' }).click();
  await expect(cadres(page)).toHaveCount(1);

  await ouvrirFichier(page, 'texte.json', 'ceci n’est pas du JSON');
  await expect(page.locator('dialog[open]')).toContainText("Le fichier n'est pas un JSON valide.");
});

test('Chrome / Edge : « Enregistrer » réécrit directement le même fichier', async ({ page }) => {
  // Faux sélecteur de fichier : on capture ce qui est écrit.
  await page.addInitScript(() => {
    const w = window as any;
    w.__ecritures = [];
    w.__choix = 0;
    const handle = {
      name: 'mon-arbre.json',
      kind: 'file',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      createWritable: async () => {
        let contenu = '';
        return { write: async (t: string) => void (contenu += t), close: async () => void w.__ecritures.push(contenu) };
      },
    };
    w.showOpenFilePicker = async () => [handle];
    w.showSaveFilePicker = async () => {
      w.__choix++;
      return handle;
    };
  });
  await page.goto('/');
  await creerPersonne(page, 'Alix');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('✓ mon-arbre.json')).toBeVisible();
  // modification puis Ctrl+S : même fichier, sans redemander où enregistrer
  await page.locator('g.cadre').click();
  await page.getByRole('menuitem', { name: 'Ajouter un partenaire' }).click();
  await page.locator('dialog[open]').getByLabel('Prénom(s)').fill('Sam');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText(/Modifications non exportées/)).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByText('✓ mon-arbre.json')).toBeVisible();
  const { ecritures, choix } = await page.evaluate(() => ({ ecritures: (window as any).__ecritures, choix: (window as any).__choix }));
  expect(choix).toBe(1);
  expect(ecritures).toHaveLength(2);
  expect(JSON.parse(ecritures[1]).personnes).toHaveLength(2);
});
