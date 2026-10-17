import { AXES } from './rates.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const MAX_PID_PROFILES = 4; // Betaflight 4.3+
export const MAX_RATE_PROFILES = 6; // Betaflight 4.2+

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
