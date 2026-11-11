<?php
// Fonctions communes aux points d'entrée de l'API TuneLab (proxy IA + sauvegarde en ligne).
// Ce fichier ne fait rien s'il est appelé directement.

function tl_json(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tl_error(int $code, string $message, array $extra = []): void {
    tl_json($code, ['error' => ['message' => $message]] + $extra);
}

// Charge tunelab-secret.php (HORS du dossier web), pose les en-têtes, vérifie le jeton.
// $methods : méthodes HTTP acceptées en plus d'OPTIONS.
function tl_bootstrap(array $methods): array {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    $cfg = null;
    foreach ([dirname(__DIR__, 2), dirname(__DIR__, 3)] as $dir) {
        // ex : /home/<user>/tunelab-secret.php si la racine du site est /home/<user>/tune.domaine.fr
        $p = $dir . '/tunelab-secret.php';
        if (is_readable($p)) { $cfg = require $p; $cfg['_dir'] = $dir; break; }
    }
    if (!is_array($cfg)) tl_error(500, 'Configuration serveur manquante (tunelab-secret.php).');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = rtrim((string)($cfg['ALLOWED_ORIGIN'] ?? ''), '/');
    if ($allowed !== '' && $origin === $allowed) {
        header('Access-Control-Allow-Origin: ' . $allowed);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: ' . implode(', ', $methods) . ', OPTIONS');
    header('Access-Control-Allow-Headers: content-type, authorization, x-access-token');

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    if (!in_array($method, $methods, true)) tl_error(405, 'Méthode non autorisée');

    // Le jeton est obligatoire : sans lui, n'importe qui pourrait consommer ta clé API
    // ou lire / écraser tes réglages.
    $expected = (string)($cfg['ACCESS_TOKEN'] ?? '');
    if (strlen($expected) < 12 || str_starts_with($expected, 'un-long-mot-de-passe')) {
        tl_error(500, 'ACCESS_TOKEN absent ou trop court dans tunelab-secret.php (12 caractères minimum).');
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $tok = $_SERVER['HTTP_X_ACCESS_TOKEN'] ?? (str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : '');
    if (!hash_equals($expected, (string)$tok)) {
        usleep(300000); // freine les essais en rafale
        tl_error(401, "Jeton d'accès invalide");
    }
    return $cfg;
}

function tl_body(int $maxBytes): array {
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $maxBytes) tl_error(413, 'Requête trop volumineuse');
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) tl_error(413, 'Requête trop volumineuse');
    $in = json_decode($raw, true);
    if (!is_array($in)) tl_error(400, 'JSON invalide');
    return $in;
}
