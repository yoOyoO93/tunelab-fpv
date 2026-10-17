import { useRef, useState } from 'react';
import { download } from '../lib/storage.js';
import { DEFAULT_MODEL } from '../lib/ai.js';
import { Card, Field } from './ui.jsx';

export default function SettingsTab({ settings, setSettings, state, setState }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });

  const importBackup = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.drones)) throw new Error('format');
      const mode = confirm('OK = remplacer toutes les données actuelles\nAnnuler = ajouter les drones de la sauvegarde');
      setState((s) => (mode ? data : { ...s, drones: [...s.drones, ...data.drones] }));
      setMsg(`${data.drones.length} drone(s) importé(s).`);
    } catch {
      setMsg('Fichier de sauvegarde invalide.');
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
          <Field label="Clé API Anthropic" hint="Stockée uniquement dans le localStorage de ce navigateur, jamais dans les sauvegardes JSON. Crée-la sur console.anthropic.com.">
            <input type="password" value={settings.apiKey} placeholder="sk-ant-..." onChange={set('apiKey')} autoComplete="off" />
          </Field>
        ) : (
          <>
            <Field label="URL du proxy" hint="Sur o2switch : ./api/ (proxy PHP inclus). Sinon l'URL de ton Worker Cloudflare.">
              <input value={settings.proxyUrl} placeholder="https://…" onChange={set('proxyUrl')} />
            </Field>
            <Field label="Jeton d'accès du proxy (optionnel)">
              <input type="password" value={settings.proxyToken} onChange={set('proxyToken')} autoComplete="off" />
            </Field>
          </>
        )}
        <Field label="Modèle" hint={`Par défaut : ${DEFAULT_MODEL}`}>
          <input value={settings.model} onChange={set('model')} />
        </Field>
      </Card>

      <Card title="Sauvegardes">
        <p className="small">Les données sont enregistrées automatiquement dans ce navigateur. Exporte régulièrement un fichier pour les garder en sécurité ou les passer sur un autre appareil.</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => download(`tunelab-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2))}>
            Exporter tout (.json)
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Importer une sauvegarde</button>
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
