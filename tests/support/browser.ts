/**
 * Lancement de Chromium pour les scripts de recette. Utilise le navigateur
 * correspondant à la version verrouillée de Playwright s'il est installé ;
 * sinon, si `PW_CHROMIUM_PATH` est défini (environnement où un Chromium est
 * préinstallé dans une autre révision), ce binaire — la révision réellement
 * employée est alors affichée, pour que le rapport ne la masque pas.
 */
import { existsSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';

export async function launchChromium(): Promise<Browser> {
  const bundled = chromium.executablePath();
  const fallback = process.env.PW_CHROMIUM_PATH;
  const executablePath = existsSync(bundled) ? undefined : fallback;
  if (!existsSync(bundled) && !fallback) {
    throw new Error(`Chromium de Playwright absent (${bundled}). Installer la révision verrouillée ou définir PW_CHROMIUM_PATH.`);
  }
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  console.log(`  navigateur : Chromium ${browser.version()}${executablePath ? ` (binaire ${executablePath}, hors révision Playwright)` : ''}`);
  return browser;
}
