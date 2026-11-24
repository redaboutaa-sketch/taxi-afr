// Chargeur uniquement : toute la configuration est calculée par le moteur
// depuis le brief du site (FACTORY_SITE_DIR, défaut site/). Ne rien ajouter ici.
import { defineConfig } from 'astro/config';
import { factoryConfig } from './engine/astro/index.ts';

export default defineConfig(await factoryConfig());
