import { useState } from 'react';
import { AXES, AXIS_LABEL } from '../lib/rates.js';
import { MAX_PID_PROFILES, newPidProfile, PID_EXTRA_KEYS, snapshot, dSchemeOf } from '../lib/model.js';
import ProfileBar from './ProfileBar.jsx';
import { Card, Num, ExtraEditor, History } from './ui.jsx';

const TERMS = [
  { k: 'p', label: 'P' },
  { k: 'i', label: 'I' },
  { k: 'dmax', label: 'D max' },
  { k: 'dmin', label: 'D min' },
  { k: 'f', label: 'FF' },
];

export default function PidTab({ drone, mutDrone }) {
  const prof = drone.pidProfiles.find((p) => p.id === drone.activePid) || drone.pidProfiles[0];
  const mutProf = (fn) => mutDrone((d) => fn(d.pidProfiles.find((p) => p.id === prof.id)));
  const [pct, setPct] = useState(5);
  const [term, setTerm] = useState('dmax');
  const scheme = dSchemeOf(drone.firmware);

  const scale = (sign) =>
    mutProf((p) => {
      for (const a of ['roll', 'pitch']) {
        const keys = term === 'all' ? ['p', 'i', 'dmax', 'dmin', 'f'] : term === 'pd' ? ['p', 'dmax', 'dmin'] : [term];
        for (const k of keys) p.pids[a][k] = Math.max(0, Math.round(p.pids[a][k] * (1 + (sign * pct) / 100)));
      }
    });

  return (
    <div className="stack">
      <ProfileBar drone={drone} kind="pid" max={MAX_PID_PROFILES} factory={newPidProfile} mutDrone={mutDrone} />

      <Card title="Gains PID">
        <div className="table-wrap">
          <table className="pid-table">
            <thead>
              <tr>
                <th />
                {TERMS.map((t) => <th key={t.k}>{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {AXES.map((a) => (
                <tr key={a}>
                  <th className={`axis ${a}`}>{AXIS_LABEL[a]}</th>
                  {TERMS.map((t) => (
                    <td key={t.k}>
                      <Num value={prof.pids[a][t.k]} min={0} max={250} onChange={(v) => mutProf((p) => (p.pids[a][t.k] = Math.round(v)))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Export pour {drone.firmware} :{' '}
          {scheme === 'dmax' ? <code>d_axe = D min, d_max_axe = D max</code> : <code>d_axe = D max, d_min_axe = D min</code>}. Mets D min = D max (ou 0 en 4.x) pour un D fixe.
        </p>
        <div className="row gap wrap quick-scale">
          <span className="muted small">Ajustement rapide roll + pitch :</span>
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="p">P</option>
            <option value="i">I</option>
            <option value="dmax">D max</option>
            <option value="dmin">D min</option>
            <option value="f">FF</option>
            <option value="pd">P + D</option>
            <option value="all">Tout (master)</option>
          </select>
          <Num value={pct} min={1} max={50} onChange={setPct} width={60} />
          <span className="muted small">%</span>
          <button className="btn small ghost" onClick={() => scale(-1)}>− {pct} %</button>
          <button className="btn small ghost" onClick={() => scale(1)}>+ {pct} %</button>
        </div>
      </Card>

      <Card title="Paramètres avancés du profil (CLI)">
        <ExtraEditor extra={prof.extra} onChange={(e) => mutProf((p) => (p.extra = e))} suggestions={PID_EXTRA_KEYS} listId="pid-keys" />
      </Card>

      <Card title="Notes de réglage">
        <textarea rows={3} placeholder="Ressenti en vol, conditions, hélices utilisées, retour Blackbox…" value={prof.notes} onChange={(e) => mutProf((p) => (p.notes = e.target.value))} />
      </Card>

      <Card title="Historique des versions">
        <History
          profile={prof}
          onSnapshot={(label) => mutProf((p) => p.history.push(snapshot(p, label)))}
          onRestore={(h) => {
            if (!confirm(`Restaurer « ${h.label} » ? L'état actuel sera d'abord sauvegardé.`)) return;
            mutProf((p) => {
              p.history.push(snapshot(p, 'Avant restauration'));
              Object.assign(p, structuredClone(h.data), { id: p.id, history: p.history });
            });
          }}
          onDelete={(h) => mutProf((p) => (p.history = p.history.filter((x) => x.id !== h.id)))}
          describe={(d) => AXES.map((a) => `${a[0].toUpperCase()} ${d.pids[a].p}/${d.pids[a].i}/${d.pids[a].dmax}/${d.pids[a].f}`).join('  ')}
        />
      </Card>
    </div>
  );
}
