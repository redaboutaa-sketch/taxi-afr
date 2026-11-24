<?php
declare(strict_types=1);

namespace Factory\Form;

/**
 * Limitation de débit par adresse, partagée entre tous les processus PHP-FPM :
 * un fichier par clé (empreinte HMAC de l'adresse, jamais l'adresse en clair),
 * verrou exclusif `flock` pendant lecture-écriture. Fenêtre glissante simple.
 * Limite : un répertoire local au serveur — plusieurs serveurs derrière un
 * répartiteur auraient chacun leur compteur.
 */
final class RateLimiter
{
    public function __construct(
        private readonly string $dir,
        private readonly int $max,
        private readonly int $windowSeconds,
        private readonly string $salt,
    ) {
    }

    public function hit(string $clientKey, int $now): bool
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true) && !is_dir($this->dir)) {
            throw new \RuntimeException('rate_limit_storage');
        }
        $file = $this->dir . '/' . hash_hmac('sha256', $clientKey, $this->salt) . '.json';
        $h = fopen($file, 'c+');
        if ($h === false) {
            throw new \RuntimeException('rate_limit_storage');
        }
        try {
            if (!flock($h, LOCK_EX)) {
                throw new \RuntimeException('rate_limit_lock');
            }
            $raw = stream_get_contents($h);
            $stamps = is_string($raw) && $raw !== '' ? (json_decode($raw, true) ?: []) : [];
            $stamps = array_values(array_filter($stamps, fn ($t): bool => is_int($t) && $t > $now - $this->windowSeconds));
            $allowed = count($stamps) < $this->max;
            if ($allowed) {
                $stamps[] = $now;
            }
            ftruncate($h, 0);
            rewind($h);
            fwrite($h, json_encode($stamps));
            fflush($h);
            return $allowed;
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }
}
