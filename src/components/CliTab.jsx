import { useState } from 'react';
import { exportCli, droneFromCli } from '../lib/cli.js';
import { download, slug } from '../lib/storage.js';
import { snapshot } from '../lib/model.js';
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
      if (!confirm('Remplacer tous les profils PID et rates de ce drone ? (Chaque profil actuel est d\'abord sauvegardé dans l\'historique du slot correspondant.)')) return;
      mutDrone((cur) => {
        const keep = (old) => (old ? [...old.history, snapshot(old, `Avant import CLI (${old.name})`)] : []);
        const aP = d.pidProfiles.findIndex((x) => x.id === d.activePid);
        const aR = d.rateProfiles.findIndex((x) => x.id === d.activeRate);
        // les profils au-delà de ce que contient le diff sont conservés tels quels
        cur.pidProfiles = [...d.pidProfiles.map((np, i) => ({ ...np, history: keep(cur.pidProfiles[i]) })), ...cur.pidProfiles.slice(d.pidProfiles.length)];
        cur.rateProfiles = [...d.rateProfiles.map((nr, i) => ({ ...nr, history: keep(cur.rateProfiles[i]) })), ...cur.rateProfiles.slice(d.rateProfiles.length)];
        cur.activePid = cur.pidProfiles[Math.max(0, aP)].id;
        cur.activeRate = cur.rateProfiles[Math.max(0, aR)].id;
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
