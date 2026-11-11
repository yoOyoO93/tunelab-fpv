import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { KEY, download } from './lib/storage.js';
import './styles.css';

// Filet de sécurité : une erreur d'affichage ne doit jamais laisser un écran blanc
// sans moyen de récupérer ses réglages.
class Safety extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const raw = (() => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    })();
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24 }}>
        <h1>TuneLab a rencontré une erreur</h1>
        <p className="muted">Tes données sont toujours dans ce navigateur. Recharge la page ; si l'erreur revient, télécharge-les pour les mettre à l'abri.</p>
        <p className="mono small">{String(this.state.error?.message || this.state.error)}</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => location.reload()}>Recharger</button>
          {raw && <button className="btn ghost" onClick={() => download('tunelab-donnees-brutes.json', raw)}>Télécharger mes données</button>}
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Safety>
      <App />
    </Safety>
  </React.StrictMode>
);
