import { useState } from 'react';

export function Num({ value, onChange, step = 1, min, max, dec = 0, width }) {
  const [txt, setTxt] = useState(null);
  const shown = txt ?? (value === undefined || value === null ? '' : String(+(+value).toFixed(dec)));
  return (
    <input
      className="num"
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      style={width ? { width } : undefined}
      value={shown}
      onChange={(e) => {
        setTxt(e.target.value);
        if (e.target.value !== '' && !isNaN(+e.target.value)) onChange(+e.target.value);
      }}
      onBlur={() => setTxt(null)}
    />
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="row gap">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function ExtraEditor({ extra, onChange, suggestions = [], listId }) {
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const entries = Object.entries(extra || {});
  const add = () => {
    if (!k.trim()) return;
    onChange({ ...extra, [k.trim()]: v });
    setK('');
    setV('');
  };
  return (
    <div className="extra">
      {entries.length === 0 && <p className="muted small">Aucun paramètre supplémentaire. Ajoute des clés CLI (filtres D-term, TPA, sliders…).</p>}
      {entries.map(([key, val]) => (
        <div className="extra-row" key={key}>
          <code>{key}</code>
          <input value={val} onChange={(e) => onChange({ ...extra, [key]: e.target.value })} />
          <button
            className="icon-btn"
            title="Supprimer"
            onClick={() => {
              const n = { ...extra };
              delete n[key];
              onChange(n);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div className="extra-row add">
        <input list={listId} placeholder="clé CLI (ex : tpa_rate)" value={k} onChange={(e) => setK(e.target.value)} />
        <input placeholder="valeur" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn small" onClick={add}>Ajouter</button>
        <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </div>
  );
}

export function History({ profile, onSnapshot, onRestore, onDelete, describe }) {
  const [label, setLabel] = useState('');
  return (
    <div className="history">
      <div className="row gap">
        <input placeholder="Nom de la version (ex : après vol du 12/10, propwash OK)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button
          className="btn"
          onClick={() => {
            onSnapshot(label || `Version ${new Date().toLocaleString('fr-FR')}`);
            setLabel('');
          }}
        >
          Sauvegarder la version
        </button>
      </div>
      {profile.history.length === 0 && <p className="muted small">Pas encore de version sauvegardée pour ce profil.</p>}
      <ul className="hist-list">
        {[...profile.history].reverse().map((h) => (
          <li key={h.id}>
            <div>
              <strong>{h.label}</strong>
              <span className="muted small"> — {new Date(h.ts).toLocaleString('fr-FR')}</span>
              {describe && <div className="muted small mono">{describe(h.data)}</div>}
            </div>
            <div className="row gap">
              <button className="btn small ghost" onClick={() => onRestore(h)}>Restaurer</button>
              <button className="icon-btn" title="Supprimer" onClick={() => onDelete(h)}>×</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function copy(text) {
  navigator.clipboard?.writeText(text);
}
