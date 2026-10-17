import { useMemo, useState } from 'react';
import { AXES, AXIS_LABEL, RATE_TYPES, fitRates, toDisplay, fromDisplay, stats } from '../lib/rates.js';
import { SIMULATORS, MAX_RATE_PROFILES, newRateProfile } from '../lib/model.js';
import RateGraph from './RateGraph.jsx';
import { Card, Field, Num, copy } from './ui.jsx';

export default function SimTab({ drone, mutDrone }) {
  const [simId, setSimId] = useState('liftoff');
  const sim = SIMULATORS.find((s) => s.id === simId);
  const [system, setSystem] = useState('');
  const sys = sim.systems.includes(system) ? system : sim.systems.includes('ACTUAL') ? 'ACTUAL' : sim.systems[0];
  const [srcId, setSrcId] = useState(drone.activeRate);
  const src = drone.rateProfiles.find((p) => p.id === srcId) || drone.rateProfiles[0];

  const fits = useMemo(() => {
    const o = {};
    for (const a of AXES) o[a] = src.type === sys ? { params: src.axes[a], rmse: 0 } : fitRates(src.type, src.axes[a], sys);
    return o;
  }, [src, sys]);

  const def = RATE_TYPES[sys];
  const text = [
    `${sim.name} — système ${def.short} (depuis ${drone.name} / ${src.name})`,
    ...AXES.map((a) => `${AXIS_LABEL[a]} : ` + def.fields.map((f) => `${f.label} ${toDisplay(sys, f.k, fits[a].params[f.k])}`).join(' · ')),
  ].join('\n');

  const series = [];
  for (const a of ['roll', 'yaw']) {
    series.push({ key: 'o' + a, axis: a, label: `Drone ${AXIS_LABEL[a]}`, type: src.type, params: src.axes[a] });
    series.push({ key: 's' + a, axis: a, dashed: true, label: `${sim.name} ${AXIS_LABEL[a]}`, type: sys, params: fits[a].params });
  }

  // Import depuis un simu
  const [impSys, setImpSys] = useState('BETAFLIGHT');
  const [imp, setImp] = useState(() => Object.fromEntries(AXES.map((a) => [a, { ...RATE_TYPES.BETAFLIGHT.starts[0] }])));
  const impDef = RATE_TYPES[impSys];

  return (
    <div className="stack">
      <Card title="Transposer mes rates dans un simulateur">
        <div className="row gap wrap">
          <Field label="Rates source">
            <select value={src.id} onChange={(e) => setSrcId(e.target.value)}>
              {drone.rateProfiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({RATE_TYPES[p.type].short})</option>)}
            </select>
          </Field>
          <Field label="Simulateur">
            <select value={simId} onChange={(e) => setSimId(e.target.value)}>
              {SIMULATORS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Système dans le simu">
            <select value={sys} onChange={(e) => setSystem(e.target.value)}>
              {sim.systems.map((s) => <option key={s} value={s}>{RATE_TYPES[s].label}</option>)}
            </select>
          </Field>
        </div>
        <p className="muted small">{sim.note} Si ton simu propose le même système que ton drone, choisis-le : les valeurs sont alors identiques.</p>
        <div className="grid-2">
          <div>
            <div className="table-wrap">
              <table className="pid-table">
                <thead>
                  <tr>
                    <th />
                    {def.fields.map((f) => <th key={f.k}>{f.label}</th>)}
                    <th>Max</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {AXES.map((a) => (
                    <tr key={a}>
                      <th className={`axis ${a}`}>{AXIS_LABEL[a]}</th>
                      {def.fields.map((f) => <td key={f.k} className="mono big">{toDisplay(sys, f.k, fits[a].params[f.k])}</td>)}
                      <td className="mono stat">{stats(sys, fits[a].params).max}°/s</td>
                      <td className={`mono stat ${fits[a].rmse > 15 ? 'warn' : ''}`}>±{fits[a].rmse.toFixed(1)}°/s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn small" onClick={() => copy(text)}>Copier les valeurs</button>
            <p className="muted small">« Écart » = différence moyenne entre la courbe du drone et celle du simu sur toute la course du stick.</p>
          </div>
          <RateGraph series={series} height={230} />
        </div>
      </Card>

      <Card title="Compatibilité des simulateurs">
        <div className="table-wrap">
          <table className="pid-table">
            <thead>
              <tr>
                <th>Simulateur</th>
                {Object.keys(RATE_TYPES).map((k) => <th key={k}>{RATE_TYPES[k].short}</th>)}
              </tr>
            </thead>
            <tbody>
              {SIMULATORS.map((s) => (
                <tr key={s.id}>
                  <th>{s.name}</th>
                  {Object.keys(RATE_TYPES).map((k) => <td key={k}>{s.systems.includes(k) ? '●' : '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Indicatif : les éditeurs ajoutent régulièrement des systèmes. Modifiable dans <code>src/lib/model.js</code>.</p>
      </Card>

      <Card title="Importer des rates depuis un simu vers ce drone">
        <div className="row gap wrap">
          <Field label="Système utilisé dans le simu">
            <select
              value={impSys}
              onChange={(e) => {
                const t = e.target.value;
                setImpSys(t);
                setImp(Object.fromEntries(AXES.map((a) => [a, { ...RATE_TYPES[t].starts[0] }])));
              }}
            >
              {Object.entries(RATE_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="table-wrap">
          <table className="pid-table">
            <thead>
              <tr>
                <th />
                {impDef.fields.map((f) => <th key={f.k}>{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {AXES.map((a) => (
                <tr key={a}>
                  <th className={`axis ${a}`}>{AXIS_LABEL[a]}</th>
                  {impDef.fields.map((f) => (
                    <td key={f.k}>
                      <Num
                        value={toDisplay(impSys, f.k, imp[a][f.k] ?? 0)}
                        dec={f.dec}
                        step={f.scale}
                        onChange={(v) => setImp((s) => ({ ...s, [a]: { ...s[a], [f.k]: fromDisplay(impSys, f.k, v) } }))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn"
          disabled={drone.rateProfiles.length >= MAX_RATE_PROFILES}
          onClick={() =>
            mutDrone((d) => {
              const r = newRateProfile('SIM');
              r.type = impSys;
              r.axes = structuredClone(imp);
              d.rateProfiles.push(r);
              d.activeRate = r.id;
            })
          }
        >
          Créer un rate profile « SIM »
        </button>
        {drone.rateProfiles.length >= MAX_RATE_PROFILES && <span className="muted small"> 6 slots déjà utilisés.</span>}
      </Card>
    </div>
  );
}
