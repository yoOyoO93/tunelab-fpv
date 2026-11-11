import { useRef, useState } from 'react';
import { download, loadRescueCopy } from '../lib/storage.js';
import { normalizeState } from '../lib/model.js';
import { DEFAULT_MODEL } from '../lib/ai.js';
import { listServerBackups, fetchServerBackup, syncLabel } from '../lib/sync.js';
import { Card, Field } from './ui.jsx';

const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} ko`);

export default function SettingsTab({ settings, setSettings, state, setState, sync }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [backups, setBackups] = useState(null);
  const [srvMsg, setSrvMsg] = useState('');
  const set = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });
  const usesServer = settings.apiMode === 'proxy' || settings.syncEnabled;

  const importBackup = async (file) => {
    try {
      const data = normalizeState(JSON.parse(await file.text()));
      if (!data) throw new Error('format');
      const replace = confirm('OK = remplacer toutes les données actuelles\nAnnuler = ajouter les drones de la sauvegarde');
      // À l'ajout, normalizeState redonne un identifiant aux drones et profils déjà présents ici.
      setState((s) => (replace ? data : normalizeState({ drones: [...s.drones, ...data.drones] })));
      setMsg(`${data.drones.length} drone(s) importé(s).`);
    } catch {
      setMsg('Fichier de sauvegarde invalide.');
    }
    if (fileRef.current) fileRef.current.value = ''; // permet de réimporter le même fichier
  };

  const restoreRescue = () => {
    const r = loadRescueCopy();
    if (!r) return setMsg('Aucune copie de secours dans ce navigateur.');
    if (!confirm(`Restaurer la copie de secours locale (${r.drones.length} drone(s)) à la place des données actuelles ?`)) return;
    setState(r);
    setMsg('Copie de secours restaurée.');
  };

  const loadBackups = async () => {
    setSrvMsg('');
    try {
      setBackups(await listServerBackups(settings));
    } catch (e) {
      setSrvMsg(e.message);
    }
  };

  const restoreServer = async (b) => {
    if (!confirm(`Restaurer la copie serveur du ${new Date(b.ts).toLocaleString('fr-FR')} ? Elle remplacera les données actuelles sur tous tes appareils.`)) return;
    try {
      const s = await fetchServerBackup(settings, b.name);
      if (!s) throw new Error('Copie illisible');
      setState(s);
      setSrvMsg('Copie restaurée, envoi vers le serveur en cours.');
    } catch (e) {
      setSrvMsg(e.message);
    }
  };

  return (
    <div className="grid-2">
      <Card title="Assistant IA">
        <div className="row gap wrap">
          <label className="check"><input type="radio" checked={settings.apiMode === 'direct'} onChange={() => setSettings({ ...settings, apiMode: 'direct' })} /> Clé API perso (dans ce navigateur)</label>
          <label className="check"><input type="radio" checked={settings.apiMode === 'proxy'} onChange={() => setSettings({ ...settings, apiMode: 'proxy' })} /> Proxy serveur (recommandé si en ligne)</label>
        </div>
        {settings.apiMode === 'direct' ? (
          <Field label="Clé API Anthropic" hint="Stockée uniquement dans le localStorage de ce navigateur, jamais dans les sauvegardes ni sur le serveur. Crée-la sur console.anthropic.com.">
            <input type="password" value={settings.apiKey} placeholder="sk-ant-..." onChange={set('apiKey')} autoComplete="off" />
          </Field>
        ) : (
          <Field label="URL du proxy" hint="Sur o2switch : ./api/ (proxy PHP inclus). Sinon l'URL de ton Worker Cloudflare.">
            <input value={settings.proxyUrl} placeholder="https://…" onChange={set('proxyUrl')} />
          </Field>
        )}
        <Field label="Modèle" hint={`Par défaut : ${DEFAULT_MODEL}`}>
          <input value={settings.model} onChange={set('model')} />
        </Field>
      </Card>

      <Card title="Sauvegarde en ligne">
        <p className="small">Tes drones, profils et historiques sont enregistrés sur ton hébergement et suivent sur tous tes appareils. Ce navigateur garde toujours sa copie : l'app reste utilisable hors ligne, sur le terrain.</p>
        <label className="check">
          <input type="checkbox" checked={!!settings.syncEnabled} onChange={(e) => setSettings({ ...settings, syncEnabled: e.target.checked })} /> Activer la synchronisation
        </label>
        {settings.syncEnabled && (
          <>
            <Field label="URL de synchronisation" hint="Sur o2switch : ./api/sync.php (inclus dans le build).">
              <input value={settings.syncUrl} onChange={set('syncUrl')} />
            </Field>
            <Field label="Nom de cet appareil (optionnel)" hint="Affiché en cas de conflit, pour savoir d'où vient l'autre version.">
              <input value={settings.deviceName} maxLength={40} placeholder="ex : iPhone, PC atelier" onChange={set('deviceName')} />
            </Field>
          </>
        )}
        {usesServer && (
          <Field label="Jeton d'accès serveur" hint="La valeur ACCESS_TOKEN de tunelab-secret.php. Sert à l'assistant IA (mode proxy) et à la synchronisation.">
            <input type="password" value={settings.proxyToken} onChange={set('proxyToken')} autoComplete="off" />
          </Field>
        )}
        {settings.syncEnabled && (
          <>
            <p className={`notice ${sync.status.phase === 'error' || sync.status.phase === 'conflict' ? 'error' : ''}`}>
              <span>{settings.proxyToken ? syncLabel(sync.status) : "Saisis le jeton d'accès pour démarrer."}</span>
              <button className="btn small ghost" disabled={!sync.enabled || sync.status.phase === 'syncing'} onClick={sync.syncNow}>Synchroniser maintenant</button>
            </p>
            <div className="row gap wrap">
              <button className="btn small ghost" disabled={!sync.enabled} onClick={loadBackups}>Copies conservées sur le serveur</button>
            </div>
            {srvMsg && <p className="notice">{srvMsg}</p>}
            {backups && (backups.length === 0 ? (
              <p className="muted small">Pas encore de copie : le serveur en crée une par heure au plus, quand une version est remplacée.</p>
            ) : (
              <ul className="hist-list">
                {backups.map((b) => (
                  <li key={b.name}>
                    <div>
                      <strong>{new Date(b.ts).toLocaleString('fr-FR')}</strong>
                      <span className="muted small"> — {fmtSize(b.size)}</span>
                    </div>
                    <button className="btn small ghost" onClick={() => restoreServer(b)}>Restaurer</button>
                  </li>
                ))}
              </ul>
            ))}
          </>
        )}
      </Card>

      <Card title="Fichiers de sauvegarde">
        <p className="small">Indépendant de la synchronisation : un fichier .json complet à garder où tu veux, ou à passer d'un appareil à l'autre.</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => download(`tunelab-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2))}>
            Exporter tout (.json)
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Importer une sauvegarde</button>
          <button className="btn ghost small" onClick={restoreRescue} title="Copie faite automatiquement avant qu'une version du serveur ne remplace tes données locales">Copie de secours locale</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files[0] && importBackup(e.target.files[0])} />
        </div>
        {msg && <p className="notice">{msg}</p>}
        <p className="muted small">
          {state.drones.length} drone(s) ·{' '}
          {state.drones.reduce((n, d) => n + d.pidProfiles.length + d.rateProfiles.length, 0)} profils ·{' '}
          {state.drones.reduce((n, d) => n + d.pidProfiles.concat(d.rateProfiles).reduce((m, p) => m + p.history.length, 0), 0)} versions sauvegardées
        </p>
      </Card>
    </div>
  );
}
