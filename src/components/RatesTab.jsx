import { useState } from 'react';
import { AXES, AXIS_LABEL, RATE_TYPES, toDisplay, fromDisplay, stats, convertProfileAxes } from '../lib/rates.js';
import { MAX_RATE_PROFILES, newRateProfile, RATE_EXTRA_KEYS, snapshot } from '../lib/model.js';
import ProfileBar from './ProfileBar.jsx';
import RateGraph from './RateGraph.jsx';
import { Card, Num, Field, ExtraEditor, History } from './ui.jsx';

export default function RatesTab({ drone, mutDrone }) {
  const prof = drone.rateProfiles.find((p) => p.id === drone.activeRate) || drone.rateProfiles[0];
  const mutProf = (fn) => mutDrone((d) => fn(d.rateProfiles.find((p) => p.id === prof.id)));
  const [link, setLink] = useState(true);
  const [keepFeel, setKeepFeel] = useState(true);
  const [compareId, setCompareId] = useState('');
  const def = RATE_TYPES[prof.type];
  const cmp = drone.rateProfiles.find((p) => p.id === compareId && p.id !== prof.id);

  const setField = (axis, k, display) =>
    mutProf((p) => {
      const raw = fromDisplay(p.type, k, display);
      p.axes[axis][k] = raw;
      if (link && axis !== 'yaw') p.axes[axis === 'roll' ? 'pitch' : 'roll'][k] = raw;
    });

  const changeType = (t) =>
    mutProf((p) => {
      if (keepFeel) p.axes = convertProfileAxes(p.type, p.axes, t);
      p.type = t;
    });

  const series = AXES.map((a) => ({ key: a, axis: a, label: AXIS_LABEL[a], type: prof.type, params: prof.axes[a] }));
  if (cmp) {
    for (const a of ['roll', 'yaw'])
      series.push({ key: 'c' + a, axis: a, dashed: true, label: `${cmp.name} ${AXIS_LABEL[a]}`, type: cmp.type, params: cmp.axes[a] });
  }

  return (
    <div className="stack">
      <ProfileBar drone={drone} kind="rate" max={MAX_RATE_PROFILES} factory={newRateProfile} mutDrone={mutDrone} />

      <div className="grid-2">
        <Card title="Rates">
          <div className="row gap wrap">
            <Field label="Système (rates_type)">
              <select value={prof.type} onChange={(e) => changeType(e.target.value)}>
                {Object.entries(RATE_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" checked={keepFeel} onChange={(e) => setKeepFeel(e.target.checked)} /> Conserver la sensation en changeant de système
            </label>
            <label className="check">
              <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> Lier roll et pitch
            </label>
          </div>
          <div className="table-wrap">
            <table className="pid-table">
              <thead>
                <tr>
                  <th />
                  {def.fields.map((f) => <th key={f.k}>{f.label}{f.unit ? ` (${f.unit})` : ''}</th>)}
                  <th>Max</th>
                  <th>Centre</th>
                </tr>
              </thead>
              <tbody>
                {AXES.map((a) => {
                  const st = stats(prof.type, prof.axes[a]);
                  return (
                    <tr key={a}>
                      <th className={`axis ${a}`}>{AXIS_LABEL[a]}</th>
                      {def.fields.map((f) => (
                        <td key={f.k}>
                          <Num
                            value={toDisplay(prof.type, f.k, prof.axes[a][f.k])}
                            dec={f.dec}
                            step={f.scale}
                            min={f.min * f.scale}
                            max={f.max * f.scale}
                            onChange={(v) => setField(a, f.k, v)}
                          />
                        </td>
                      ))}
                      <td className="mono stat">{st.max}°/s</td>
                      <td className="mono stat">{st.center}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">« Centre » = sensibilité au neutre (°/s pour 100 % de stick si la courbe restait linéaire).</p>
        </Card>

        <Card
          title="Courbes"
          actions={
            <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              <option value="">Comparer avec…</option>
              {drone.rateProfiles.filter((p) => p.id !== prof.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          }
        >
          <RateGraph series={series} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Gaz">
          <div className="row gap wrap">
            <Field label="Throttle MID">
              <Num value={prof.throttle.thr_mid / 100} dec={2} step={0.01} min={0} max={1} onChange={(v) => mutProf((p) => (p.throttle.thr_mid = Math.round(v * 100)))} />
            </Field>
            <Field label="Throttle EXPO">
              <Num value={prof.throttle.thr_expo / 100} dec={2} step={0.01} min={0} max={1} onChange={(v) => mutProf((p) => (p.throttle.thr_expo = Math.round(v * 100)))} />
            </Field>
            <Field label="Limite gaz">
              <select value={prof.throttle.throttle_limit_type} onChange={(e) => mutProf((p) => (p.throttle.throttle_limit_type = e.target.value))}>
                <option>OFF</option>
                <option>SCALE</option>
                <option>CLIP</option>
              </select>
            </Field>
            <Field label="Limite %">
              <Num value={prof.throttle.throttle_limit_percent} min={25} max={100} onChange={(v) => mutProf((p) => (p.throttle.throttle_limit_percent = Math.round(v)))} />
            </Field>
          </div>
        </Card>
        <Card title="Paramètres avancés (CLI)">
          <ExtraEditor extra={prof.extra} onChange={(e) => mutProf((p) => (p.extra = e))} suggestions={RATE_EXTRA_KEYS} listId="rate-keys" />
        </Card>
      </div>

      <Card title="Notes">
        <textarea rows={2} placeholder="Usage (race technique, bando, sim…), ressenti…" value={prof.notes} onChange={(e) => mutProf((p) => (p.notes = e.target.value))} />
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
          describe={(d) => `${RATE_TYPES[d.type]?.short} — ` + AXES.map((a) => `${a[0].toUpperCase()} max ${stats(d.type, d.axes[a]).max}`).join(' · ')}
        />
      </Card>
    </div>
  );
}
