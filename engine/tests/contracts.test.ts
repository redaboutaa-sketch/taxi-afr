/**
 * Contrats du brief : un cas valide qui DOIT passer (un validateur qui
 * rejette tout échoue ici) et des cas fautifs qui DOIVENT être refusés,
 * chacun par la règle attendue.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import type { Mode } from '../contracts/brief.ts';
import { checkProductionReadiness } from '../contracts/rules.ts';
import { parseBrief } from '../config/load.ts';
import { normalizeHost, normalizeOrigin } from '../config/network.ts';
import { projectFacts, resolveConfig } from '../config/resolve.ts';

const FIXTURE = readFileSync(new URL('../../examples/fixture-a-services/brief/brief.yaml', import.meta.url), 'utf8');
type Raw = Record<string, any>;
const base = (): Raw => parse(FIXTURE) as Raw;

const rules = (raw: Raw, mode: Mode) => {
  const r = parseBrief(stringify(raw), mode);
  return r.ok ? [] : r.issues.map((i) => i.rule);
};

/** Brief de la fixture complété au niveau release (décisions simulées DANS le test uniquement). */
const releaseReady = (): Raw => {
  const b = base();
  b.mode = 'release';
  for (const f of Object.values(b.facts as Record<string, Raw>)) {
    if (f.publication === 'public' && f.status !== 'confirmed') {
      f.status = 'confirmed';
      f.value ??= 'valeur de test';
      f.sourceRefs = ['test'];
    }
  }
  b.design.selectedDirection = { id: 'a', decidedBy: 'test', decidedOn: '2026-11-24' };
  b.design.renderApproval = { approvedBy: 'test', approvedOn: '2026-11-24', scope: 'test' };
  b.delivery.reviewer = 'test';
  return b;
};

describe('cas valides', () => {
  it('la fixture A est valide en draft et preview', () => {
    expect(rules(base(), 'draft')).toEqual([]);
    expect(rules(base(), 'preview')).toEqual([]);
  });
  it('un brief complété est valide en release', () => {
    expect(rules(releaseReady(), 'release')).toEqual([]);
  });
  it('un champ réellement non applicable et justifié est accepté en release', () => {
    const b = releaseReady();
    expect(b.facts['legal.vatId'].status).toBe('not_applicable');
    expect(rules(b, 'release')).toEqual([]);
  });
  it('un formulaire désactivé n’exige aucune configuration e-mail', () => {
    const b = releaseReady();
    b.form.enabled = false;
    b.market.primaryCta.kind = 'email';
    b.email = { publicContactFact: 'contact.email', transport: 'none' };
    expect(rules(b, 'release')).toEqual([]);
  });
});

describe('rejets de structure', () => {
  it('clé inconnue (ex. mot de passe en clair) refusée', () => {
    const b = base();
    b.email.password = 'hunter2';
    expect(rules(b, 'draft')).toContain('schema.unrecognized_keys');
  });
  it('la valeur d’un champ sensible n’est jamais recopiée dans le rapport', () => {
    const b = base();
    b.email.recipient = 'pas-une-adresse';
    const r = parseBrief(stringify(b), 'draft');
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.issues)).not.toContain('pas-une-adresse');
  });
  it('YAML invalide signalé', () => {
    expect(parseBrief('a: [', 'draft').ok).toBe(false);
  });
  it('secret SMTP fourni en valeur plutôt qu’en référence env: refusé', () => {
    const b = base();
    b.email.transport = 'smtp';
    b.email.smtp = { host: 'smtp.example.com', port: 587, security: 'starttls', username: 'user', password: 'secret' };
    expect(rules(b, 'draft')).toContain('schema.invalid_format');
  });
});

describe('rejets selon le mode', () => {
  it('champ requis manquant en release', () => {
    const b = releaseReady();
    delete b.facts['legal.publisher'];
    expect(rules(b, 'release')).toContain('fact.required');
  });
  it('not_applicable sans justification', () => {
    const b = base();
    delete b.facts['legal.vatId'].justification;
    expect(rules(b, 'draft')).toContain('fact.na-justification');
  });
  it('fait commercial public non confirmé bloqué en release', () => {
    const b = releaseReady();
    b.facts['offer.diagnosticDuration'].status = 'proposed';
    expect(rules(b, 'release')).toContain('fact.public-unconfirmed');
  });
  it('fait confirmé sans source refusé', () => {
    const b = base();
    b.facts['contact.email'].sourceRefs = [];
    expect(rules(b, 'draft')).toContain('fact.confirmed-without-source');
  });
  it('brief déclaré preview validé en release', () => {
    expect(rules(base(), 'release')).toContain('mode.declared-below-requested');
  });
  it('libellé de CTA manquant dans une langue en preview', () => {
    const b = base();
    delete b.market.primaryCta.label.en;
    expect(rules(b, 'draft')).toEqual([]);
    expect(rules(b, 'preview')).toContain('i18n.missing-label');
  });
  it('From hors du domaine d’envoi (alignement DMARC impossible)', () => {
    const b = base();
    b.email.from = 'formulaire@example.org';
    expect(rules(b, 'draft')).toContain('email.from-alignment');
  });
  it('capture locale interdite en release pour un site réel', () => {
    const b = releaseReady();
    b.identity.fictional = false;
    b.network.canonicalOrigin = 'https://www.client-reel.fr';
    b.network.redirectDomains = ['client-reel.fr'];
    b.email.sendingDomain = 'client-reel.fr';
    b.email.from = 'formulaire@client-reel.fr';
    expect(rules(b, 'release')).toContain('email.capture-in-release');
  });
  it('identité fictive sur un domaine non réservé', () => {
    const b = base();
    b.network.canonicalOrigin = 'https://www.ostral.fr';
    b.network.redirectDomains = [];
    expect(rules(b, 'draft')).toContain('identity.fictional-domain');
  });
  it('direction choisie sans approbation du rendu : release refusée (G2 non validée en bloc)', () => {
    const b = releaseReady();
    b.design.renderApproval = null;
    expect(rules(b, 'release')).toEqual(['gate.g2-render']);
  });
  it('approbation du rendu sans direction choisie refusée', () => {
    const b = base();
    b.design.selectedDirection = null;
    b.design.renderApproval = { approvedBy: 'x', approvedOn: '2026-11-24', scope: 'x' };
    expect(rules(b, 'draft')).toContain('gate.g2-order');
  });
  it('démonstration jamais prête pour la production', () => {
    const r = parseBrief(stringify(releaseReady()), 'release');
    expect(r.ok && checkProductionReadiness(r.brief).map((i) => i.rule)).toContain('production.fictional');
  });
});

describe('identité réseau', () => {
  it.each([
    ['javascript:alert(1)', 'schéma'],
    ['https://www.example.com/chemin', 'chemin'],
    ['https://user:pw@www.example.com', 'identifiants'],
    ['http://www.example.com', 'https'],
    ['https://www.example.com:8443', 'port'],
    ['https://www.exa mple.com', 'caractère'],
    ['https://www.example.com\r\nX-Injected: 1', 'caractère'],
    ['https://www.example.com;return 301', 'caractère'],
    ['https://192.0.2.10', 'IP'],
  ])('origine refusée : %s', (raw, why) => {
    const r = normalizeOrigin(raw);
    expect(r.ok, why).toBe(false);
  });
  it('IDN converti en ASCII', () => {
    const r = normalizeOrigin('https://www.café.example');
    expect(r.ok && r.host).toBe('www.xn--caf-dma.example');
  });
  it.each(['*.example.com', 'example.com/x', 'https://example.com', 'exa_mple.com', '-bad.example.com', 'example'])(
    'domaine de redirection refusé : %s',
    (d) => expect(normalizeHost(d).ok).toBe(false),
  );
  it('redirection vers soi-même (boucle) refusée', () => {
    const b = base();
    b.network.redirectDomains = ['www.example.com'];
    expect(rules(b, 'draft')).toContain('network.redirect-loop');
  });
  it('preview sur un hôte de production refusée', () => {
    const b = base();
    b.network.previewOrigin = 'https://example.com';
    expect(rules(b, 'draft')).toContain('network.preview-conflict');
  });
  it('plus de deux domaines secondaires acceptés (pas d’hypothèse « exactement deux »)', () => {
    const b = base();
    b.network.redirectDomains = ['example.com', 'example.org', 'www.example.org', 'example.net'];
    expect(rules(b, 'draft')).toEqual([]);
  });
});

describe('projection publique des faits', () => {
  const parsed = () => {
    const r = parseBrief(FIXTURE, 'preview');
    if (!r.ok) throw new Error('fixture invalide');
    return r.brief;
  };
  it('un fait confirmé mais withheld n’est jamais projeté', () => {
    for (const target of ['preview', 'production'] as const) {
      expect(projectFacts(parsed(), target)['offer.pricing']).toBeUndefined();
    }
  });
  it('un fait proposed est projeté en preview (signalé) et jamais en production', () => {
    expect(projectFacts(parsed(), 'preview')['offer.diagnosticDuration']?.provisional).toBe(true);
    expect(projectFacts(parsed(), 'production')['offer.diagnosticDuration']).toBeUndefined();
  });
  it('la configuration résolue ne contient ni adresse interne ni référence de secret', () => {
    const json = JSON.stringify(resolveConfig(parsed(), { target: 'production' }));
    expect(json).not.toContain('demandes@example.com');
    expect(json).not.toContain('formulaire@mail.example.com');
    expect(json).not.toContain('env:');
  });
  it('la preview n’est jamais indexable', () => {
    expect(resolveConfig(parsed(), { target: 'preview' }).indexable).toBe(false);
  });
});
