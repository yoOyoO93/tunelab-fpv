import { newDrone } from './model.js';
import { DEFAULT_MODEL } from './ai.js';

const KEY = 'tunelab-fpv-v1';
const KEY_SETTINGS = 'tunelab-fpv-settings';

export function initialState() {
  const d = newDrone('Mon 5" race');
  return { version: 1, drones: [d] };
}

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.drones) && s.drones.length) return s;
  } catch {}
  return initialState();
}

export function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function loadSettings() {
  const def = { apiMode: 'direct', apiKey: '', proxyUrl: './api/', proxyToken: '', model: DEFAULT_MODEL };
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
