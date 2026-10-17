<?php
// Proxy IA TuneLab FPV pour hébergement PHP (o2switch / cPanel)
// La clé API est lue dans un fichier HORS du dossier web (voir README, section o2switch).

header('Content-Type: application/json; charset=utf-8');

$cfgPaths = [
    dirname(__DIR__, 2) . '/tunelab-secret.php',   // ex : /home/<user>/tunelab-secret.php si la racine du site est /home/<user>/tune.domaine.fr
    dirname(__DIR__, 3) . '/tunelab-secret.php',
];
$cfg = null;
foreach ($cfgPaths as $p) { if (is_readable($p)) { $cfg = require $p; break; } }
if (!$cfg || empty($cfg['ANTHROPIC_API_KEY'])) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Configuration serveur manquante (tunelab-secret.php).']]);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $cfg['ALLOWED_ORIGIN'] ?? '';
if ($allowed && $origin && $origin === $allowed) {
    header('Access-Control-Allow-Origin: ' . $allowed);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: content-type, authorization, x-access-token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => ['message' => 'POST uniquement']]); exit; }

// Jeton d'accès (Authorization: Bearer ... ou X-Access-Token)
if (!empty($cfg['ACCESS_TOKEN'])) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $tok = $_SERVER['HTTP_X_ACCESS_TOKEN'] ?? (str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : '');
    if (!hash_equals($cfg['ACCESS_TOKEN'], (string)$tok)) {
        http_response_code(401);
        echo json_encode(['error' => ['message' => "Jeton d'accès invalide"]]);
        exit;
    }
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || empty($in['messages'])) { http_response_code(400); echo json_encode(['error' => ['message' => 'Requête invalide']]); exit; }

$payload = [
    'model'      => $in['model'] ?? 'claude-sonnet-5-5',
    'max_tokens' => min((int)($in['max_tokens'] ?? 2000), 4000),
    'system'     => $in['system'] ?? '',
    'messages'   => $in['messages'],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 120,
    CURLOPT_HTTPHEADER     => [
        'content-type: application/json',
        'x-api-key: ' . $cfg['ANTHROPIC_API_KEY'],
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($res === false) { http_response_code(502); echo json_encode(['error' => ['message' => 'Appel API impossible : ' . $err]]); exit; }
http_response_code($code ?: 502);
echo $res;
