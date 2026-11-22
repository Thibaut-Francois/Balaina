import { expect, test, type Page } from '@playwright/test';

/** Ouvre « Exporter… », coche le recalcul et exporte en PNG. */
async function exporterAvecRecalcul(page: Page) {
  await page.getByRole('button', { name: 'Exporter…' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('PNG').check();
  await dlg.getByLabel(/Recalculer d'abord la disposition/).check();
  const telechargement = page.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Exporter', exact: true }).click();
  return telechargement;
}

test('Exporter avec recalcul : moins de croisements, annulable, image téléchargée', async ({ page }) => {
  await page.goto('/?graine=16&taille=35&realiste');
  await expect(page.locator('g.cadre')).toHaveCount(35);
  await expect(page.getByRole('button', { name: 'Recalculer' })).toHaveCount(0);
  const positions = () => page.locator('g.cadre').evaluateAll((gs) => gs.map((g) => g.getAttribute('transform')).join('|'));
  const avant = await positions();

  const d = await exporterAvecRecalcul(page);
  expect(d.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByRole('status').filter({ hasText: 'Disposition recalculée' })).toContainText(/5 croisements → [0-4] croisement/);
  const apres = await positions();
  expect(apres).not.toBe(avant);

  await page.keyboard.press('Control+z');
  await expect.poll(positions).toBe(avant);
  await page.keyboard.press('Control+y');
  await expect.poll(positions).toBe(apres);
});

test('Exporter avec recalcul sur un arbre sans croisement : rien ne change', async ({ page }) => {
  await page.goto('/?exemple');
  await expect(page.locator('g.cadre')).toHaveCount(24);
  await exporterAvecRecalcul(page);
  await expect(page.getByRole('status').filter({ hasText: 'Aucun croisement' })).toBeVisible();
});
