import { DRONE_CATEGORIES, FIRMWARES } from '../lib/model.js';
import { Card, Field } from './ui.jsx';

const TEXT_FIELDS = [
  ['frame', 'Châssis', 'ex : Five33 LightSwitch'],
  ['motors', 'Moteurs', 'ex : Velox V3 2207'],
  ['kv', 'KV', '1750'],
  ['cells', 'Batterie', '6S 1100 mAh'],
  ['props', 'Hélices', 'HQ R38 5"'],
  ['weight', 'Poids (g, sans batterie)', '420'],
  ['fc', 'Contrôleur de vol', 'ex : H743'],
  ['esc', 'ESC', 'ex : 65A BLHeli_32 / AM32'],
];

export default function MachineTab({ drone, mutDrone, onDelete, onDuplicate }) {
  const set = (k) => (e) => mutDrone((d) => (d[k] = e.target.value));
  return (
    <div className="stack">
      <Card title="Fiche machine">
        <div className="form-grid">
          <Field label="Nom">
            <input value={drone.name} onChange={set('name')} />
          </Field>
          <Field label="Catégorie">
            <select value={drone.category} onChange={set('category')}>
              {DRONE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Firmware" hint="Détermine le format D min / D max à l'export">
            <select value={drone.firmware} onChange={set('firmware')}>
              {FIRMWARES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          {TEXT_FIELDS.map(([k, label, ph]) => (
            <Field key={k} label={label}>
              <input value={drone[k] || ''} placeholder={ph} onChange={set(k)} />
            </Field>
          ))}
        </div>
        <Field label="Notes (filtres, RPM filter, particularités…)">
          <textarea rows={3} value={drone.notes} onChange={set('notes')} />
        </Field>
      </Card>
      <div className="row gap">
        <button className="btn ghost" onClick={onDuplicate}>Dupliquer ce drone</button>
        <button className="btn ghost danger" onClick={onDelete}>Supprimer ce drone</button>
      </div>
    </div>
  );
}
