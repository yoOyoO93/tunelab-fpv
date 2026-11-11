import { useEffect, useRef, useState } from 'react';
import { loadState, saveState, loadSettings, saveSettings } from './lib/storage.js';
import { newDrone, uid } from './lib/model.js';
import { useSync, syncLabel } from './lib/sync.js';
import { RATE_TYPES, stats } from './lib/rates.js';
import MachineTab from './components/MachineTab.jsx';
import PidTab from './components/PidTab.jsx';
import RatesTab from './components/RatesTab.jsx';
import SimTab from './components/SimTab.jsx';
import CliTab from './components/CliTab.jsx';
import AiTab from './components/AiTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const TABS = [
  ['pid', 'PID'],
  ['rates', 'Rates'],
  ['sim', 'Simulateurs'],
  ['cli', 'CLI Betaflight'],
  ['ai', 'Assistant IA'],
  ['machine', 'Machine'],
  ['settings', 'Réglages'],
];

export default function App() {
  const [state, setState] = useState(loadState);
  const [settings, setSettings] = useState(loadSettings);
  const [selId, setSelId] = useState(() => state.drones[0]?.id);
  const [tab, setTab] = useState('pid');
  const [menuOpen, setMenuOpen] = useState(false);

  const [saveFailed, setSaveFailed] = useState(false);
  const sync = useSync(state, setState, settings);

  // Écriture locale regroupée : une saisie rapide ne réécrit pas tout le stockage à chaque touche,
  // mais rien n'est perdu si l'onglet est fermé ou mis en arrière-plan entre-temps.
  const latest = useRef(state);
  latest.current = state;
  const saveTimer = useRef(0);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveFailed(!saveState(state)), 400);
  }, [state]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      saveState(latest.current);
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);
  useEffect(() => saveSettings(settings), [settings]);

  const drone = state.drones.find((d) => d.id === selId) || state.drones[0];

  const mutDrone = (fn) =>
    setState((s) => {
      const n = structuredClone(s);
      const d = n.drones.find((x) => x.id === drone.id);
      fn(d);
      return n;
    });

  const addDrone = (d) => {
    setState((s) => ({ ...s, drones: [...s.drones, d] }));
    setSelId(d.id);
  };

  const deleteDrone = () => {
    if (state.drones.length <= 1) return alert('Garde au moins un drone (crées-en un autre avant).');
    if (!confirm(`Supprimer « ${drone.name} » et tous ses profils ?`)) return;
    setState((s) => ({ ...s, drones: s.drones.filter((d) => d.id !== drone.id) }));
    setSelId(state.drones.find((d) => d.id !== drone.id).id);
  };

  const duplicateDrone = () => {
    const c = structuredClone(drone);
    c.id = uid();
    c.name = `${drone.name} (copie)`;
    c.chat = [];
    // nouveaux identifiants partout : la copie ne doit rien partager avec l'original
    for (const [list, active] of [['pidProfiles', 'activePid'], ['rateProfiles', 'activeRate']]) {
      for (const p of c[list]) {
        const id = uid();
        if (c[active] === p.id) c[active] = id;
        p.id = id;
        for (const h of p.history) h.id = uid();
      }
    }
    addDrone(c);
  };

  const remote = sync.status.remote;
  const conflictInfo = [remote?.device && `« ${remote.device} »`, remote?.updatedAt && `le ${new Date(remote.updatedAt).toLocaleString('fr-FR')}`].filter(Boolean).join(', ');

  const rate = drone.rateProfiles.find((p) => p.id === drone.activeRate) || drone.rateProfiles[0];
  const pid = drone.pidProfiles.find((p) => p.id === drone.activePid) || drone.pidProfiles[0];

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="logo">◢◣</span>
          <div>
            <strong>TuneLab FPV</strong>
            <small>Rates · PID · IA</small>
          </div>
        </div>
        <div className="side-title">
          <span>Hangar</span>
          <button className="btn small" onClick={() => { addDrone(newDrone()); setTab('machine'); setMenuOpen(false); }}>+ Drone</button>
        </div>
        <ul className="drone-list">
          {state.drones.map((d) => {
            const r = d.rateProfiles.find((p) => p.id === d.activeRate) || d.rateProfiles[0];
            return (
              <li key={d.id}>
                <button className={d.id === drone.id ? 'on' : ''} onClick={() => { setSelId(d.id); setMenuOpen(false); }}>
                  <strong>{d.name}</strong>
                  <small>{d.category} · BF {d.firmware}</small>
                  <small className="mono">{d.pidProfiles.length} PID · {d.rateProfiles.length} rates · {stats(r.type, r.axes.roll).max}°/s</small>
                </button>
              </li>
            );
          })}
        </ul>
        <button className={`side-foot sync-state ${sync.status.phase}`} onClick={() => { setTab('settings'); setMenuOpen(false); }} title="Ouvrir les réglages de sauvegarde">
          <i className="dot" />
          <span>{syncLabel(sync.status)}{!sync.enabled && ' — pense à exporter ou active la sauvegarde en ligne'}</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>
          <div className="title">
            <h1>{drone.name}</h1>
            <span className="muted small">
              PID « {pid.name} » · Rates « {rate.name} » ({RATE_TYPES[rate.type].short})
            </span>
          </div>
        </header>
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="content">
          {saveFailed && (
            <p className="notice error">Le navigateur refuse d'enregistrer (stockage plein ou navigation privée). Exporte une sauvegarde depuis Réglages avant de fermer l'onglet.</p>
          )}
          {sync.status.phase === 'conflict' && (
            <div className="notice error">
              <span>
                Tes réglages ont été modifiés ici <strong>et</strong> sur un autre appareil
                {conflictInfo ? ` (${conflictInfo})` : ''}. Quelle version garder ?
              </span>
              <button className="btn small" onClick={() => confirm('Remplacer la version du serveur par celle de cet appareil ? (Le serveur en garde une copie.)') && sync.keepLocal()}>Garder cet appareil</button>
              <button className="btn small ghost" onClick={() => confirm('Remplacer les données de cet appareil par celles du serveur ? (Une copie locale de secours est conservée.)') && sync.takeRemote()}>Prendre le serveur</button>
            </div>
          )}
          {tab === 'machine' && <MachineTab drone={drone} mutDrone={mutDrone} onDelete={deleteDrone} onDuplicate={duplicateDrone} />}
          {tab === 'pid' && <PidTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'rates' && <RatesTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'sim' && <SimTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'cli' && <CliTab drone={drone} mutDrone={mutDrone} addDrone={addDrone} />}
          {tab === 'ai' && <AiTab key={drone.id} drone={drone} mutDrone={mutDrone} settings={settings} goSettings={() => setTab('settings')} />}
          {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} state={state} setState={setState} sync={sync} />}
        </div>
      </main>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
