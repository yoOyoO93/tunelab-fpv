// Sauvegarde en ligne : l'état complet est stocké sur ton hébergement (api/sync.php),
// avec un numéro de révision. Chaque appareil retient la révision qu'il a vue :
//  - modifié ici, révision inchangée sur le serveur  -> on envoie ;
//  - rien modifié ici, révision plus récente serveur -> on récupère ;
//  - modifié des deux côtés                          -> conflit, c'est toi qui choisis.
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeState } from './model.js';
import { KEY, keepRescueCopy } from './storage.js';

const KEY_META = 'tunelab-fpv-sync';
const PUSH_DELAY = 2500;

function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY_META));
    if (m && typeof m.rev === 'number') return { rev: m.rev, dirty: !!m.dirty, lastSync: m.lastSync || 0 };
  } catch {}
  // Jamais synchronisé : s'il y a déjà des données dans ce navigateur, elles sont à envoyer.
  let has = false;
  try {
    has = !!localStorage.getItem(KEY);
  } catch {}
  const m = { rev: 0, dirty: has, lastSync: 0 };
  saveMeta(m); // figé dès le premier lancement : un état de départ jamais touché n'est pas « à envoyer »
  return m;
}

function saveMeta(m) {
  try {
    localStorage.setItem(KEY_META, JSON.stringify(m));
  } catch {}
}

export class SyncError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call(settings, { method = 'GET', query = '', body } = {}) {
  const headers = { accept: 'application/json' };
  if (settings.proxyToken) {
    headers.authorization = `Bearer ${settings.proxyToken}`;
    headers['x-access-token'] = settings.proxyToken;
  }
  if (body) headers['content-type'] = 'application/json';
  let r;
  try {
    r = await fetch(settings.syncUrl + query, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch {
    throw new SyncError('Serveur injoignable (hors ligne ?)', 0);
  }
  let j = null;
  try {
    j = await r.json();
  } catch {}
  if (!r.ok) {
    const msg = j?.error?.message || (r.status === 404 ? 'api/sync.php introuvable sur le serveur' : `Erreur ${r.status}`);
    throw new SyncError(msg, r.status, j);
  }
  if (!j || typeof j.rev !== 'number') throw new SyncError("Réponse inattendue : l'URL ne pointe pas vers sync.php", r.status);
  return j;
}

export const listServerBackups = (settings) => call(settings, { query: '?backups=1' }).then((j) => j.backups || []);
export const fetchServerBackup = (settings, name) => call(settings, { query: `?backup=${encodeURIComponent(name)}` }).then((j) => normalizeState(j.state));

// phase : off | idle | syncing | ok | error | conflict
export function useSync(state, setState, settings) {
  const enabled = !!(settings.syncEnabled && settings.syncUrl && settings.proxyToken);
  const [status, setStatus] = useState(() => ({ phase: enabled ? 'idle' : 'off', ...loadMeta() }));
  const meta = useRef(null);
  if (!meta.current) meta.current = loadMeta();
  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const clean = useRef(state); // dernier état connu comme identique au serveur (ou état de départ)
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef(0);
  const conflict = useRef(false);

  const publish = (phase, extra = {}) => setStatus({ phase, ...meta.current, ...extra });
  const setMeta = (patch) => {
    meta.current = { ...meta.current, ...patch };
    saveMeta(meta.current);
  };

  const adopt = (remoteState, rev) => {
    const next = normalizeState(remoteState);
    if (!next) throw new SyncError('Données serveur illisibles', 0);
    keepRescueCopy(stateRef.current);
    clean.current = next;
    setMeta({ rev, dirty: false, lastSync: Date.now() });
    setState(next);
  };

  const run = useCallback(async (opts = {}) => {
    if (!enabledRef.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    if (conflict.current && !opts.resolve) return;
    busy.current = true;
    publish('syncing');
    const s = settingsRef.current;
    try {
      if (opts.resolve === 'remote') {
        const r = await call(s);
        if (r.state) adopt(r.state, r.rev);
        conflict.current = false;
      } else if (meta.current.dirty || opts.resolve === 'local') {
        const sent = stateRef.current;
        try {
          const r = await call(s, {
            method: 'POST',
            body: { baseRev: meta.current.rev, force: opts.resolve === 'local', device: s.deviceName || '', state: sent },
          });
          conflict.current = false;
          // Si l'utilisateur a continué à modifier pendant l'envoi, il reste des changements à pousser.
          const still = stateRef.current !== sent;
          if (!still) clean.current = sent;
          setMeta({ rev: r.rev, dirty: still, lastSync: Date.now() });
          if (still) again.current = true;
        } catch (e) {
          if (e.status !== 409) throw e;
          conflict.current = true;
          publish('conflict', { remote: e.body?.remote || null });
          return;
        }
      } else {
        const r = await call(s, { query: `?since=${meta.current.rev}` });
        if (r.rev !== meta.current.rev) {
          if (r.state) {
            // Modifié localement pendant la requête : on ne remplace pas, c'est un conflit.
            if (meta.current.dirty) {
              conflict.current = true;
              publish('conflict', { remote: { rev: r.rev, updatedAt: r.updatedAt, device: r.device } });
              return;
            }
            adopt(r.state, r.rev);
          } else {
            // Le serveur n'a (plus) rien : on y dépose la version locale.
            setMeta({ rev: r.rev, dirty: true });
            again.current = true;
          }
        } else {
          setMeta({ lastSync: Date.now() });
        }
      }
      publish('ok');
    } catch (e) {
      publish('error', { message: e.message || 'Erreur de synchronisation' });
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => run(), 300);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toute modification locale marque l'état « à envoyer », même synchro coupée.
  useEffect(() => {
    if (state === clean.current) return;
    if (!meta.current.dirty) setMeta({ dirty: true });
    if (!enabledRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => run(), PUSH_DELAY);
  }, [state, run]);

  // À l'activation, au retour sur l'onglet et au retour du réseau : on se met à jour.
  useEffect(() => {
    if (!enabled) {
      conflict.current = false;
      clearTimeout(timer.current);
      setStatus({ phase: 'off', ...meta.current });
      return;
    }
    run();
    const onVis = () => {
      clearTimeout(timer.current);
      run();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
      clearTimeout(timer.current);
    };
  }, [enabled, settings.syncUrl, settings.proxyToken, run]);

  return {
    status,
    enabled,
    syncNow: () => run(),
    keepLocal: () => run({ resolve: 'local' }),
    takeRemote: () => run({ resolve: 'remote' }),
  };
}

export function syncLabel(status) {
  const t = status.lastSync ? new Date(status.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
  switch (status.phase) {
    case 'off':
      return 'Sauvegarde locale uniquement';
    case 'syncing':
      return 'Synchronisation…';
    case 'conflict':
      return 'Conflit : deux versions différentes';
    case 'error':
      return `Non synchronisé — ${status.message}`;
    default:
      return status.dirty ? 'Modifications en attente d’envoi' : t ? `Synchronisé à ${t}` : 'Synchronisé';
  }
}
