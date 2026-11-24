<?php
declare(strict_types=1);

namespace Factory\Form;

/**
 * Traitement d'une soumission. Pur vis-à-vis des superglobales : reçoit
 * $_SERVER / $_POST, renvoie une réponse — testable sans serveur web.
 *
 * Réponses :
 *  - requête du script du site (Accept: application/json) → JSON + statut HTTP ;
 *  - formulaire HTML sans JavaScript → 303 vers une page de résultat du site.
 * Codes publics stables : accepted, invalid, rate_limited, transport_error,
 * transport_not_configured, origin_rejected, method_not_allowed,
 * unsupported_media_type, payload_too_large, server_error.
 */
final class Handler
{
    /** @param array<string,mixed> $runtime */
    public function __construct(
        private readonly array $runtime,
        private readonly Contract $contract,
        private readonly Mailer $mailer,
        private readonly RateLimiter $limiter,
        private readonly \Closure $log,
    ) {
    }

    /**
     * @param array<string,mixed> $server
     * @param array<string,mixed> $post
     * @return array{status:int, headers:array<string,string>, body:string}
     */
    public function handle(array $server, array $post, int $now): array
    {
        $ref = bin2hex(random_bytes(6));
        $wantsJson = str_contains((string) ($server['HTTP_ACCEPT'] ?? ''), 'application/json');
        $locale = is_string($post['locale'] ?? null) && isset($this->runtime['results'][$post['locale']])
            ? $post['locale'] : $this->runtime['defaultLocale'];

        $fail = function (int $status, string $code, string $page, array $extra = []) use ($ref, $wantsJson, $locale): array {
            ($this->log)("ref={$ref} outcome={$code}");
            return $this->respond($status, $code, $ref, $wantsJson, $locale, $page, $extra);
        };

        if (($server['REQUEST_METHOD'] ?? '') !== 'POST') {
            return ['status' => 405, 'headers' => ['Allow' => 'POST'] + $this->baseHeaders(), 'body' => ''];
        }
        if (!str_starts_with(strtolower((string) ($server['CONTENT_TYPE'] ?? '')), 'application/x-www-form-urlencoded')) {
            return $fail(415, 'unsupported_media_type', 'invalid');
        }
        if ((int) ($server['CONTENT_LENGTH'] ?? 0) > (int) $this->runtime['maxBodyBytes']) {
            return $fail(413, 'payload_too_large', 'invalid');
        }
        if (!$this->originAllowed($server)) {
            return $fail(403, 'origin_rejected', 'unavailable');
        }
        $trap = $post[$this->contract->honeypot()] ?? '';
        if (!is_string($trap) || $trap !== '') {
            // Soumission automatisée : on ne transmet rien et on ne le signale pas au robot.
            ($this->log)("ref={$ref} outcome=honeypot");
            return $this->respond(200, 'accepted', $ref, $wantsJson, $locale, 'accepted');
        }
        try {
            if (!$this->limiter->hit((string) ($server['REMOTE_ADDR'] ?? 'unknown'), $now)) {
                return $fail(429, 'rate_limited', 'unavailable');
            }
        } catch (\RuntimeException) {
            return $fail(503, 'server_error', 'unavailable');
        }
        $result = $this->contract->validate($post, $now);
        if (!$result['ok']) {
            return $fail(422, 'invalid', 'invalid', ['errors' => $result['errors']]);
        }
        $lines = [];
        foreach ($this->contract->fields() as $f) {
            $v = $result['values'][$f['name']] ?? '';
            $label = isset($f['label']) && is_string($f['label']) && $f['label'] !== '' ? $f['label'] : $f['name'];
            if ($v !== '') {
                $lines[] = $f['kind'] === 'textarea' ? "{$label} :\n{$v}\n" : "{$label} : {$v}";
            }
        }
        // Rappel explicite de l'instant interprété (fuseau déclaré, décalage UTC).
        foreach ($this->contract->rules() as $r) {
            if (($r['kind'] ?? '') === 'datetime-future' && ($result['values'][$r['date']] ?? '') !== '' && ($result['values'][$r['time']] ?? '') !== '') {
                $instants = Contract::localToInstants($result['values'][$r['date']], $result['values'][$r['time']], (string) $r['timeZone']);
                if (count($instants) === 1) {
                    $local = (new \DateTimeImmutable('@' . $instants[0]))->setTimezone(new \DateTimeZone((string) $r['timeZone']));
                    $lines[] = '';
                    $lines[] = 'Horaire interprété : ' . $local->format('Y-m-d H:i') . ' (' . $r['timeZone'] . ', UTC' . $local->format('P') . ')';
                }
            }
        }
        $lines[] = '';
        $lines[] = "ref: {$ref} · langue: {$locale}";
        $replyTo = '';
        foreach ($this->contract->fields() as $f) {
            if ($f['kind'] === 'email' && ($result['values'][$f['name']] ?? '') !== '') {
                $replyTo = $result['values'][$f['name']];
                break;
            }
        }
        try {
            $this->mailer->send(
                $this->runtime['from'],
                $this->runtime['fromName'],
                $this->runtime['recipient'],
                $replyTo !== '' ? $replyTo : $this->runtime['from'],
                $this->runtime['subject'][$locale] . ' [' . $ref . ']',
                implode("\n", $lines),
            );
        } catch (\RuntimeException $e) {
            $code = $e->getMessage() === 'transport_not_configured' ? 'transport_not_configured' : 'transport_error';
            $detail = $e->getPrevious()?->getMessage() ?? '';
            ($this->log)("ref={$ref} outcome={$code} detail=" . substr(preg_replace('/\s+/', ' ', $detail) ?? '', 0, 300));
            return $this->respond($code === 'transport_error' ? 502 : 503, $code, $ref, $wantsJson, $locale, 'unavailable');
        }
        ($this->log)("ref={$ref} outcome=accepted");
        return $this->respond(200, 'accepted', $ref, $wantsJson, $locale, 'accepted');
    }

    /** @param array<string,mixed> $server */
    private function originAllowed(array $server): bool
    {
        $allowed = $this->runtime['allowedOrigins'];
        $origin = $server['HTTP_ORIGIN'] ?? null;
        if (is_string($origin) && $origin !== '' && $origin !== 'null') {
            return in_array($origin, $allowed, true);
        }
        $referer = $server['HTTP_REFERER'] ?? null;
        if (is_string($referer) && $referer !== '') {
            $p = parse_url($referer);
            if (!is_array($p) || !isset($p['scheme'], $p['host'])) {
                return false;
            }
            $o = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
            return in_array($o, $allowed, true);
        }
        return false;
    }

    /** @return array<string,string> */
    private function baseHeaders(): array
    {
        return ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff', 'X-Robots-Tag' => 'noindex'];
    }

    /** @return array{status:int, headers:array<string,string>, body:string} */
    private function respond(int $status, string $code, string $ref, bool $json, string $locale, string $page, array $extra = []): array
    {
        if ($json) {
            return [
                'status' => $status,
                'headers' => ['Content-Type' => 'application/json; charset=utf-8'] + $this->baseHeaders(),
                'body' => (string) json_encode(['status' => $code, 'ref' => $ref] + $extra, JSON_UNESCAPED_SLASHES),
            ];
        }
        $target = $this->runtime['results'][$locale][$page] . '?ref=' . $ref;
        return ['status' => 303, 'headers' => ['Location' => $target] + $this->baseHeaders(), 'body' => ''];
    }
}
