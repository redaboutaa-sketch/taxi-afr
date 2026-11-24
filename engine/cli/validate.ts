import { relative } from 'node:path';
import { MODES, type Mode } from '../contracts/brief.ts';
import { formatIssues } from '../contracts/issues.ts';
import { checkProductionReadiness } from '../contracts/rules.ts';
import { loadBrief, siteDir } from '../config/load.ts';

export async function validate(opts: { mode?: string; production?: boolean }): Promise<number> {
  const mode = (opts.mode ?? 'draft') as Mode;
  if (!MODES.includes(mode)) {
    console.error(`--mode attendu : ${MODES.join(' | ')}`);
    return 2;
  }
  const dir = siteDir();
  const where = relative(process.cwd(), dir) || '.';
  const result = await loadBrief(dir, mode);
  if (!result.ok) {
    console.error(`✗ brief refusé (${where}, mode ${mode}) — ${result.issues.length} point(s) :${formatIssues(result.issues)}\n`);
    return 1;
  }
  console.log(`✓ brief valide (${where}, mode ${mode})`);
  if (opts.production) {
    const readiness = checkProductionReadiness(result.brief);
    if (readiness.length) {
      console.error(`✗ non prêt pour la production :${formatIssues(readiness)}`);
      console.error('  Les vérifications externes (DNS, réception réelle, hébergement) restent pending_external.\n');
      return 1;
    }
    console.log('✓ prérequis de production internes au brief réunis — vérifications externes encore à observer');
  }
  return 0;
}
