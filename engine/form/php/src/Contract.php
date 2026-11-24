<?php
declare(strict_types=1);

namespace Factory\Form;

/**
 * Validateur serveur — MÊMES règles que engine/form/contract.ts.
 * Toute modification se fait des deux côtés ; la parité est vérifiée par
 * engine/tests/form-parity.test.ts. En cas de divergence, le serveur fait foi.
 */
final class Contract
{
    public const EMAIL_PATTERN = '/^[^ \t\n@<>()\[\]\\\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u';
    public const TEL_PATTERN = '/^\+?[0-9 ().-]{6,25}$/u';
    public const DATE_PATTERN = '/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u';
    public const TIME_PATTERN = '/^([01][0-9]|2[0-3]):([0-5][0-9])$/u';
    public const INTEGER_PATTERN = '/^[0-9]{1,9}$/u';
    private const CONTROL = '/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u';

    /** @param array{honeypot:string, fields:list<array{name:string,kind:string,required:bool,maxLength:int,options:?list<string>,min?:?int,max?:?int,label?:string}>, rules?:list<array<string,mixed>>} $contract */
    public function __construct(private readonly array $contract)
    {
    }

    /**
     * @param array<string, mixed> $input
     * @return array{ok:bool, errors:list<array{field:string,code:string}>, values:array<string,string>}
     */
    public function validate(array $input, ?int $now = null): array
    {
        $now ??= time();
        $errors = [];
        $values = [];
        $valid = [];
        $known = array_merge(array_column($this->contract['fields'], 'name'), [$this->contract['honeypot'], 'locale']);
        foreach (array_keys($input) as $key) {
            if (!in_array((string) $key, $known, true)) {
                $errors[] = ['field' => (string) $key, 'code' => 'unexpected_field'];
            }
        }
        foreach ($this->contract['fields'] as $f) {
            $raw = $input[$f['name']] ?? null;
            if ($raw !== null && !is_string($raw)) {
                $errors[] = ['field' => $f['name'], 'code' => 'not_a_string'];
                continue;
            }
            $v = str_replace(["\r\n", "\r"], "\n", $raw ?? '');
            if (!mb_check_encoding($v, 'UTF-8')) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_chars'];
                continue;
            }
            $v = trim($v, " \t\n");
            if ($f['kind'] !== 'textarea' && str_contains($v, "\n")) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_chars'];
                continue;
            }
            if (preg_match(self::CONTROL, $v) === 1) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_chars'];
                continue;
            }
            if ($v === '') {
                if ($f['required']) {
                    $errors[] = ['field' => $f['name'], 'code' => 'required'];
                }
                $values[$f['name']] = '';
                continue;
            }
            if (mb_strlen($v, 'UTF-8') > $f['maxLength']) {
                $errors[] = ['field' => $f['name'], 'code' => 'too_long'];
                continue;
            }
            $value = $v;
            $code = null;
            if ($f['kind'] === 'email' && preg_match(self::EMAIL_PATTERN, $v) !== 1) {
                $code = 'invalid_email';
            } elseif ($f['kind'] === 'tel' && preg_match(self::TEL_PATTERN, $v) !== 1) {
                $code = 'invalid_tel';
            } elseif ($f['kind'] === 'select' && !in_array($v, $f['options'] ?? [], true)) {
                $code = 'invalid_option';
            } elseif ($f['kind'] === 'date' && !self::isRealDate($v)) {
                $code = 'invalid_date';
            } elseif ($f['kind'] === 'time' && preg_match(self::TIME_PATTERN, $v) !== 1) {
                $code = 'invalid_time';
            } elseif ($f['kind'] === 'integer') {
                if (preg_match(self::INTEGER_PATTERN, $v) !== 1) {
                    $code = 'invalid_number';
                } else {
                    $n = (int) $v;
                    $value = (string) $n;
                    $min = $f['min'] ?? null;
                    $max = $f['max'] ?? null;
                    if (($min !== null && $n < $min) || ($max !== null && $n > $max)) {
                        $code = 'out_of_range';
                    }
                }
            }
            if ($code !== null) {
                $errors[] = ['field' => $f['name'], 'code' => $code];
            } else {
                $valid[$f['name']] = true;
            }
            $values[$f['name']] = $value;
        }

        foreach ($this->contract['rules'] ?? [] as $r) {
            if (($r['kind'] ?? '') !== 'datetime-future') {
                continue;
            }
            $date = $values[$r['date']] ?? '';
            $time = $values[$r['time']] ?? '';
            if (!isset($valid[$r['date']], $valid[$r['time']]) || $date === '' || $time === '') {
                continue;
            }
            $instants = self::localToInstants($date, $time, (string) $r['timeZone']);
            if (count($instants) === 0) {
                $errors[] = ['field' => $r['time'], 'code' => 'nonexistent_time'];
                continue;
            }
            if (count($instants) > 1) {
                $errors[] = ['field' => $r['time'], 'code' => 'ambiguous_time'];
                continue;
            }
            $at = $instants[0];
            if ($at <= $now) {
                $errors[] = ['field' => $r['date'], 'code' => 'in_the_past'];
            } elseif ($at < $now + ((int) $r['minLeadMinutes']) * 60) {
                $errors[] = ['field' => $r['date'], 'code' => 'too_soon'];
            } elseif ($at > $now + ((int) $r['maxDaysAhead']) * 86400) {
                $errors[] = ['field' => $r['date'], 'code' => 'too_far'];
            }
        }
        usort($errors, static fn (array $a, array $b): int => [$a['field'], $a['code']] <=> [$b['field'], $b['code']]);
        return ['ok' => $errors === [], 'errors' => $errors, 'values' => $values];
    }

    public static function isRealDate(string $v): bool
    {
        if (preg_match(self::DATE_PATTERN, $v, $m) !== 1) {
            return false;
        }
        $y = (int) $m[1];
        $mo = (int) $m[2];
        $d = (int) $m[3];
        return $y >= 1900 && checkdate($mo, $d, $y);
    }

    /** Décalage (secondes) du fuseau à l'instant $epoch. */
    public static function zoneOffset(\DateTimeZone $tz, int $epoch): int
    {
        return $tz->getOffset(new \DateTimeImmutable('@' . $epoch));
    }

    /**
     * Instants UTC d'une heure murale locale — même algorithme que validate.ts :
     * 0 = inexistante, 2 = ambiguë. Indépendant du fuseau par défaut du serveur.
     * @return list<int>
     */
    public static function localToInstants(string $date, string $time, string $timeZone): array
    {
        $tz = new \DateTimeZone($timeZone);
        [$y, $mo, $d] = array_map('intval', explode('-', $date));
        [$h, $mi] = array_map('intval', explode(':', $time));
        $wall = gmmktime($h, $mi, 0, $mo, $d, $y);
        $out = [];
        foreach ([$wall - 86400, $wall + 86400] as $probe) {
            $candidate = $wall - self::zoneOffset($tz, $probe);
            if (self::zoneOffset($tz, $candidate) === $wall - $candidate) {
                $out[$candidate] = $candidate;
            }
        }
        $out = array_values($out);
        sort($out);
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function rules(): array
    {
        return $this->contract['rules'] ?? [];
    }

    public function honeypot(): string
    {
        return $this->contract['honeypot'];
    }

    /** @return list<array{name:string,kind:string}> */
    public function fields(): array
    {
        return $this->contract['fields'];
    }
}
