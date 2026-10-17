// Moteur de rates — formules reprises de Betaflight (src/main/fc/rc.c)
// Toutes les valeurs sont stockées en "unités CLI brutes" (ce que tu tapes dans `set roll_rc_rate = ...`)
// et converties pour l'affichage selon le système choisi.

export const AXES = ['roll', 'pitch', 'yaw'];
export const AXIS_LABEL = { roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw' };
export const SETPOINT_LIMIT = 1998;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sign = (x) => (x < 0 ? -1 : 1);

function betaflight(x, { rc_rate, srate, expo }) {
  const ax = Math.abs(x);
  let cmd = x;
  if (expo) {
    const e = expo / 100;
    cmd = x * ax ** 3 * e + x * (1 - e);
  }
  let rcRate = rc_rate / 100;
  if (rcRate > 2) rcRate += 14.54 * (rcRate - 2);
  let angle = 200 * rcRate * cmd;
  if (srate) angle *= 1 / clamp(1 - ax * (srate / 100), 0.01, 1);
  return angle;
}

function actual(x, { rc_rate, srate, expo }) {
  const ax = Math.abs(x);
  const e = expo / 100;
  const expof = ax * (x ** 5 * e + x * (1 - e));
  const center = rc_rate * 10;
  const stick = Math.max(0, srate * 10 - center);
  return x * center + stick * expof;
}

function quick(x, { rc_rate, srate, expo }) {
  const ax = Math.abs(x);
  const rcRate = Math.max(1, rc_rate * 2);
  const maxDPS = Math.max(srate * 10, rcRate);
  const e = expo / 100;
  const sfc = (maxDPS / rcRate - 1) / (maxDPS / rcRate);
  const curve = ax ** 3 * e + ax * (1 - e);
  const sf = 1 / clamp(1 - curve * sfc, 0.01, 1);
  return x * rcRate * sf;
}

function kiss(x, { rc_rate, srate, expo }) {
  const ax = Math.abs(x);
  const rpy = 1 / clamp(1 - ax * (srate / 100), 0.01, 1);
  const c = expo / 100;
  const k = (x ** 3 * c + x * (1 - c)) * (rc_rate / 1000);
  return 2000 * rpy * k;
}

function raceflight(x, { rc_rate, srate, expo }) {
  const ax = Math.abs(x);
  const cmd = (1 + 0.01 * expo * (x * x - 1)) * x;
  let angle = 10 * rc_rate * cmd;
  angle *= 1 + ax * srate * 0.01;
  return angle;
}

// scale : facteur brut -> affiché. dec : décimales affichées.
export const RATE_TYPES = {
  BETAFLIGHT: {
    label: 'Betaflight (RC Rate / Super Rate)',
    short: 'Betaflight',
    fn: betaflight,
    fields: [
      { k: 'rc_rate', label: 'RC Rate', scale: 0.01, dec: 2, min: 1, max: 255 },
      { k: 'srate', label: 'Super Rate', scale: 0.01, dec: 2, min: 0, max: 100 },
      { k: 'expo', label: 'RC Expo', scale: 0.01, dec: 2, min: 0, max: 100 },
    ],
    starts: [
      { rc_rate: 100, srate: 70, expo: 0 },
      { rc_rate: 150, srate: 50, expo: 20 },
      { rc_rate: 80, srate: 80, expo: 10 },
    ],
  },
  ACTUAL: {
    label: 'Actual Rates (Center / Max / Expo)',
    short: 'Actual',
    fn: actual,
    fields: [
      { k: 'rc_rate', label: 'Center Sensitivity', scale: 10, dec: 0, unit: '°/s', min: 1, max: 255 },
      { k: 'srate', label: 'Max Rate', scale: 10, dec: 0, unit: '°/s', min: 0, max: 255 },
      { k: 'expo', label: 'Expo', scale: 0.01, dec: 2, min: 0, max: 100 },
    ],
    starts: [
      { rc_rate: 7, srate: 67, expo: 54 },
      { rc_rate: 20, srate: 80, expo: 30 },
      { rc_rate: 35, srate: 50, expo: 0 },
    ],
  },
  QUICK: {
    label: 'Quick Rates (RC Rate / Max / Expo)',
    short: 'Quick',
    fn: quick,
    fields: [
      { k: 'rc_rate', label: 'RC Rate', scale: 2, dec: 0, unit: '°/s', min: 1, max: 255 },
      { k: 'srate', label: 'Max Rate', scale: 10, dec: 0, unit: '°/s', min: 0, max: 255 },
      { k: 'expo', label: 'Expo', scale: 0.01, dec: 2, min: 0, max: 100 },
    ],
    starts: [
      { rc_rate: 100, srate: 67, expo: 0 },
      { rc_rate: 60, srate: 80, expo: 30 },
    ],
  },
  KISS: {
    label: 'KISS (RC Rate / Rate / RC Curve)',
    short: 'KISS',
    fn: kiss,
    fields: [
      { k: 'rc_rate', label: 'RC Rate', scale: 0.01, dec: 2, min: 1, max: 255 },
      { k: 'srate', label: 'Rate', scale: 0.01, dec: 2, min: 0, max: 99 },
      { k: 'expo', label: 'RC Curve', scale: 0.01, dec: 2, min: 0, max: 100 },
    ],
    starts: [
      { rc_rate: 100, srate: 70, expo: 40 },
      { rc_rate: 150, srate: 50, expo: 20 },
    ],
  },
  RACEFLIGHT: {
    label: 'RaceFlight (Rate / Acro+ / Expo)',
    short: 'RaceFlight',
    fn: raceflight,
    fields: [
      { k: 'rc_rate', label: 'Rate', scale: 10, dec: 0, unit: '°/s', min: 1, max: 255 },
      { k: 'srate', label: 'Acro+', scale: 1, dec: 0, min: 0, max: 255 },
      { k: 'expo', label: 'Expo', scale: 1, dec: 0, min: 0, max: 100 },
    ],
    starts: [
      { rc_rate: 37, srate: 80, expo: 50 },
      { rc_rate: 60, srate: 20, expo: 20 },
    ],
  },
};

export function rateAt(type, x, params) {
  const def = RATE_TYPES[type] || RATE_TYPES.BETAFLIGHT;
  return clamp(def.fn(x, params), -SETPOINT_LIMIT, SETPOINT_LIMIT);
}

export function curve(type, params, n = 80) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = i / n;
    return [x, rateAt(type, x, params)];
  });
}

export function stats(type, params) {
  const max = rateAt(type, 1, params);
  const center = rateAt(type, 0.01, params) / 0.01; // sensibilité au neutre (°/s par unité de stick)
  const half = rateAt(type, 0.5, params);
  return { max: Math.round(max), center: Math.round(center), half: Math.round(half) };
}

export function toDisplay(type, k, raw) {
  const f = RATE_TYPES[type].fields.find((f) => f.k === k);
  return +(raw * f.scale).toFixed(f.dec);
}

export function fromDisplay(type, k, val) {
  const f = RATE_TYPES[type].fields.find((f) => f.k === k);
  return clamp(Math.round(val / f.scale), f.min, f.max);
}

// Conversion entre systèmes : recherche par motif sur les 3 paramètres entiers
// pour minimiser l'écart RMS entre les deux courbes (en °/s).
export function fitRates(srcType, srcParams, dstType) {
  const def = RATE_TYPES[dstType];
  const xs = Array.from({ length: 61 }, (_, i) => i / 60);
  const target = xs.map((x) => rateAt(srcType, x, srcParams));
  const err = (p) => {
    let e = 0;
    for (let i = 0; i < xs.length; i++) {
      // poids un peu plus fort au centre : c'est là que la sensation se joue
      const w = xs[i] === 1 ? 10 : 1 + (1 - xs[i]); // le max rate doit coller
      const d = rateAt(dstType, xs[i], p) - target[i];
      e += w * d * d;
    }
    return Math.sqrt(e / xs.length);
  };
  let best = null;
  let bestE = Infinity;
  const starts = [...def.starts];
  if (srcType === dstType) starts.unshift({ ...srcParams });
  for (const s of starts) {
    let p = { ...s };
    let e = err(p);
    for (const step of [32, 16, 8, 4, 2, 1]) {
      let improved = true;
      let guard = 0;
      while (improved && guard++ < 200) {
        improved = false;
        for (const f of def.fields) {
          for (const d of [step, -step]) {
            const q = { ...p, [f.k]: clamp(p[f.k] + d, f.min, f.max) };
            const qe = err(q);
            if (qe < e - 1e-9) {
              p = q;
              e = qe;
              improved = true;
            }
          }
        }
      }
    }
    if (e < bestE) {
      best = p;
      bestE = e;
    }
  }
  // écart réel non pondéré, plus parlant pour l'utilisateur
  let raw = 0;
  xs.forEach((x, i) => {
    const d = rateAt(dstType, x, best) - target[i];
    raw += d * d;
  });
  return { params: best, rmse: Math.sqrt(raw / xs.length) };
}

export function convertProfileAxes(srcType, axes, dstType) {
  const out = {};
  for (const a of AXES) out[a] = fitRates(srcType, axes[a], dstType).params;
  return out;
}

export { sign };
