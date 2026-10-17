import { uid } from '../lib/model.js';

// kind: 'pid' | 'rate'
export default function ProfileBar({ drone, kind, max, factory, mutDrone }) {
  const listKey = kind === 'pid' ? 'pidProfiles' : 'rateProfiles';
  const activeKey = kind === 'pid' ? 'activePid' : 'activeRate';
  const list = drone[listKey];
  const active = list.find((p) => p.id === drone[activeKey]) || list[0];
  const label = kind === 'pid' ? 'Profil PID' : 'Rate profile';

  return (
    <div className="profile-bar">
      <div className="chips">
        {list.map((p, i) => (
          <button
            key={p.id}
            className={`chip ${p.id === active.id ? 'on' : ''}`}
            onClick={() => mutDrone((d) => (d[activeKey] = p.id))}
            title={`${label} ${i + 1} dans Betaflight`}
          >
            <span className="chip-idx">{i + 1}</span>
            {p.name}
          </button>
        ))}
      </div>
      <div className="row gap wrap">
        <input
          className="name-input"
          value={active.name}
          maxLength={8}
          title="8 caractères max (limite Betaflight)"
          onChange={(e) => mutDrone((d) => (d[listKey].find((p) => p.id === active.id).name = e.target.value))}
        />
        <button
          className="btn small ghost"
          disabled={list.length >= max}
          onClick={() =>
            mutDrone((d) => {
              const p = factory(`${kind === 'pid' ? 'PID' : 'RATE'}${d[listKey].length + 1}`);
              d[listKey].push(p);
              d[activeKey] = p.id;
            })
          }
        >
          + Nouveau
        </button>
        <button
          className="btn small ghost"
          disabled={list.length >= max}
          onClick={() =>
            mutDrone((d) => {
              const src = d[listKey].find((p) => p.id === active.id);
              const c = { ...structuredClone(src), id: uid(), name: (src.name + '2').slice(0, 8), history: [] };
              d[listKey].push(c);
              d[activeKey] = c.id;
            })
          }
        >
          Dupliquer
        </button>
        <button
          className="btn small ghost danger"
          disabled={list.length <= 1}
          onClick={() => {
            if (!confirm(`Supprimer « ${active.name} » et son historique ?`)) return;
            mutDrone((d) => {
              d[listKey] = d[listKey].filter((p) => p.id !== active.id);
              d[activeKey] = d[listKey][0].id;
            });
          }}
        >
          Supprimer
        </button>
        <span className="muted small">{list.length}/{max} slots Betaflight</span>
      </div>
    </div>
  );
}
