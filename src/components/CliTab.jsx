import { useState } from 'react';
import { exportCli, droneFromCli } from '../lib/cli.js';
import { download, slug } from '../lib/storage.js';
import { Card, copy } from './ui.jsx';

export default function CliTab({ drone, mutDrone, addDrone }) {
  const [scope, setScope] = useState('active');
  const [includeGlobal, setIncludeGlobal] = useState(false);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const out = exportCli(drone, { scope, includeGlobal });

  const preview = () => {
    try {
      return droneFromCli(input);
    } catch (e) {
      return null;
    }
  };

  const doImport = (mode) => {
    const res = preview();
    if (!res) return setMsg('Impossible de lire ce texte.');
    const { drone: d, parsed } = res;
    const nP = Object.keys(parsed.pid).length;
    const nR = Object.keys(parsed.rate).length;
    if (!nP && !nR) return setMsg('Aucun bloc « profile » / « rateprofile » trouvé. Utilise `diff all` dans le CLI.');
    if (mode === 'new') {
      addDrone(d);
      setMsg(`Drone « ${d.name} » créé : ${d.pidProfiles.length} profil(s) PID, ${d.rateProfiles.length} rate profile(s), firmware ${d.firmware}.`);
    } else {
      if (!confirm('Remplacer tous les profils PID et rates de ce drone ? (Une version de chaque profil actuel sera conservée dans son historique si le nom correspond.)')) return;
      mutDrone((cur) => {
        cur.pidProfiles = d.pidProfiles.map((np, i) => ({ ...np, history: cur.pidProfiles[i]?.history || [] }));
        cur.rateProfiles = d.rateProfiles.map((nr, i) => ({ ...nr, history: cur.rateProfiles[i]?.history || [] }));
        cur.activePid = cur.pidProfiles[0].id;
        cur.activeRate = cur.rateProfiles[0].id;
        cur.global = { ...cur.global, ...d.global };
        if (parsed.version) cur.firmware = d.firmware;
      });
      setMsg('Profils remplacés.');
    }
    setInput('');
  };

  return (
    <div className="grid-2">
      <Card
        title="Export CLI Betaflight"
        actions={
          <>
            <button className="btn small" onClick={() => copy(out)}>Copier</button>
            <button className="btn small ghost" onClick={() => download(`${slug(drone.name)}-cli.txt`, out, 'text/plain')}>.txt</button>
          </>
        }
      >
        <div className="row gap wrap">
          <label className="check"><input type="radio" checked={scope === 'active'} onChange={() => setScope('active')} /> Profils actifs</label>
          <label className="check"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Tous les profils</label>
          <label className="check"><input type="checkbox" checked={includeGlobal} onChange={(e) => setIncludeGlobal(e.target.checked)} /> Inclure les filtres globaux importés ({Object.keys(drone.global || {}).length})</label>
        </div>
        <textarea className="mono code" rows={22} readOnly value={out} />
        <p className="muted small">Configurator → onglet CLI → colle → Entrée. La commande <code>save</code> redémarre le FC. Vérifie toujours dans l'onglet PID avant de voler.</p>
      </Card>

      <Card title="Importer depuis Betaflight">
        <p className="small">Dans le CLI, tape <code>diff all</code>, copie toute la sortie et colle-la ici.</p>
        <textarea className="mono code" rows={16} placeholder="# diff all&#10;# version&#10;# Betaflight / STM32H743 ..." value={input} onChange={(e) => setInput(e.target.value)} />
        <div className="row gap wrap">
          <button className="btn" disabled={!input.trim()} onClick={() => doImport('new')}>Créer un nouveau drone</button>
          <button className="btn ghost" disabled={!input.trim()} onClick={() => doImport('replace')}>Remplacer les profils de « {drone.name} »</button>
        </div>
        {msg && <p className="notice">{msg}</p>}
        <p className="muted small">Les clés de profil non reconnues sont conservées dans « Paramètres avancés » et réexportées telles quelles. Les filtres gyro / RPM sont gardés à part.</p>
      </Card>
    </div>
  );
}
