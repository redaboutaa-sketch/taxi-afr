<?php
declare(strict_types=1);
// Outil de test : valide des vecteurs JSON avec le validateur serveur.
// Usage : php cli/validate.php <contrat.json> [<instant UTC en s>] < vecteurs.json  → résultats JSON
require __DIR__ . '/../src/Contract.php';

$contract = json_decode((string) file_get_contents($argv[1]), true, 32, JSON_THROW_ON_ERROR);
$vectors = json_decode((string) stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
$c = new Factory\Form\Contract($contract);
echo json_encode(array_map(static fn (array $v): array => $c->validate($v, isset($argv[2]) ? (int) $argv[2] : null), $vectors), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
