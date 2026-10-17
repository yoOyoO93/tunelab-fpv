import { useEffect, useState } from 'react';
import { loadState, saveState, loadSettings, saveSettings } from './lib/storage.js';
import { newDrone, uid } from './lib/model.js';
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

  useEffect(() => saveState(state), [state]);
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
    addDrone(c);
  };

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
        <p className="side-foot muted small">Sauvegarde automatique locale. Pense à exporter (Réglages).</p>
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
          {tab === 'machine' && <MachineTab drone={drone} mutDrone={mutDrone} onDelete={deleteDrone} onDuplicate={duplicateDrone} />}
          {tab === 'pid' && <PidTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'rates' && <RatesTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'sim' && <SimTab key={drone.id} drone={drone} mutDrone={mutDrone} />}
          {tab === 'cli' && <CliTab drone={drone} mutDrone={mutDrone} addDrone={addDrone} />}
          {tab === 'ai' && <AiTab key={drone.id} drone={drone} mutDrone={mutDrone} settings={settings} goSettings={() => setTab('settings')} />}
          {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} state={state} setState={setState} />}
        </div>
      </main>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
