/**
 * Types date / time / integer et règle `datetime-future` (usine 0.2.0).
 * Contrat de TEST générique (aucune donnée client). Mêmes vecteurs côté JS
 * et côté PHP, instant présent FIXÉ, et exécution sous des fuseaux système
 * volontairement différents : le résultat ne doit dépendre que du fuseau
 * déclaré dans le contrat.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FormContract, serverContract, validateSubmission, localToInstants } from '../form/index.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const image = process.env.FACTORY_PARITY_PHP_IMAGE;
const phpCmd = (args: string[]): [string, string[]] =>
  image ? ['docker', ['run', '--rm', '-i', '-v', `${ROOT}:/w:ro`, '-v', `${tmpdir()}:${tmpdir()}:ro`, '-w', '/w', image, 'php', ...args]] : ['php', args];
const php = spawnSync(...phpCmd(['-r', 'echo PHP_VERSION;']), { encoding: 'utf8' });
const hasPhp = php.status === 0;
if (!hasPhp && process.env.FACTORY_REQUIRE_PHP === '1') throw new Error('PHP CLI requis (FACTORY_REQUIRE_PHP=1)');

const parsed = FormContract.parse({
  fields: [
    { name: 'phone', kind: 'tel', required: true, maxLength: 40, label: { fr: 'Téléphone' } },
    { name: 'day', kind: 'date', required: true, maxLength: 10, label: { fr: 'Date' } },
    { name: 'hour', kind: 'time', required: true, maxLength: 8, label: { fr: 'Heure' } },
    { name: 'people', kind: 'integer', required: false, maxLength: 3, min: 1, max: 8, label: { fr: 'Personnes' } },
    { name: 'note', kind: 'textarea', required: false, maxLength: 500, label: { fr: 'Précisions' } },
  ],
  rules: [{ kind: 'datetime-future', date: 'day', time: 'hour', timeZone: 'Europe/Paris', minLeadMinutes: 60, maxDaysAhead: 365 }],
  honeypot: 'website',
  results: { fr: { accepted: '/ok/', invalid: '/ko/', unavailable: '/indispo/' } },
  subject: { fr: 'Test' },
});
const contract = serverContract(parsed, 'fr');

/** 2026-11-24 12:00 UTC = 13:00 à Paris (heure d'hiver). */
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0) / 1000;
const ok = { phone: '+33 6 00 00 00 00', day: '2026-12-01', hour: '08:15' };

const vectors: Array<Record<string, unknown>> = [
  ok,
  { ...ok, people: '3', note: 'Deux valises.' },
  { ...ok, people: '03' },
  { ...ok, people: '0' },
  { ...ok, people: '9' },
  { ...ok, people: '2.5' },
  { ...ok, people: '-1' },
  { ...ok, people: 'dx' },
  { ...ok, day: '2027-02-29' },
  { ...ok, day: '2028-02-29' },
  { ...ok, day: '2026-04-31' },
  { ...ok, day: '2026-13-01' },
  { ...ok, day: '01/12/2026' },
  { ...ok, day: '2026-12-1' },
  { ...ok, hour: '24:00' },
  { ...ok, hour: '8:15' },
  { ...ok, hour: '08:60' },
  { ...ok, hour: '08:15:00' },
  // Passé, trop tôt (< 60 min), limite exacte, trop loin.
  { ...ok, day: '2026-11-24', hour: '12:59' },
  { ...ok, day: '2026-11-24', hour: '13:00' },
  { ...ok, day: '2026-11-24', hour: '13:30' },
  { ...ok, day: '2026-11-24', hour: '14:00' },
  { ...ok, day: '2027-11-24', hour: '13:00' },
  { ...ok, day: '2027-11-24', hour: '13:01' },
  // Passage à l'heure d'été (29 mars 2027 : 02:00 → 03:00) : 02:30 n'existe pas.
  { ...ok, day: '2027-03-28', hour: '02:30' },
  { ...ok, day: '2027-03-28', hour: '01:59' },
  { ...ok, day: '2027-03-28', hour: '03:00' },
  // Retour à l'heure d'hiver (31 octobre 2027 : 03:00 → 02:00) : 02:30 existe deux fois.
  { ...ok, day: '2027-10-31', hour: '02:30' },
  { ...ok, day: '2027-10-31', hour: '01:59' },
  { ...ok, day: '2027-10-31', hour: '03:00' },
  // Erreurs combinées : la règle ne s'évalue pas sur des champs invalides.
  { ...ok, day: '2026-02-30', hour: '25:00' },
  { ...ok, day: '', hour: '' },
  { ...ok, hour: '08:15\r\nBcc: x@example.com' },
  { ...ok, day: ['2026-12-01'] },
  { ...ok, phone: '' },
];

const jsAll = vectors.map((v) => validateSubmission(contract, v, NOW));
const codes = (i: number) => jsAll[i]!.errors.map((e) => `${e.field}:${e.code}`);

describe('types date / time / integer et règle datetime-future (JS)', () => {
  it('valeurs normales acceptées, entier normalisé', () => {
    expect(jsAll[0]!.ok).toBe(true);
    expect(jsAll[1]!.ok).toBe(true);
    expect(jsAll[2]!.values.people).toBe('3');
  });
  it('bornes et formats numériques', () => {
    expect(codes(3)).toEqual(['people:out_of_range']);
    expect(codes(4)).toEqual(['people:out_of_range']);
    for (const i of [5, 6, 7]) expect(codes(i)).toEqual(['people:invalid_number']);
  });
  it('dates impossibles et formats refusés', () => {
    expect(codes(8)).toEqual(['day:invalid_date']);
    expect(codes(9)).toEqual(['day:too_far']); // date réelle (bissextile), mais au-delà de l’horizon
    for (const i of [10, 11, 12, 13]) expect(codes(i)).toEqual(['day:invalid_date']);
    for (const i of [14, 15, 16, 17]) expect(codes(i)).toEqual(['hour:invalid_time']);
  });
  it('passé, délai minimal, horizon', () => {
    expect(codes(18)).toEqual(['day:in_the_past']);
    expect(codes(19)).toEqual(['day:in_the_past']);
    expect(codes(20)).toEqual(['day:too_soon']);
    expect(jsAll[21]!.ok).toBe(true);
    expect(jsAll[22]!.ok).toBe(true);
    expect(codes(23)).toEqual(['day:too_far']);
  });
  it('heure inexistante ou ambiguë : précision demandée, jamais interprétée', () => {
    expect(codes(24)).toEqual(['hour:nonexistent_time']);
    expect(jsAll[25]!.ok).toBe(true);
    expect(jsAll[26]!.ok).toBe(true);
    expect(codes(27)).toEqual(['hour:ambiguous_time']);
    expect(jsAll[28]!.ok).toBe(true);
    expect(jsAll[29]!.ok).toBe(true);
  });
  it('conversion de fuseau : heure d’hiver UTC+1, heure d’été UTC+2', () => {
    expect(localToInstants('2026-12-01', '08:15', 'Europe/Paris')).toEqual([Date.UTC(2026, 11, 1, 7, 15) / 1000]);
    expect(localToInstants('2027-07-01', '08:15', 'Europe/Paris')).toEqual([Date.UTC(2027, 6, 1, 6, 15) / 1000]);
    expect(localToInstants('2027-10-31', '02:30', 'Europe/Paris')).toEqual([Date.UTC(2027, 9, 31, 0, 30) / 1000, Date.UTC(2027, 9, 31, 1, 30) / 1000]);
    expect(localToInstants('2027-03-28', '02:30', 'Europe/Paris')).toEqual([]);
  });
  it('règle non évaluée sur des champs invalides ou vides ; injection refusée', () => {
    expect(codes(30)).toEqual(['day:invalid_date', 'hour:invalid_time']);
    expect(codes(31)).toEqual(['day:required', 'hour:required']);
    expect(codes(32)).toEqual(['hour:invalid_chars']);
    expect(codes(33)).toEqual(['day:not_a_string']);
    expect(codes(34)).toEqual(['phone:required']);
  });
  it('résultat identique quel que soit le fuseau du processus Node', () => {
    const script = `import { validateSubmission } from ${JSON.stringify(join(ROOT, 'engine/form/validate.ts'))};
const [c, v, n] = JSON.parse(process.argv[1]); console.log(JSON.stringify(v.map((x) => validateSubmission(c, x, n))));`;
    for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify([contract, vectors, NOW])], { encoding: 'utf8', env: { ...process.env, TZ: tz } });
      expect(r.status, r.stderr).toBe(0);
      expect(JSON.parse(r.stdout), tz).toEqual(jsAll);
    }
  });
});

describe('contrat : rejets à la déclaration', () => {
  const base = { honeypot: 'website', results: {}, subject: { fr: 'x' } };
  it('règle sur un champ qui n’est pas date/time, fuseau inconnu, min/max hors integer', () => {
    expect(FormContract.safeParse({ ...base, fields: [{ name: 'a', kind: 'text', required: true, maxLength: 9, label: { fr: 'a' } }, { name: 'b', kind: 'time', required: true, maxLength: 5, label: { fr: 'b' } }], rules: [{ kind: 'datetime-future', date: 'a', time: 'b', timeZone: 'Europe/Paris' }] }).success).toBe(false);
    expect(FormContract.safeParse({ ...base, fields: [{ name: 'a', kind: 'date', required: true, maxLength: 10, label: { fr: 'a' } }, { name: 'b', kind: 'time', required: true, maxLength: 5, label: { fr: 'b' } }], rules: [{ kind: 'datetime-future', date: 'a', time: 'b', timeZone: 'Europe/Nulle_Part' }] }).success).toBe(false);
    expect(FormContract.safeParse({ ...base, fields: [{ name: 'a', kind: 'text', required: true, maxLength: 9, min: 1, label: { fr: 'a' } }] }).success).toBe(false);
    expect(FormContract.safeParse({ ...base, fields: [{ name: 'a', kind: 'integer', required: true, maxLength: 3, min: 5, max: 2, label: { fr: 'a' } }] }).success).toBe(false);
  });
});

describe.skipIf(!hasPhp)(`parité JS / PHP date-heure ${php.stdout}`, () => {
  it('mêmes erreurs et valeurs, PHP sous un fuseau par défaut volontairement différent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parity-dt-'));
    writeFileSync(join(dir, 'contract.json'), JSON.stringify(contract));
    for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles']) {
      const r = spawnSync(...phpCmd(['-d', `date.timezone=${tz}`, 'engine/form/php/cli/validate.php', join(dir, 'contract.json'), String(NOW)]), { cwd: ROOT, input: JSON.stringify(vectors), encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      const phpResults = JSON.parse(r.stdout) as unknown[];
      vectors.forEach((v, i) => expect(phpResults[i], `${tz} ${JSON.stringify(v).slice(0, 80)}`).toEqual(jsAll[i]));
    }
  });
});
