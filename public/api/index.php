<?php
// Proxy IA TuneLab FPV pour hébergement PHP (o2switch / cPanel)
// La clé API est lue dans un fichier HORS du dossier web (voir README, section o2switch).
require __DIR__ . '/lib.php';

$cfg = tl_bootstrap(['POST']);
if (empty($cfg['ANTHROPIC_API_KEY'])) tl_error(500, 'ANTHROPIC_API_KEY absente de tunelab-secret.php.');

$in = tl_body(400 * 1024);
if (empty($in['messages']) || !is_array($in['messages'])) tl_error(400, 'Requête invalide');

$model = (string)($in['model'] ?? 'claude-sonnet-5-5');
if (!preg_match('/^claude-[a-z0-9.-]{1,60}$/', $model)) tl_error(400, 'Modèle invalide');

$payload = [
    'model'      => $model,
    'max_tokens' => max(1, min((int)($in['max_tokens'] ?? 2000), 4000)),
    'system'     => is_string($in['system'] ?? null) ? $in['system'] : '',
    'messages'   => $in['messages'],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 15,
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

if ($res === false) tl_error(502, 'Appel API impossible : ' . $err);
http_response_code($code ?: 502);
echo $res;
