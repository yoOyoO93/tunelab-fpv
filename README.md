# TuneLab FPV

Gestionnaire de rates et de PID pour drones FPV, avec historique des versions, export/import CLI Betaflight, transposition vers les simulateurs et assistant de réglage IA.

## Fonctionnalités

- **Hangar multi-drones** : fiche machine (châssis, moteurs, KV, batterie, hélices, poids, FC, ESC, firmware).
- **4 profils PID par drone** (comme Betaflight 4.3+) : P, I, D max, D min, Feedforward par axe, ajustement rapide en %, paramètres CLI avancés (filtres D-term, TPA, anti-gravity, sliders simplifiés…).
- **6 rate profiles par drone** : Betaflight, Actual, Quick, KISS, RaceFlight — courbes en direct, comparaison entre profils, conversion automatique entre systèmes en conservant la sensation, gaz (mid/expo/limite).
- **Historique** : sauvegarde de versions nommées par profil, restauration en un clic (l'état courant est sauvegardé avant).
- **CLI Betaflight** : export prêt à coller (profil actif ou tous), import d'un `diff all` (crée un drone ou remplace les profils). Gère le format D min (4.3–4.5) et D max (2025.12+).
- **Simulateurs** : Liftoff, VelociDrone, TRYP FPV, Uncrashed, DRL, FPV SkyDive — valeurs à saisir dans le simu avec l'écart de courbe, et import de rates d'un simu vers un drone.
- **Assistant IA** (Claude) : diagnostic de symptômes, propositions chiffrées affichées en diff, application en un clic avec sauvegarde automatique de la version précédente.
- **Sauvegarde** : automatique dans le navigateur + export/import JSON complet.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vérifie les formules de rates et l'aller-retour CLI
npm run build      # génère dist/
```

---

## Déploiement

L'app est 100 % statique (dossier `dist/`). Trois options, de la plus simple à la plus « pro ».

### Option A — GitHub Pages (automatique, recommandé)

1. Crée un dépôt GitHub (ex : `tunelab-fpv`) et pousse le projet :
   ```bash
   git init && git add . && git commit -m "TuneLab FPV"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/tunelab-fpv.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` teste, build et publie à chaque push sur `main`.
4. L'app est en ligne sur `https://<ton-pseudo>.github.io/tunelab-fpv/`.

Domaine perso (ex : `tune.famillegermany.fr`) : dans **Settings → Pages → Custom domain**, saisis le sous-domaine, puis chez ton registrar crée un enregistrement `CNAME tune → <ton-pseudo>.github.io`. Coche **Enforce HTTPS** une fois le certificat émis.

### Option o2switch (app + proxy IA sur le même hébergement)

Le build contient déjà `api/index.php` (proxy IA en PHP) et un `.htaccess` (HTTPS forcé + cache).

1. **Sous-domaine** : cPanel → *Domaines* → crée `tune.famillegermany.fr`. Racine : `/home/<user>/tune.famillegermany.fr`.
2. **SSL** : cPanel → *Let's Encrypt SSL* (ou AutoSSL) → génère le certificat pour le sous-domaine.
3. **PHP** : cPanel → *Sélecteur de version PHP* → PHP 8.1 ou plus pour ce sous-domaine (extension `curl` active, c'est le cas par défaut).
4. **Clé API hors du web** : via le *Gestionnaire de fichiers*, crée `/home/<user>/tunelab-secret.php` (au même niveau que le dossier du sous-domaine, **pas dedans**) à partir de `proxy/o2switch/tunelab-secret.example.php` :
   ```php
   <?php
   return [
       'ANTHROPIC_API_KEY' => 'sk-ant-...',
       'ACCESS_TOKEN'      => 'un-long-mot-de-passe',
       'ALLOWED_ORIGIN'    => 'https://tune.famillegermany.fr',
   ];
   ```
5. **Mise en ligne** : `npm run build`, puis envoie le **contenu** de `dist/` (y compris les fichiers cachés `.htaccess`) dans `/home/<user>/tune.famillegermany.fr/`.
6. **Dans l'app** : Réglages → *Proxy serveur* → URL `./api/` (déjà pré-remplie) + le jeton `ACCESS_TOKEN`.

**Déploiement automatique depuis GitHub** : `.github/workflows/deploy-o2switch.yml` build et envoie `dist/` en FTPS. Crée un compte FTP limité au dossier du sous-domaine (cPanel → *Comptes FTP*), puis ajoute dans GitHub → *Settings → Secrets and variables → Actions* : `O2SWITCH_FTP_HOST` (le nom de ton serveur o2switch ou ton domaine), `O2SWITCH_FTP_USER`, `O2SWITCH_FTP_PASSWORD`. Lance-le depuis l'onglet *Actions*. Si le FTP refuse la connexion depuis GitHub, vérifie les restrictions d'accès dans cPanel ou repasse par l'envoi manuel.

### Option B — Autre hébergement web (cPanel / FTP)

1. `npm run build`
2. Crée un sous-domaine (ex : `tune.famillegermany.fr`) dans ton panel d'hébergement.
3. Envoie **le contenu** du dossier `dist/` (pas le dossier lui-même) à la racine du sous-domaine via FTP ou le gestionnaire de fichiers.
4. Active le certificat SSL (Let's Encrypt / AutoSSL) — obligatoire pour l'appel à l'API IA.

`base: './'` dans `vite.config.js` permet aussi de le poser dans un sous-dossier (ex : `famillegermany.fr/tunelab/`).

### Option C — Netlify / Vercel

- **Netlify** : glisse-dépose le dossier `dist/` sur app.netlify.com/drop, ou connecte le dépôt (build : `npm run build`, dossier : `dist`).
- **Vercel** : importe le dépôt, preset « Vite », c'est tout.

---

## Configurer l'assistant IA

Onglet **Réglages → Assistant IA**. Deux modes :

### Mode 1 — Clé API perso (usage personnel)

1. Crée une clé sur **console.anthropic.com** (API Keys) et ajoute un peu de crédit.
2. Colle-la dans Réglages. Elle reste uniquement dans le `localStorage` de ton navigateur et n'est jamais incluse dans les exports JSON.

Simple et suffisant si toi seul utilises l'app. À éviter sur un ordinateur partagé.

### Mode 2 — Proxy Cloudflare Worker (si tu partages l'app)

La clé reste sur le serveur, les utilisateurs n'ont besoin que d'un jeton d'accès.

```bash
npm install -g wrangler
cd proxy
wrangler login
wrangler secret put ANTHROPIC_API_KEY     # ta clé sk-ant-...
wrangler secret put ACCESS_TOKEN          # un mot de passe long de ton choix
wrangler secret put ALLOWED_ORIGIN        # ex : https://tune.famillegermany.fr (sans / final)
wrangler deploy
```

Wrangler affiche l'URL du Worker (`https://tunelab-proxy.<compte>.workers.dev`). Dans l'app : **Réglages → Proxy serveur**, colle l'URL et le jeton.

Le plan gratuit de Cloudflare Workers suffit largement pour cet usage.

### Modèle

Par défaut `claude-sonnet-5-5`, modifiable dans Réglages (ex : `claude-haiku-5-5` pour moins cher, `claude-opus-5-5` pour les analyses poussées).

---

## Notes techniques

- Les valeurs sont stockées en **unités CLI brutes** (exactement ce que contient `diff all`), ce qui garantit un aller-retour CLI sans perte.
- Formules de rates reprises de `src/main/fc/rc.c` de Betaflight ; conversions par ajustement numérique de courbe (l'« écart » affiché est la différence moyenne en °/s).
- La liste des systèmes de rates supportés par chaque simulateur est dans `src/lib/model.js` (`SIMULATORS`) : à ajuster si un simu évolue.
- Le schéma D min / D max dépend du firmware choisi dans l'onglet Machine. Après un import ou un export, vérifie toujours l'onglet PID du Configurator avant de voler.
- Toujours tester un changement de réglage hélices retirées d'abord (armement, réaction moteurs), puis par un vol court en contrôlant la température des moteurs.

## Structure

```
src/
  lib/rates.js       formules, courbes, conversion entre systèmes
  lib/cli.js         export / import CLI Betaflight
  lib/model.js       modèle de données, simulateurs, valeurs par défaut
  lib/ai.js          appel API + prompt de l'assistant
  lib/storage.js     localStorage, sauvegardes
  components/        onglets de l'interface
proxy/               Cloudflare Worker (optionnel)
tests/check.mjs      tests des formules et du CLI
```
