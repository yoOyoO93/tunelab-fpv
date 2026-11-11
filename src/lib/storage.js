import { newDrone, normalizeState } from './model.js';
import { DEFAULT_MODEL } from './ai.js';

export const KEY = 'tunelab-fpv-v1';
const KEY_SETTINGS = 'tunelab-fpv-settings';
const KEY_RESCUE = 'tunelab-fpv-rescue';

export function initialState() {
  const d = newDrone('Mon 5" race');
  return { version: 1, drones: [d] };
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    const s = normalizeState(JSON.parse(raw));
    if (s) return s;
  } catch {}
  // Données présentes mais illisibles : on les met de côté plutôt que de les écraser.
  if (raw) {
    try {
      localStorage.setItem(KEY_RESCUE, raw);
    } catch {}
  }
  return initialState();
}

// Renvoie false si le navigateur a refusé l'écriture (quota plein, navigation privée...).
export function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

// Copie de secours avant qu'une version venue d'ailleurs (serveur, import) ne remplace les données locales.
export function keepRescueCopy(s) {
  try {
    localStorage.setItem(KEY_RESCUE, JSON.stringify(s));
  } catch {}
}

export function loadRescueCopy() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(KEY_RESCUE)));
  } catch {
    return null;
  }
}

export function loadSettings() {
  const def = {
    apiMode: 'direct',
    apiKey: '',
    proxyUrl: './api/',
    proxyToken: '',
    model: DEFAULT_MODEL,
    syncEnabled: false,
    syncUrl: './api/sync.php',
    deviceName: '',
  };
  try {
    return { ...def, ...(JSON.parse(localStorage.getItem(KEY_SETTINGS)) || {}) };
  } catch {
    return def;
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {}
}

export function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
