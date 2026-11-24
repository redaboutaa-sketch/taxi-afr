<?php
declare(strict_types=1);

/*
 * Amorçage de l'endpoint. Vit HORS de la racine publique (release/app/).
 * Aucune valeur secrète ici : identifiants SMTP lus dans l'environnement
 * du pool PHP-FPM, sous les noms indiqués par config/runtime.json.
 */
require __DIR__ . '/vendor/autoload.php';

use Factory\Form\Contract;
use Factory\Form\Handler;
use Factory\Form\Mailer;
use Factory\Form\RateLimiter;

$read = static function (string $file): array {
    $data = json_decode((string) file_get_contents(__DIR__ . '/config/' . $file), true, 32, JSON_THROW_ON_ERROR);
    return is_array($data) ? $data : [];
};

$log = static function (string $line): void {
    error_log('[factory-form] ' . $line);
};

try {
    $runtime = $read('runtime.json');
    $varDir = getenv('FACTORY_VAR_DIR') ?: $runtime['varDir'];
    $saltFile = $varDir . '/ratelimit.salt';
    if (!is_file($saltFile)) {
        @mkdir($varDir, 0700, true);
        @file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($saltFile, 0600);
    }
    $salt = (string) @file_get_contents($saltFile);
    if ($salt === '') {
        throw new RuntimeException('salt');
    }
    $handler = new Handler(
        $runtime,
        new Contract($read('form-contract.json')),
        new Mailer($runtime['smtp']),
        new RateLimiter($varDir . '/ratelimit', (int) $runtime['rateLimit']['max'], (int) $runtime['rateLimit']['windowSeconds'], $salt),
        Closure::fromCallable($log),
    );
    $response = $handler->handle($_SERVER, $_POST, time());
} catch (Throwable $e) {
    $log('outcome=server_error detail=' . get_class($e));
    $response = ['status' => 500, 'headers' => ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'], 'body' => '{"status":"server_error"}'];
}

http_response_code($response['status']);
foreach ($response['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
echo $response['body'];
