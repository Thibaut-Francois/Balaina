import { expect, test, type Page } from '@playwright/test';

const cadres = (page: Page) => page.locator('g.cadre');
const cadre = (page: Page, nom: string) => page.locator('g.cadre', { has: page.locator('text.nom', { hasText: nom }) });

async function menu(page: Page, nom: string, action: string) {
  await cadre(page, nom).click();
  await page.getByRole('menuitem', { name: action }).click();
}

async function nouvellePersonne(page: Page, prenoms: string, nom = '', naissance = '') {
  const dlg = page.locator('dialog[open]');
  // dans le dialogue « enfant », le dernier bloc de choix est celui de l'enfant
  await dlg.getByLabel('Prénom(s)').last().fill(prenoms);
  if (nom) await dlg.getByLabel('Nom', { exact: true }).last().fill(nom);
  if (naissance) await dlg.getByLabel('Naissance').last().fill(naissance);
}

test('parcours complet : créer, ajouter, lier, annuler, rechercher, supprimer', async ({ page }) => {
  await page.goto('/');

  // Arbre vide
  await page.getByRole('button', { name: 'Créer la première personne' }).click();
  await nouvellePersonne(page, 'Alix', 'Martin', '1950');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(cadres(page)).toHaveCount(1);
  await expect(cadre(page, 'Alix Martin')).toContainText('° 1950');

  // La fiche s'ouvre : modification immédiate
  const fiche = page.getByRole('complementary');
  await fiche.getByLabel('Autres noms').fill('Alix Dubois');
  await fiche.getByLabel('Décédé·e').check();
  await expect(cadre(page, 'Alix Martin')).toContainText('†');
  await fiche.getByLabel('Fermer la fiche').click();

  // Ajouter un enfant sans union : autre parent inconnu
  await menu(page, 'Alix Martin', 'Ajouter un enfant');
  await expect(page.getByLabel('Autre parent inconnu')).toBeChecked();
  await nouvellePersonne(page, 'Bébé', 'Martin', '1975');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(cadres(page)).toHaveCount(2);

  // Ajouter un partenaire : nouvelle union
  await menu(page, 'Alix Martin', 'Ajouter un partenaire');
  await nouvellePersonne(page, 'Sam', 'Roux');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(cadres(page)).toHaveCount(3);

  // Ajouter un enfant : l'union la plus récente est présélectionnée
  await menu(page, 'Alix Martin', 'Ajouter un enfant');
  await expect(page.getByLabel('Avec Sam Roux')).toBeChecked();
  await nouvellePersonne(page, 'Cyan', 'Roux');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(cadres(page)).toHaveCount(4);

  // Annuler / rétablir au clavier
  await page.keyboard.press('Control+z');
  await expect(cadres(page)).toHaveCount(3);
  await page.keyboard.press('Control+y');
  await expect(cadres(page)).toHaveCount(4);

  // Lier une personne existante : Sam devient le second parent de Bébé
  await menu(page, 'Bébé Martin', 'Ajouter un parent');
  await page.getByLabel('Lier une personne existante').check();
  await page.locator('dialog[open]').getByText('Sam Roux').click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(cadres(page)).toHaveCount(4);
  // Bébé a désormais deux parents : l'option est désactivée
  await cadre(page, 'Bébé Martin').click();
  await expect(page.getByRole('menuitem', { name: 'Ajouter un parent' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // Mise en évidence d'une union au survol de son point
  const points = page.locator('g.union');
  await expect(points).toHaveCount(2);
  await points.first().hover();
  await expect(page.locator('g.cadre.attenue')).toHaveCount(1);
  await page.mouse.move(5, 300);
  await expect(page.locator('g.cadre.attenue')).toHaveCount(0);

  // Panneau d'union : modifier le type
  await points.first().click();
  await page.getByRole('complementary').getByLabel('Type').selectOption('mariage');
  await page.getByRole('complementary').getByLabel('Fermer').click();

  // Recherche
  await page.getByLabel('Rechercher une personne').fill('cyan');
  await page.getByRole('option', { name: /Cyan Roux/ }).click();
  await expect(cadre(page, 'Cyan Roux')).toHaveClass(/selectionne/);

  // Supprimer Sam : confirmation listant ses liens ; personne d'autre n'est supprimé
  await menu(page, 'Sam Roux', 'Supprimer…');
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('Union avec Alix Martin');
  await dlg.getByRole('button', { name: 'Supprimer' }).click();
  await expect(cadres(page)).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(cadres(page)).toHaveCount(4);
});

test('lier à une union existante : fratrie, autre parent, partenaire', async ({ page }) => {
  await page.goto('/?exemple');
  const points = page.locator('g.union');
  await expect(points).toHaveCount(12);
  const dlg = page.locator('dialog[open]');
  const panneau = page.getByRole('complementary');

  // Morgan (sans parents) rejoint la fratrie de Marcel et Jeanne (union de Jean et Louise)
  await menu(page, 'Morgan Faure', 'Ajouter un parent');
  await dlg.getByLabel('Rejoindre une fratrie existante').check();
  await dlg.getByLabel('Rechercher un couple ou une fratrie').fill('jeanne');
  await dlg.getByText('Jean Moreau et Louise Garnier').click();
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(points).toHaveCount(12); // aucune union créée
  await page.locator('g.union').first().click(); // union de Jean et Louise
  await expect(panneau).toContainText('Morgan Faure');
  await panneau.getByLabel('Fermer').click();

  // Union de Hugo avec un parent inconnu : on lie l'autre parent depuis le panneau de l'union
  const pointHugo = page.locator('g.union').nth(10); // U0011, dans l'ordre des identifiants
  await pointHugo.click();
  await expect(panneau).toContainText('Union de Hugo Bernard et un parent inconnu');
  await panneau.getByRole('button', { name: 'Ajouter l\'autre parent…' }).click();
  await dlg.getByLabel('Lier une personne existante').check();
  await dlg.getByText('Zoé Lambert').click();
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(panneau).toContainText('Union de Hugo Bernard et Zoé Lambert');

  // Ajouter un enfant depuis le panneau de l'union
  await panneau.getByRole('button', { name: 'Ajouter un enfant…' }).click();
  await nouvellePersonne(page, 'Petit', 'Bernard');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(panneau).toContainText('Petit Bernard');
  await panneau.getByLabel('Fermer').click();

  // Partenaire qui devient l'autre parent d'une union existante (au lieu d'une nouvelle union)
  await menu(page, 'Lou Faure', 'Ajouter un enfant');
  await nouvellePersonne(page, 'Bébé', 'Faure');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(points).toHaveCount(13);
  await menu(page, 'Lou Faure', 'Ajouter un partenaire');
  await nouvellePersonne(page, 'Alex', 'Martin');
  await dlg.getByLabel(/Devenir l'autre parent des enfants de Lou Faure/).check();
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(points).toHaveCount(13); // union complétée, pas de nouvelle union
  await expect(page.locator('g.cadre', { hasText: 'Alex Martin' })).toHaveCount(1);
});

test('lier un descendant comme parent est impossible', async ({ page }) => {
  await page.goto('/?exemple');
  await expect(cadres(page)).toHaveCount(24);
  await menu(page, 'Maël Bernard', 'Ajouter un parent');
  await page.getByLabel('Lier une personne existante').check();
  const dlg = page.locator('dialog[open]');
  await dlg.getByLabel('Rechercher dans l\'arbre').fill('Maël');
  await expect(dlg.getByText('Aucune personne ne correspond.')).toBeVisible();
});
