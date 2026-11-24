/**
 * Amélioration progressive de la demande de trajet. Sans ce script : envoi
 * e-mail par POST classique et page de résultat. Les règles de validation sont
 * CELLES du serveur (contrat partagé du moteur) ; le serveur reste l'autorité.
 *
 * Aucune saisie n'est stockée (ni localStorage, ni cookie) ni envoyée à un
 * outil de mesure. Le lien WhatsApp n'est construit qu'au clic explicite.
 */
import { validateSubmission, type ErrorCode, type ServerContract } from '@engine/form-client';
import { tripSummary, whatsappLink, type TripInput } from '../lib/trip-message.ts';

interface ClientData {
  contract: ServerContract;
  endpoint: string;
  whatsapp: string | null;
  messages: {
    errors: Record<ErrorCode, string>;
    accepted: string; unavailable: string; network: string; summary: string;
    sending: string; submit: string; copied: string; copyFailed: string;
  };
}

export function initRequestForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-request-form]');
  if (!form) return;
  const data = JSON.parse(form.dataset.client ?? '{}') as ClientData;
  const $ = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel);
  const status = document.querySelector<HTMLElement>('[data-form-status]');
  const summary = $<HTMLElement>('[data-form-summary]');
  const summaryList = $<HTMLElement>('[data-form-summary-list]');
  const submit = $<HTMLButtonElement>('[data-submit]');
  const submitLabel = $<HTMLElement>('[data-submit-label]');
  const waButton = $<HTMLButtonElement>('[data-whatsapp]');
  const recap = $<HTMLElement>('[data-recap]');
  const recapText = $<HTMLElement>('[data-recap-text]');
  const recapOpen = $<HTMLAnchorElement>('[data-recap-open]');
  const recapCopy = $<HTMLButtonElement>('[data-recap-copy]');
  const copyStatus = $<HTMLElement>('[data-recap-copy-status]');
  let busy = false;

  // Le choix WhatsApp n'apparaît qu'avec JavaScript (sinon : lien générique en <noscript>).
  if (waButton && data.whatsapp) {
    waButton.hidden = false;
    const help = $<HTMLElement>('[data-whatsapp-help]');
    if (help) help.hidden = false;
  }

  const values = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of new FormData(form)) if (typeof v === 'string') out[k] = v;
    return out;
  };

  const showErrors = (errors: Array<{ field: string; code: ErrorCode }>) => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (!summary || !summaryList) return;
    summaryList.replaceChildren();
    for (const e of errors) {
      const message = data.messages.errors[e.code] ?? e.code;
      const input = form.elements.namedItem(e.field);
      const slot = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(e.field)}"]`);
      if (slot) slot.textContent = message;
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', 'true');
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${e.field}`;
      const label = form.querySelector(`label[for="${CSS.escape(e.field)}"]`)?.firstChild?.textContent?.trim() ?? e.field;
      a.textContent = `${label} — ${message}`;
      li.append(a);
      summaryList.append(li);
    }
    summary.hidden = errors.length === 0;
    if (errors.length) summary.focus();
  };

  const say = (text: string, tone: 'info' | 'error') => {
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
    status.hidden = false;
    status.focus();
  };

  const setBusy = (value: boolean) => {
    busy = value;
    submit?.setAttribute('aria-disabled', String(value));
    if (submitLabel) submitLabel.textContent = value ? data.messages.sending : data.messages.submit;
  };

  const validate = (): Record<string, string> | null => {
    const v = values();
    const local = validateSubmission(data.contract, v);
    showErrors(local.errors);
    return local.ok ? local.values : null;
  };

  // ── Canal e-mail : envoi par notre serveur ─────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (recap) recap.hidden = true;
    const ok = validate();
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(data.endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values()),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; ref?: string; errors?: Array<{ field: string; code: ErrorCode }> };
      if (res.ok && body.status === 'accepted') {
        form.reset();
        form.hidden = true;
        say(data.messages.accepted.replace('{ref}', body.ref ?? '—'), 'info');
      } else if (res.status === 422 && body.errors) {
        showErrors(body.errors);
      } else {
        say(data.messages.unavailable, 'error');
      }
    } catch {
      say(data.messages.network, 'error');
    } finally {
      setBusy(false);
    }
  });

  // ── Canal WhatsApp : brouillon préparé, envoyé par le visiteur ─────────
  waButton?.addEventListener('click', () => {
    if (status) status.hidden = true;
    const ok = validate();
    if (!ok || !recap || !recapText || !recapOpen) return;
    const trip = ok as unknown as TripInput;
    const text = tripSummary(trip, { forThirdParty: true });
    const link = whatsappLink(data.whatsapp, text);
    if (!link) return;
    recapText.textContent = text;
    recapOpen.href = link;
    recap.hidden = false;
    if (copyStatus) copyStatus.textContent = '';
    recap.focus();
  });

  recapCopy?.addEventListener('click', async () => {
    const text = recapText?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      if (copyStatus) copyStatus.textContent = data.messages.copied;
    } catch {
      if (copyStatus) copyStatus.textContent = data.messages.copyFailed;
    }
  });

  // Toute modification après le récapitulatif l'invalide : on ne laisse pas un lien périmé.
  form.addEventListener('input', () => {
    if (recap && !recap.hidden) {
      recap.hidden = true;
      if (recapOpen) recapOpen.href = '#demande';
    }
  });
}
