import { useEffect, useRef, useState } from 'react';
import { askAssistant, extractProposal, stripJson, QUICK_PROMPTS } from '../lib/ai.js';
import { snapshot, uid } from '../lib/model.js';
import { AXES, RATE_TYPES, stats } from '../lib/rates.js';
import { Card } from './ui.jsx';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function md(text) {
  return esc(text)
    .split('\n')
    .map((l) => {
      let h = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
      if (/^#{1,4}\s/.test(l)) return `<h4>${h.replace(/^#+\s/, '')}</h4>`;
      if (/^\s*[-*]\s/.test(l)) return `<li>${h.replace(/^\s*[-*]\s/, '')}</li>`;
      if (/^\s*\d+\.\s/.test(l)) return `<li>${h}</li>`;
      return h ? `<p>${h}</p>` : '';
    })
    .join('');
}

function ProposalDiff({ drone, prop }) {
  const pid = drone.pidProfiles.find((p) => p.id === drone.activePid);
  const rate = drone.rateProfiles.find((p) => p.id === drone.activeRate);
  const rows = [];
  if (prop.pid)
    for (const a of AXES)
      for (const [k, v] of Object.entries(prop.pid[a] || {}))
        if (pid.pids[a][k] !== v) rows.push([`${a} ${k}`, pid.pids[a][k], v]);
  for (const [k, v] of Object.entries(prop.pidExtra || {})) rows.push([k, pid.extra[k] ?? '—', v]);
  if (prop.rates) {
    if (prop.rates.type && prop.rates.type !== rate.type) rows.push(['rates_type', rate.type, prop.rates.type]);
    for (const a of AXES)
      for (const [k, v] of Object.entries(prop.rates[a] || {}))
        if (rate.axes[a][k] !== v) rows.push([`${a}_${k}`, rate.axes[a][k], v]);
  }
  for (const [k, v] of Object.entries(prop.throttle || {})) rows.push([k, rate.throttle[k], v]);
  if (!rows.length) return <p className="muted small">Aucune différence avec les profils actifs.</p>;
  return (
    <table className="diff">
      <tbody>
        {rows.map(([k, a, b]) => (
          <tr key={k}>
            <td className="mono">{k}</td>
            <td className="mono muted">{String(a)}</td>
            <td>→</td>
            <td className="mono strong">{String(b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AiTab({ drone, mutDrone, settings, goSettings }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);
  const chat = drone.chat || [];
  const pid = drone.pidProfiles.find((p) => p.id === drone.activePid);
  const rate = drone.rateProfiles.find((p) => p.id === drone.activeRate);
  const ready = settings.apiMode === 'proxy' ? !!settings.proxyUrl : !!settings.apiKey;

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [chat.length, busy]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setErr('');
    setInput('');
    const userMsg = { id: uid(), role: 'user', content };
    const history = [...chat, userMsg].slice(-16);
    mutDrone((d) => (d.chat = [...(d.chat || []), userMsg]));
    setBusy(true);
    try {
      const reply = await askAssistant(settings, drone, history);
      mutDrone((d) => d.chat.push({ id: uid(), role: 'assistant', content: reply }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = (msgId, prop) =>
    mutDrone((d) => {
      const p = d.pidProfiles.find((x) => x.id === d.activePid);
      const r = d.rateProfiles.find((x) => x.id === d.activeRate);
      if (prop.pid || prop.pidExtra) {
        p.history.push(snapshot(p, 'Avant suggestion IA'));
        for (const a of AXES)
          for (const [k, v] of Object.entries(prop.pid?.[a] || {}))
            if (k in p.pids[a] && !isNaN(+v)) p.pids[a][k] = Math.round(+v);
        for (const [k, v] of Object.entries(prop.pidExtra || {})) p.extra[k] = String(v);
      }
      if (prop.rates || prop.throttle) {
        r.history.push(snapshot(r, 'Avant suggestion IA'));
        if (prop.rates?.type && RATE_TYPES[prop.rates.type]) r.type = prop.rates.type;
        for (const a of AXES)
          for (const [k, v] of Object.entries(prop.rates?.[a] || {}))
            if (k in r.axes[a] && !isNaN(+v)) r.axes[a][k] = Math.round(+v);
        for (const [k, v] of Object.entries(prop.throttle || {})) r.throttle[k] = isNaN(+v) ? v : +v;
      }
      const m = d.chat.find((x) => x.id === msgId);
      if (m) m.applied = true;
    });

  return (
    <div className="ai-layout">
      <Card className="ai-chat" title="Assistant de réglage IA">
        {!ready && (
          <div className="notice">
            Configure d'abord l'accès à l'IA (clé API ou proxy). <button className="btn small" onClick={goSettings}>Ouvrir les réglages</button>
          </div>
        )}
        <div className="messages">
          {chat.length === 0 && (
            <div className="muted empty">
              <p>Décris un symptôme en vol, colle un extrait de diff ou tes observations Blackbox. L'assistant voit la machine et les profils actifs.</p>
            </div>
          )}
          {chat.map((m) => {
            const prop = m.role === 'assistant' ? extractProposal(m.content) : null;
            return (
              <div key={m.id} className={`msg ${m.role}`}>
                {m.role === 'user' ? <p>{m.content}</p> : <div className="md" dangerouslySetInnerHTML={{ __html: md(stripJson(m.content)) }} />}
                {prop && (
                  <div className="proposal">
                    <strong>Proposition{prop.summary ? ` : ${prop.summary}` : ''}</strong>
                    <ProposalDiff drone={drone} prop={prop} />
                    <button className="btn small" disabled={m.applied} onClick={() => apply(m.id, prop)}>
                      {m.applied ? 'Appliquée ✓ (version précédente sauvegardée)' : 'Appliquer aux profils actifs'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {busy && <div className="msg assistant"><p className="muted">Analyse en cours…</p></div>}
          <div ref={endRef} />
        </div>
        {err && <p className="notice error">Erreur : {err}</p>}
        <div className="chips quick">
          {QUICK_PROMPTS.map((q) => (
            <button key={q.label} className="chip" disabled={busy || !ready} onClick={() => send(q.text)}>{q.label}</button>
          ))}
        </div>
        <div className="composer">
          <textarea
            rows={3}
            placeholder="Ex : propwash en sortie de split-S, hélices HQ R38, moteurs tièdes, RPM filter actif…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <div className="row gap">
            <button className="btn" disabled={busy || !ready || !input.trim()} onClick={() => send()}>Envoyer</button>
            <button className="btn ghost small" disabled={!chat.length} onClick={() => confirm('Effacer la conversation de ce drone ?') && mutDrone((d) => (d.chat = []))}>Effacer</button>
          </div>
        </div>
      </Card>

      <Card className="ai-context" title="Contexte envoyé">
        <dl className="kv">
          <dt>Drone</dt><dd>{drone.name} — {drone.category}</dd>
          <dt>Firmware</dt><dd>Betaflight {drone.firmware}</dd>
          <dt>Setup</dt><dd>{[drone.frame, drone.motors && `${drone.motors} ${drone.kv}KV`, drone.cells, drone.props, drone.weight && `${drone.weight} g`].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Profil PID</dt><dd>{pid.name}</dd>
          <dt>Rates</dt><dd>{rate.name} ({RATE_TYPES[rate.type].short}, max {stats(rate.type, rate.axes.roll).max}°/s)</dd>
        </dl>
        <p className="muted small">Plus la fiche machine (onglet Machine) est complète, plus les suggestions sont pertinentes. Chaque suggestion appliquée sauvegarde d'abord la version précédente dans l'historique.</p>
        <p className="muted small">L'IA propose, tu valides : teste toujours un changement par vol court et contrôle la température moteurs.</p>
      </Card>
    </div>
  );
}
