/**
 * Parité des validateurs JS et PHP sur les mêmes vecteurs. Exige un PHP CLI
 * (>= 8.3 accepté pour ce test ; le runtime de production vise 8.4).
 * Sans PHP : test sauté localement, ÉCHEC si FACTORY_REQUIRE_PHP=1 (CI).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFormContract, serverContract, validateSubmission } from '../form/index.ts';

const ROOT = resolve(import.meta.dirname, '../..');
/** FACTORY_PARITY_PHP_IMAGE : exécute le validateur PHP dans une image (ex. PHP 8.4 du profil). */
const image = process.env.FACTORY_PARITY_PHP_IMAGE;
const phpCmd = (args: string[]): [string, string[]] =>
  image ? ['docker', ['run', '--rm', '-i', '-v', `${ROOT}:/w:ro`, '-v', `${tmpdir()}:${tmpdir()}:ro`, '-w', '/w', image, 'php', ...args]] : ['php', args];
const php = spawnSync(...phpCmd(['-r', 'echo PHP_VERSION;']), { encoding: 'utf8' });
const hasPhp = php.status === 0;
if (!hasPhp && process.env.FACTORY_REQUIRE_PHP === '1') throw new Error('PHP CLI requis (FACTORY_REQUIRE_PHP=1)');

const contract = serverContract(loadFormContract(join(ROOT, 'examples', 'fixture-a-services'))!);
const ok = { name: 'Camille Martin', company: 'Atelier fictif', email: 'camille@example.org', message: 'Bonjour.' };
const vectors: Array<Record<string, unknown>> = [
  ok,
  { ...ok, size: 'from_50_to_200', locale: 'fr', website: '' },
  {},
  { ...ok, name: '   ' },
  { ...ok, name: 'A\r\nBcc: victime@example.com' },
  { ...ok, email: 'camille@example.org\r\nBcc: x@example.com' },
  { ...ok, email: 'pas une adresse' },
  { ...ok, email: 'élodie@exemple.example' },
  { ...ok, email: `${'a'.repeat(65)}@example.org` },
  { ...ok, name: 'x'.repeat(121) },
  { ...ok, name: 'é'.repeat(120) },
  { ...ok, name: '😀'.repeat(120) },
  { ...ok, name: '😀'.repeat(121) },
  { ...ok, message: 'ligne 1\r\nligne 2\rligne 3' },
  { ...ok, message: `  \t${'m'.repeat(4000)}\n ` },
  { ...ok, message: 'x'.repeat(4001) },
  { ...ok, message: 'bip\u0007' },
  { ...ok, company: ' Société ' },
  { ...ok, size: 'gigantesque' },
  { ...ok, admin: '1' },
  { ...ok, name: ['tableau'] },
  { ...ok, message: '<script>alert(1)</script>' },
];

describe.skipIf(!hasPhp)(`parité JS / PHP ${php.stdout}`, () => {
  it('mêmes erreurs et mêmes valeurs normalisées pour chaque vecteur', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parity-'));
    writeFileSync(join(dir, 'contract.json'), JSON.stringify(contract));
    const r = spawnSync(...phpCmd(['engine/form/php/cli/validate.php', join(dir, 'contract.json')]), {
      cwd: ROOT,
      input: JSON.stringify(vectors),
      encoding: 'utf8',
    });
    expect(r.status, r.stderr).toBe(0);
    const phpResults = JSON.parse(r.stdout) as unknown[];
    const jsResults = vectors.map((v) => validateSubmission(contract, v));
    vectors.forEach((v, i) => expect(phpResults[i], JSON.stringify(v).slice(0, 80)).toEqual(jsResults[i]));
  });
  it('le cas valide est accepté et les injections refusées (sanity)', () => {
    const js = vectors.map((v) => validateSubmission(contract, v));
    expect(js[0]?.ok).toBe(true);
    expect(js[4]?.errors).toContainEqual({ field: 'name', code: 'invalid_chars' });
    expect(js[5]?.errors).toContainEqual({ field: 'email', code: 'invalid_chars' });
  });
});
