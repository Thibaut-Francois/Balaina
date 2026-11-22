import { expect, test } from '@playwright/test';

test('Recalculer : moins de croisements, annulable, conservé après rechargement', async ({ page }) => {
  await page.goto('/?graine=16&taille=35&realiste');
  await expect(page.locator('g.cadre')).toHaveCount(35);
  const positions = () => page.locator('g.cadre').evaluateAll((gs) => gs.map((g) => g.getAttribute('transform')).join('|'));
  const avant = await positions();

  await page.getByRole('button', { name: 'Recalculer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Disposition recalculée' })).toContainText(/5 croisements → [0-4] croisement/);
  const apres = await positions();
  expect(apres).not.toBe(avant);

  // annulable
  await page.keyboard.press('Control+z');
  await expect.poll(positions).toBe(avant);
  await page.keyboard.press('Control+y');
  await expect.poll(positions).toBe(apres);
});

test('Recalculer sur un arbre sans croisement : rien ne change', async ({ page }) => {
  await page.goto('/?exemple');
  await expect(page.locator('g.cadre')).toHaveCount(24);
  await page.getByRole('button', { name: 'Recalculer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Aucun croisement' })).toBeVisible();
});
