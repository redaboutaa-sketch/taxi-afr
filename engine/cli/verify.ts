/**
 * release:verify — vérification de PROVENANCE avant déploiement, sur le poste
 * de l'opérateur (le serveur n'a pas besoin de gh).
 *
 * L'empreinte à transmettre à factory-deploy n'est affichée QUE si
 * `gh attestation verify` confirme que l'archive a été produite par le
 * workflow de publication de CE dépôt, ET que l'attestation porte sur ces
 * octets précis. Une empreinte seule prouve l'intégrité, pas l'origine.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

export const RELEASE_WORKFLOW = '.github/workflows/release.yml';

interface Verification {
  verificationResult?: { statement?: { subject?: Array<{ name?: string; digest?: { sha256?: string } }> } };
}

export async function verifyCmd(opts: { archive?: string; repo?: string }): Promise<number> {
  if (!opts.archive || !opts.repo) {
    console.error('Usage : npm run release:verify -- --archive <id>.tar.gz --repo <propriétaire/dépôt>');
    return 2;
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(opts.repo)) {
    console.error('✗ --repo attendu sous la forme propriétaire/dépôt');
    return 2;
  }
  if (!existsSync(opts.archive)) {
    console.error(`✗ archive introuvable : ${opts.archive}`);
    return 1;
  }
  const sha = createHash('sha256').update(readFileSync(opts.archive)).digest('hex');
  const signer = `${opts.repo}/${RELEASE_WORKFLOW}`;
  const r = spawnSync('gh', ['attestation', 'verify', opts.archive, '--repo', opts.repo, '--signer-workflow', signer, '--format', 'json'], { encoding: 'utf8' });
  if (r.error) {
    console.error('✗ GitHub CLI (gh) introuvable : la provenance ne peut pas être vérifiée. Aucune empreinte n’est fournie.');
    return 1;
  }
  if (r.status !== 0) {
    console.error(`✗ attestation NON vérifiée — ne pas déployer.\n${(r.stderr || r.stdout).trim()}`);
    return 1;
  }
  let results: Verification[];
  try {
    results = JSON.parse(r.stdout) as Verification[];
  } catch {
    console.error('✗ réponse de gh illisible — ne pas déployer.');
    return 1;
  }
  const digests = results.flatMap((v) => v.verificationResult?.statement?.subject ?? []).map((s) => s.digest?.sha256);
  if (!digests.includes(sha)) {
    console.error('✗ aucune attestation ne porte sur l’empreinte de cette archive — ne pas déployer.');
    return 1;
  }
  console.log(`✓ provenance vérifiée : ${basename(opts.archive)} produite par ${signer}`);
  console.log(`  sha256 : ${sha}`);
  console.log('  Déploiement (sur le serveur, empreinte transmise par l’opérateur) :');
  console.log(`  FACTORY_ROOT=/srv/<site> factory-deploy install --archive ${basename(opts.archive)} --sha256 ${sha} --activate --health https://<hôte>/ --reload '<commande>'`);
  return 0;
}
