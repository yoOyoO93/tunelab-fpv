<?php
// Sauvegarde en ligne TuneLab FPV.
//   GET  sync.php[?since=N]   -> { rev, updatedAt, device, state }  (state omis si rev == N)
//   POST sync.php             -> { baseRev, force, device, state }  => { rev, updatedAt } ou 409
//   GET  sync.php?backups=1   -> liste des copies conservées
//   GET  sync.php?backup=nom  -> contenu d'une copie
// Les données sont écrites HORS du dossier web, à côté de tunelab-secret.php
// (dossier tunelab-data/, ou la valeur DATA_DIR du fichier de configuration).
require __DIR__ . '/lib.php';

const TL_MAX_BYTES    = 4 * 1024 * 1024; // taille maxi d'une sauvegarde
const TL_KEEP_BACKUPS = 30;              // copies conservées
const TL_BACKUP_EVERY = 3600;            // au plus une copie par heure

$cfg = tl_bootstrap(['GET', 'POST']);

$dir = rtrim((string)($cfg['DATA_DIR'] ?? ($cfg['_dir'] . '/tunelab-data')), '/');
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) tl_error(500, 'Impossible de créer le dossier de données.');
if (!is_dir("$dir/backups")) @mkdir("$dir/backups", 0700, true);
// Ceinture et bretelles au cas où DATA_DIR pointerait dans le dossier web.
if (!is_file("$dir/.htaccess")) @file_put_contents("$dir/.htaccess", "Require all denied\n");

$file = "$dir/state.json";

function tl_read(string $file): array {
    if (!is_file($file)) return ['rev' => 0, 'updatedAt' => null, 'device' => '', 'state' => null];
    $d = json_decode((string)file_get_contents($file), true);
    if (!is_array($d) || !isset($d['rev'])) tl_error(500, 'Fichier de sauvegarde serveur illisible.');
    return $d;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['backups'])) {
        $out = [];
        foreach (glob("$dir/backups/*.json") ?: [] as $f) {
            $out[] = ['name' => basename($f), 'ts' => filemtime($f) * 1000, 'size' => filesize($f)];
        }
        usort($out, fn($a, $b) => $b['ts'] <=> $a['ts']);
        $cur = tl_read($file);
        tl_json(200, ['rev' => (int)$cur['rev'], 'backups' => $out]);
    }
    if (isset($_GET['backup'])) {
        $name = (string)$_GET['backup'];
        if (!preg_match('/^[A-Za-z0-9_-]{1,80}\.json$/', $name) || !is_file("$dir/backups/$name")) tl_error(404, 'Copie introuvable');
        $d = json_decode((string)file_get_contents("$dir/backups/$name"), true);
        if (!is_array($d) || !isset($d['state'])) tl_error(500, 'Copie illisible');
        tl_json(200, ['rev' => (int)$d['rev'], 'updatedAt' => $d['updatedAt'] ?? null, 'device' => $d['device'] ?? '', 'state' => $d['state']]);
    }
    $cur = tl_read($file);
    $out = ['rev' => (int)$cur['rev'], 'updatedAt' => $cur['updatedAt'], 'device' => $cur['device'] ?? ''];
    if (!isset($_GET['since']) || (int)$_GET['since'] !== (int)$cur['rev']) $out['state'] = $cur['state'];
    tl_json(200, $out);
}

// --- POST : enregistrement -----------------------------------------------------
$in = tl_body(TL_MAX_BYTES);
$state = $in['state'] ?? null;
if (!is_array($state) || !isset($state['drones']) || !is_array($state['drones']) || !count($state['drones'])) {
    tl_error(400, 'Sauvegarde invalide (aucun drone).');
}

// Verrou : deux appareils qui enregistrent en même temps passent l'un après l'autre.
$lock = fopen("$dir/.lock", 'c');
if (!$lock || !flock($lock, LOCK_EX)) tl_error(503, 'Serveur occupé, réessaie.');

$cur = tl_read($file);
$baseRev = (int)($in['baseRev'] ?? -1);
if (empty($in['force']) && $baseRev !== (int)$cur['rev']) {
    flock($lock, LOCK_UN);
    tl_error(409, 'Une version plus récente existe sur le serveur.', [
        'remote' => ['rev' => (int)$cur['rev'], 'updatedAt' => $cur['updatedAt'], 'device' => $cur['device'] ?? ''],
    ]);
}

// Copie de la version remplacée : toujours quand on force (résolution de conflit),
// sinon au plus une par heure pour ne pas en créer à chaque frappe.
if ((int)$cur['rev'] > 0) {
    $last = 0;
    foreach (glob("$dir/backups/*.json") ?: [] as $f) $last = max($last, filemtime($f));
    if (!empty($in['force']) || time() - $last >= TL_BACKUP_EVERY) {
        @copy($file, sprintf('%s/backups/%s-rev%d.json', $dir, gmdate('Ymd-His'), (int)$cur['rev']));
        $all = glob("$dir/backups/*.json") ?: [];
        sort($all);
        foreach (array_slice($all, 0, max(0, count($all) - TL_KEEP_BACKUPS)) as $old) @unlink($old);
    }
}

$next = [
    'rev'       => (int)$cur['rev'] + 1,
    'updatedAt' => (int)round(microtime(true) * 1000),
    'device'    => substr((string)preg_replace('/[^A-Za-z0-9 ._-]/', '', (string)($in['device'] ?? '')), 0, 40),
    'state'     => $state,
];
// Écriture atomique : fichier temporaire puis renommage, jamais de fichier à moitié écrit.
$tmp = "$file." . bin2hex(random_bytes(4)) . '.tmp';
$json = json_encode($next, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false || file_put_contents($tmp, $json, LOCK_EX) !== strlen($json) || !rename($tmp, $file)) {
    @unlink($tmp);
    flock($lock, LOCK_UN);
    tl_error(500, "Écriture impossible sur le serveur (espace disque ou droits).");
}
@chmod($file, 0600);
flock($lock, LOCK_UN);
tl_json(200, ['rev' => $next['rev'], 'updatedAt' => $next['updatedAt']]);
