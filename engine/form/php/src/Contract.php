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
    private const CONTROL = '/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u';

    /** @param array{honeypot:string, fields:list<array{name:string,kind:string,required:bool,maxLength:int,options:?list<string>}>} $contract */
    public function __construct(private readonly array $contract)
    {
    }

    /**
     * @param array<string, mixed> $input
     * @return array{ok:bool, errors:list<array{field:string,code:string}>, values:array<string,string>}
     */
    public function validate(array $input): array
    {
        $errors = [];
        $values = [];
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
            if ($f['kind'] === 'email' && preg_match(self::EMAIL_PATTERN, $v) !== 1) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_email'];
            } elseif ($f['kind'] === 'tel' && preg_match(self::TEL_PATTERN, $v) !== 1) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_tel'];
            } elseif ($f['kind'] === 'select' && !in_array($v, $f['options'] ?? [], true)) {
                $errors[] = ['field' => $f['name'], 'code' => 'invalid_option'];
            }
            $values[$f['name']] = $v;
        }
        usort($errors, static fn (array $a, array $b): int => [$a['field'], $a['code']] <=> [$b['field'], $b['code']]);
        return ['ok' => $errors === [], 'errors' => $errors, 'values' => $values];
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
