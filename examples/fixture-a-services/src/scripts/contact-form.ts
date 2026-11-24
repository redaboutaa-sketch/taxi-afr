/**
 * Amélioration progressive du formulaire. Sans ce script, le formulaire
 * fonctionne par POST classique. Les règles de validation sont CELLES du
 * serveur (contrat partagé) ; le serveur reste l'autorité.
 */
import { validateSubmission, type ErrorCode, type ServerContract } from '@engine/form-client';

interface ClientData {
  contract: ServerContract;
  endpoint: string;
  messages: { errors: Record<ErrorCode, string>; accepted: string; unavailable: string; network: string; summary: string; sending: string; submit: string };
}

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const data = JSON.parse(form.dataset.client ?? '{}') as ClientData;
  const status = document.querySelector<HTMLElement>('[data-form-status]');
  const summary = form.querySelector<HTMLElement>('[data-form-summary]');
  const summaryList = form.querySelector<HTMLElement>('[data-form-summary-list]');
  const button = form.querySelector<HTMLButtonElement>('[data-submit]');
  let busy = false;

  const showErrors = (errors: Array<{ field: string; code: ErrorCode }>) => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (!summary || !summaryList) return;
    summaryList.replaceChildren();
    for (const e of errors) {
      const input = form.elements.namedItem(e.field);
      const message = data.messages.errors[e.code] ?? e.code;
      const slot = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(e.field)}"]`);
      if (slot) slot.textContent = message;
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', 'true');
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${e.field}`;
      a.textContent = `${form.querySelector(`label[for="${CSS.escape(e.field)}"]`)?.textContent?.trim() ?? e.field} — ${message}`;
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
  };

  const setBusy = (value: boolean) => {
    busy = value;
    if (!button) return;
    button.setAttribute('aria-disabled', String(value));
    button.textContent = value ? data.messages.sending : data.messages.submit;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const fd = new FormData(form);
    const values: Record<string, string> = {};
    for (const [k, v] of fd) if (typeof v === 'string') values[k] = v;
    const local = validateSubmission(data.contract, values);
    if (!local.ok) return showErrors(local.errors);
    showErrors([]);
    setBusy(true);
    try {
      const res = await fetch(data.endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; ref?: string; errors?: Array<{ field: string; code: ErrorCode }> };
      if (res.ok && body.status === 'accepted') {
        say(data.messages.accepted.replace('{ref}', body.ref ?? '—'), 'info');
        form.reset();
        form.hidden = true;
        status?.focus();
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
}
