import { AXES } from './rates.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const MAX_PID_PROFILES = 4; // Betaflight 4.3+
export const MAX_RATE_PROFILES = 4; // Betaflight 4.3+ (6 jusqu'en 4.2)

export const FIRMWARES = [
  { id: '4.3', label: 'Betaflight 4.3', dScheme: 'dmin' },
  { id: '4.4', label: 'Betaflight 4.4', dScheme: 'dmin' },
  { id: '4.5', label: 'Betaflight 4.5', dScheme: 'dmin' },
  { id: '2025.12', label: 'Betaflight 2025.12+', dScheme: 'dmax' },
];

export const dSchemeOf = (fw) => (FIRMWARES.find((f) => f.id === fw) || FIRMWARES[2]).dScheme;

// Valeurs par défaut Betaflight 4.5 (D max = valeur haute, D min = valeur basse)
export const DEFAULT_PIDS = {
  roll: { p: 45, i: 80, dmax: 40, dmin: 30, f: 120 },
  pitch: { p: 47, i: 84, dmax: 46, dmin: 34, f: 125 },
  yaw: { p: 45, i: 80, dmax: 0, dmin: 0, f: 120 },
};

export const DEFAULT_RATES = {
  type: 'ACTUAL',
  axes: {
    roll: { rc_rate: 7, srate: 67, expo: 54 },
    pitch: { rc_rate: 7, srate: 67, expo: 54 },
    yaw: { rc_rate: 7, srate: 67, expo: 54 },
  },
  throttle: { thr_mid: 50, thr_expo: 0, throttle_limit_type: 'OFF', throttle_limit_percent: 100 },
};

export function newPidProfile(name = 'Profil PID') {
  return { id: uid(), name, pids: structuredClone(DEFAULT_PIDS), extra: {}, notes: '', history: [] };
}

export function newRateProfile(name = 'Rates') {
  return { id: uid(), name, ...structuredClone(DEFAULT_RATES), extra: {}, notes: '', history: [] };
}

export function newDrone(name = 'Nouveau drone') {
  const pid = newPidProfile('Race');
  const rate = newRateProfile('Race');
  return {
    id: uid(),
    name,
    category: '5" race',
    frame: '',
    motors: '',
    kv: '',
    cells: '6S',
    props: '',
    weight: '',
    fc: '',
    esc: '',
    firmware: '4.5',
    notes: '',
    pidProfiles: [pid],
    rateProfiles: [rate],
    activePid: pid.id,
    activeRate: rate.id,
    global: {},
    chat: [],
  };
}

export function snapshot(profile, label) {
  const { history, ...data } = profile;
  return { id: uid(), ts: Date.now(), label: label || 'Sauvegarde', data: structuredClone(data) };
}

// Valeurs par défaut du firmware : un `diff` n'affiche que ce qui s'en écarte,
// donc toute clé absente à l'import vaut ceci (et non les valeurs de départ de l'app).
export const BF_DEFAULT_RATE_AXIS = { rc_rate: 7, srate: 67, expo: 0 };

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (v, d, min = 0, max = 255) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(max, Math.max(min, Math.round(+v))) : d);

// Remet d'équerre des données venant d'une sauvegarde, d'une ancienne version ou du serveur :
// champs manquants complétés, valeurs bornées, identifiants uniques.
export function normalizeState(raw) {
  const src = obj(raw);
  const seen = new Set();
  const freshId = (id) => {
    const v = typeof id === 'string' && id && !seen.has(id) ? id : uid();
    seen.add(v);
    return v;
  };
  const history = (h) =>
    (Array.isArray(h) ? h : [])
      .filter((x) => x && typeof x === 'object' && x.data && typeof x.data === 'object')
      .map((x) => ({ id: freshId(x.id), ts: +x.ts || Date.now(), label: String(x.label || 'Sauvegarde'), data: x.data }));
  const pidProfile = (p0, i) => {
    const p = obj(p0);
    const pids = {};
    for (const a of AXES) {
      const s = obj(obj(p.pids)[a]);
      const d = DEFAULT_PIDS[a];
      pids[a] = { p: int(s.p, d.p), i: int(s.i, d.i), dmax: int(s.dmax, d.dmax), dmin: int(s.dmin, d.dmin), f: int(s.f, d.f, 0, 2000) };
    }
    return { id: freshId(p.id), name: String(p.name ?? `PID${i + 1}`), pids, extra: { ...obj(p.extra) }, notes: String(p.notes || ''), history: history(p.history) };
  };
  const rateProfile = (r0, i) => {
    const r = obj(r0);
    const axes = {};
    for (const a of AXES) {
      const s = obj(obj(r.axes)[a]);
      const d = DEFAULT_RATES.axes[a];
      axes[a] = { rc_rate: int(s.rc_rate, d.rc_rate, 1), srate: int(s.srate, d.srate), expo: int(s.expo, d.expo, 0, 100) };
    }
    const t = obj(r.throttle);
    return {
      id: freshId(r.id),
      name: String(r.name ?? `RATE${i + 1}`),
      type: KNOWN_RATE_TYPES.includes(r.type) ? r.type : DEFAULT_RATES.type,
      axes,
      throttle: {
        thr_mid: int(t.thr_mid, 50, 0, 100),
        thr_expo: int(t.thr_expo, 0, 0, 100),
        throttle_limit_type: ['OFF', 'SCALE', 'CLIP'].includes(t.throttle_limit_type) ? t.throttle_limit_type : 'OFF',
        throttle_limit_percent: int(t.throttle_limit_percent, 100, 25, 100),
      },
      extra: { ...obj(r.extra) },
      notes: String(r.notes || ''),
      history: history(r.history),
    };
  };
  const drones = (Array.isArray(src.drones) ? src.drones : [])
    .filter((d) => d && typeof d === 'object')
    .map((d0) => {
      const base = newDrone();
      const d = { ...base, ...d0 };
      d.id = freshId(d0.id);
      for (const k of ['name', 'category', 'frame', 'motors', 'kv', 'cells', 'props', 'weight', 'fc', 'esc', 'notes']) d[k] = String(d[k] ?? '');
      if (!FIRMWARES.some((f) => f.id === d.firmware)) d.firmware = '4.5';
      const pp = Array.isArray(d0.pidProfiles) && d0.pidProfiles.length ? d0.pidProfiles : base.pidProfiles;
      const rp = Array.isArray(d0.rateProfiles) && d0.rateProfiles.length ? d0.rateProfiles : base.rateProfiles;
      const oldPid = pp.map((p) => p?.id);
      const oldRate = rp.map((p) => p?.id);
      d.pidProfiles = pp.map(pidProfile);
      d.rateProfiles = rp.map(rateProfile);
      // l'identifiant actif suit le profil même si son id a dû être régénéré
      d.activePid = d.pidProfiles[Math.max(0, oldPid.indexOf(d0.activePid))].id;
      d.activeRate = d.rateProfiles[Math.max(0, oldRate.indexOf(d0.activeRate))].id;
      d.global = { ...obj(d0.global) };
      d.chat = (Array.isArray(d0.chat) ? d0.chat : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_CHAT)
        .map((m) => ({ ...m, id: freshId(m.id) }));
      return d;
    });
  if (!drones.length) return null;
  return { version: 1, drones };
}

export const MAX_CHAT = 80; // messages conservés par drone
const KNOWN_RATE_TYPES = ['BETAFLIGHT', 'ACTUAL', 'QUICK', 'KISS', 'RACEFLIGHT'];

export const DRONE_CATEGORIES = ['5" race', '5" freestyle', '7" long range', '3" cinewhoop', 'Toothpick', 'Tinywhoop', 'Cinelifter', 'Autre'];

// Simulateurs — systèmes de rates proposés dans leurs menus.
// Ces listes évoluent avec les mises à jour : vérifie dans les réglages du simu.
export const SIMULATORS = [
  { id: 'liftoff', name: 'Liftoff', systems: ['BETAFLIGHT', 'ACTUAL', 'KISS', 'RACEFLIGHT'], note: 'Menu Drone > Flight Controller. Rates par axe.' },
  { id: 'velocidrone', name: 'VelociDrone', systems: ['BETAFLIGHT', 'ACTUAL', 'KISS', 'RACEFLIGHT'], note: 'Options > Rates. Choisis le "Rate Profile" correspondant.' },
  { id: 'tryp', name: 'TRYP FPV', systems: ['BETAFLIGHT', 'ACTUAL'], note: 'Paramètres > Contrôles > Rates.' },
  { id: 'uncrashed', name: 'Uncrashed', systems: ['BETAFLIGHT', 'ACTUAL'], note: 'Settings > Rates.' },
  { id: 'drl', name: 'DRL Simulator', systems: ['BETAFLIGHT'], note: 'Settings > Drone > Rates (Betaflight).' },
  { id: 'skydive', name: 'FPV SkyDive', systems: ['BETAFLIGHT'], note: 'Settings > Rates.' },
];

// Clés CLI de profil PID fréquentes (proposées dans "Paramètres avancés")
export const PID_EXTRA_KEYS = [
  'simplified_pids_mode', 'simplified_master_multiplier', 'simplified_i_gain', 'simplified_d_gain',
  'simplified_pi_gain', 'simplified_dmax_gain', 'simplified_feedforward_gain', 'simplified_pitch_d_gain',
  'simplified_pitch_pi_gain', 'simplified_dterm_filter', 'simplified_dterm_filter_multiplier',
  'dterm_lpf1_static_hz', 'dterm_lpf1_dyn_min_hz', 'dterm_lpf1_dyn_max_hz', 'dterm_lpf2_static_hz',
  'tpa_mode', 'tpa_rate', 'tpa_breakpoint', 'anti_gravity_gain', 'iterm_relax', 'iterm_relax_cutoff',
  'feedforward_transition', 'feedforward_boost', 'feedforward_smooth_factor', 'feedforward_jitter_factor',
  'feedforward_averaging', 'feedforward_max_rate_limit', 'd_max_advance', 'thrust_linear', 'throttle_boost',
  'motor_output_limit', 'dyn_idle_min_rpm', 'vbat_sag_compensation', 'angle_p_gain', 'horizon_level_strength',
];

export const RATE_EXTRA_KEYS = ['rate_limit', 'roll_rate_limit', 'pitch_rate_limit', 'yaw_rate_limit', 'tpa_rate', 'tpa_breakpoint'];

// Clés globales utiles au tuning (filtres gyro, RPM...) conservées à l'import
export const GLOBAL_KEY_RE = /^(gyro_|dyn_notch|rpm_filter|dshot_bidir|motor_pwm_protocol|pid_process_denom|simplified_gyro|dyn_lpf|motor_poles)/;

export function profileForAI(drone) {
  const pid = drone.pidProfiles.find((p) => p.id === drone.activePid);
  const rate = drone.rateProfiles.find((p) => p.id === drone.activeRate);
  const { pidProfiles, rateProfiles, chat, id, activePid, activeRate, ...machine } = drone;
  const strip = (p) => p && (({ history, id, ...rest }) => rest)(p);
  return { machine, pidProfile: strip(pid), rateProfile: strip(rate), axes: AXES };
}
