import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Dossier où garder les fichiers produits (vérification visuelle manuelle), facultatif. */
const DOSSIER = process.env.DOSSIER_EXPORTS;

async function exporter(page: Page, format: 'PDF vectoriel' | 'PNG' | 'JPEG', reglages?: (p: Page) => Promise<void>) {
  await page.getByRole('button', { name: 'Exporter…' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel(format).check();
  if (reglages) await reglages(page);
  const telechargement = page.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Exporter' }).click();
  const d = await telechargement;
  if (DOSSIER) await d.saveAs(`${DOSSIER}/${d.suggestedFilename()}`);
  return { nom: d.suggestedFilename(), octets: readFileSync(await d.path()) };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?exemple');
  await expect(page.locator('g.cadre')).toHaveCount(24);
});

test('PDF vectoriel sur une page : police embarquée, aucune image', async ({ page }) => {
  const { nom, octets } = await exporter(page, 'PDF vectoriel', async (p) => {
    const dlg = p.locator('dialog[open]');
    await dlg.getByLabel('Papier').selectOption('A3');
    await dlg.getByLabel('Tenir sur une page').check();
    await expect(dlg).toContainText('1 page A3 paysage');
  });
  expect(nom).toMatch(/\.pdf$/);
  const texte = octets.toString('latin1');
  expect(texte.startsWith('%PDF-')).toBe(true);
  expect(texte).toContain('/FontFile2'); // police TrueType embarquée
  expect(texte).not.toMatch(/\/Subtype\s*\/Image/); // purement vectoriel
  expect(texte.match(/\/Type \/Page\b/g)).toHaveLength(1);
});

test('PDF taille réelle sur plusieurs pages', async ({ page }) => {
  let annonce = '';
  const { octets } = await exporter(page, 'PDF vectoriel', async (p) => {
    const dlg = p.locator('dialog[open]');
    await dlg.getByLabel('Papier').selectOption('A4');
    await dlg.getByLabel('Taille réelle sur plusieurs pages').check();
    annonce = (await dlg.locator('.resume').textContent()) ?? '';
  });
  const n = Number(/^(\d+) pages/.exec(annonce)?.[1]);
  expect(n).toBeGreaterThan(1);
  expect(octets.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(n);
});

test('PNG à la résolution choisie, JPEG', async ({ page }) => {
  const png = await exporter(page, 'PNG', async (p) => {
    await p.locator('dialog[open]').getByLabel('Résolution').selectOption('2');
  });
  expect(png.octets.subarray(1, 4).toString()).toBe('PNG');
  const largeur = png.octets.readUInt32BE(16),
    hauteur = png.octets.readUInt32BE(20);
  const bornes = await page.evaluate(() => {
    const g = document.querySelector('svg.arbre > g')!;
    return g.getBoundingClientRect().width > 0;
  });
  expect(bornes).toBe(true);
  expect(largeur).toBeGreaterThan(3000); // ≈ 2 × la largeur de l'arbre
  expect(hauteur).toBeGreaterThan(1000);

  const jpeg = await exporter(page, 'JPEG');
  expect(jpeg.octets[0]).toBe(0xff);
  expect(jpeg.octets[1]).toBe(0xd8);
  expect(jpeg.nom).toMatch(/\.jpg$/);
});

test('impression : pages préparées, interface masquée, fond blanc', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).print = () => ((window as any).__imprime = true);
  });
  await page.goto('/?exemple');
  await expect(page.locator('g.cadre')).toHaveCount(24);
  await page.keyboard.press('Control+p');
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('Imprimer l’arbre');
  await dlg.getByLabel('Papier').selectOption('A4');
  await dlg.getByLabel('Taille réelle sur plusieurs pages').check();
  const n = Number(/^(\d+) pages/.exec((await dlg.locator('.resume').textContent()) ?? '')?.[1]);
  await dlg.getByRole('button', { name: 'Imprimer' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__imprime)).toBe(true);
  await expect(page.locator('#zone-impression .page')).toHaveCount(n);
  await expect(page.locator('#zone-impression .page svg')).toHaveCount(n);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('#zone-impression')).toBeVisible();
  if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/impression.png`, fullPage: true });
});
