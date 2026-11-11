<?php
// Copie ce fichier en /home/<ton-user-cpanel>/tunelab-secret.php (HORS du dossier du site)
return [
    'ANTHROPIC_API_KEY' => 'sk-ant-...',
    // Obligatoire, 12 caractères minimum : c'est le mot de passe de l'assistant IA
    // ET de la sauvegarde en ligne. À saisir dans Réglages sur chaque appareil.
    'ACCESS_TOKEN'      => 'un-long-mot-de-passe-a-saisir-dans-reglages',
    'ALLOWED_ORIGIN'    => 'https://tune.famillegermany.fr', // ton sous-domaine, sans / final
    // Optionnel : dossier des sauvegardes en ligne (par défaut tunelab-data/ à côté de ce fichier)
    // 'DATA_DIR'       => '/home/<ton-user-cpanel>/tunelab-data',
];
