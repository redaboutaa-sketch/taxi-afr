/**
 * Diagnostic d'environnement. N'affiche jamais une valeur de secret : seules
 * la présence ou l'absence des variables référencées sont rapportées.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssues } from '../contracts/issues.ts';
import { loadBrief, siteDir } from '../config/load.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

type Level = 'ok' | 'warn' | 'fail';
const rows: Array<[Level, string, string]> = [];
const report = (level: Level, label: string, detail = '') => rows.push([level, label, detail]);

const version = (cmd: string, args: string[]): string | null => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }).trim();
  } catch {
    return null;
  }
};

const semver = (v: string) => v.replace(/^v/, '').split('.').map(Number) as [number, number, number];
const gte = (a: number[], b: number[]) => {
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
};

export async function doctor(): Promise<number> {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { packageManager: string };
  const pinned = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();

  // Node : 26.x (défaut, .nvmrc) ou 24.x maintenu, aux patchs minimaux corrigés.
  const node = semver(process.version);
  const minimum: Record<number, [number, number, number]> = { 24: [24, 22, 3], 26: [26, 13, 1] };
  const floor = minimum[node[0]];
  if (!floor) report('fail', `Node ${process.version}`, `versions supportées : 26.x (défaut ${pinned}) ou 24.x`);
  else if (!gte(node, floor)) report('fail', `Node ${process.version}`, `patch minimal ${floor.join('.')}`);
  else report(process.version === `v${pinned}` ? 'ok' : 'warn', `Node ${process.version}`, process.version === `v${pinned}` ? '' : `référence de l’usine : ${pinned}`);

  const npmWanted = pkg.packageManager.split('@')[1] ?? '';
  const npm = version('npm', ['--version']);
  report(npm === npmWanted ? 'ok' : 'warn', `npm ${npm ?? 'absent'}`, npm === npmWanted ? '' : `attendu ${npmWanted} (packageManager)`);
  report(existsSync(join(ROOT, 'node_modules', 'astro')) ? 'ok' : 'fail', 'dépendances installées', 'npm ci');

  // Site et brief.
  const dir = siteDir();
  const where = relative(process.cwd(), dir) || '.';
  if (!existsSync(dir)) {
    report('warn', `site ${where}/ absent`, 'npm run factory:init -- --example fixture-a-services (ou --brief <chemin>)');
  } else {
    const res = await loadBrief(dir, 'draft');
    if (!res.ok) report('fail', `brief ${where}`, formatIssues(res.issues));
    else {
      report('ok', `brief ${where} (déclaré ${res.brief.mode})`);
      const smtp = res.brief.email.smtp;
      for (const ref of smtp ? [smtp.username, smtp.password] : []) {
        const name = ref.slice(4);
        report(process.env[name] ? 'ok' : 'warn', `secret ${name}`, process.env[name] ? 'présent (valeur non affichée)' : 'absent de l’environnement');
      }
    }
  }

  // Outils des incréments suivants : informatifs.
  const php = version('php', ['-r', 'echo PHP_VERSION;']);
  report(php && gte(semver(php), [8, 4, 0]) ? 'ok' : 'warn', `PHP CLI ${php ?? 'absent'}`, 'profil formulaire : PHP-FPM 8.4 corrigé, via conteneur de recette');
  report(version('composer', ['--version']) ? 'ok' : 'warn', 'Composer', version('composer', ['--version'])?.split(' ')[2] ?? 'absent');
  report(version('docker', ['info', '--format', '{{.ServerVersion}}']) ? 'ok' : 'warn', 'Docker (démon)', version('docker', ['info', '--format', '{{.ServerVersion}}']) ?? 'indisponible — recette nginx/PHP-FPM impossible localement');

  try {
    const pw = await import('@playwright/test');
    for (const b of ['chromium', 'firefox', 'webkit'] as const) {
      const path = pw[b].executablePath();
      report(existsSync(path) ? 'ok' : 'warn', `navigateur ${b}`, existsSync(path) ? '' : 'non installé (npx playwright install <navigateur> dans la version verrouillée)');
    }
  } catch {
    report('warn', 'Playwright', 'non chargeable');
  }

  const mark = { ok: '✓', warn: '!', fail: '✗' } as const;
  for (const [level, label, detail] of rows) console.log(`  ${mark[level]} ${label}${detail ? ` — ${detail}` : ''}`);
  const failed = rows.filter((r) => r[0] === 'fail').length;
  console.log(`\n  ${failed ? `${failed} problème(s) bloquant(s)` : 'aucun problème bloquant'}`);
  return failed ? 1 : 0;
}
