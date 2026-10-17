import { AXES } from './rates.js';
import { dSchemeOf, newDrone, newPidProfile, newRateProfile, DEFAULT_PIDS, DEFAULT_RATES, GLOBAL_KEY_RE } from './model.js';

const cleanName = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 8);

export function pidProfileLines(p, scheme) {
  const L = [];
  if (p.name) L.push(`set profile_name = ${cleanName(p.name)}`);
  for (const a of AXES) {
    const v = p.pids[a];
    L.push(`set p_${a} = ${v.p}`);
    L.push(`set i_${a} = ${v.i}`);
    if (scheme === 'dmax') {
      // Betaflight 2025.12+ : d_ = valeur de base (basse), d_max_ = boost (haute)
      L.push(`set d_${a} = ${v.dmin || v.dmax}`);
      L.push(`set d_max_${a} = ${v.dmax}`);
    } else {
      // Betaflight 4.3–4.5 : d_ = valeur haute, d_min_ = valeur basse
      L.push(`set d_${a} = ${v.dmax}`);
      L.push(`set d_min_${a} = ${v.dmin}`);
    }
    L.push(`set f_${a} = ${v.f}`);
  }
  for (const [k, v] of Object.entries(p.extra || {})) if (k && v !== '') L.push(`set ${k} = ${v}`);
  return L;
}

export function rateProfileLines(r) {
  const L = [];
  if (r.name) L.push(`set rateprofile_name = ${cleanName(r.name)}`);
  L.push(`set rates_type = ${r.type}`);
  for (const a of AXES) L.push(`set ${a}_rc_rate = ${r.axes[a].rc_rate}`);
  for (const a of AXES) L.push(`set ${a}_expo = ${r.axes[a].expo}`);
  for (const a of AXES) L.push(`set ${a}_srate = ${r.axes[a].srate}`);
  const t = r.throttle || {};
  if (t.thr_mid !== undefined) L.push(`set thr_mid = ${t.thr_mid}`);
  if (t.thr_expo !== undefined) L.push(`set thr_expo = ${t.thr_expo}`);
  if (t.throttle_limit_type) L.push(`set throttle_limit_type = ${t.throttle_limit_type}`);
  if (t.throttle_limit_percent !== undefined) L.push(`set throttle_limit_percent = ${t.throttle_limit_percent}`);
  for (const [k, v] of Object.entries(r.extra || {})) if (k && v !== '') L.push(`set ${k} = ${v}`);
  return L;
}

export function exportCli(drone, { scope = 'active', includeGlobal = false } = {}) {
  const scheme = dSchemeOf(drone.firmware);
  const out = [
    `# TuneLab FPV — ${drone.name}`,
    `# Firmware cible : Betaflight ${drone.firmware} — généré le ${new Date().toLocaleString('fr-FR')}`,
    '# Colle ce bloc dans l\'onglet CLI du Betaflight Configurator, puis vérifie avant de voler.',
    '',
  ];
  if (includeGlobal && Object.keys(drone.global || {}).length) {
    out.push('# Paramètres globaux (filtres)');
    for (const [k, v] of Object.entries(drone.global)) out.push(`set ${k} = ${v}`);
    out.push('');
  }
  const pids = drone.pidProfiles.map((p, i) => [p, i]).filter(([p]) => scope === 'all' || p.id === drone.activePid);
  const rates = drone.rateProfiles.map((p, i) => [p, i]).filter(([p]) => scope === 'all' || p.id === drone.activeRate);
  for (const [p, i] of pids) {
    out.push(`# Profil PID ${i + 1} — ${p.name}`, `profile ${i}`, ...pidProfileLines(p, scheme), '');
  }
  for (const [r, i] of rates) {
    out.push(`# Rate profile ${i + 1} — ${r.name}`, `rateprofile ${i}`, ...rateProfileLines(r), '');
  }
  const activeP = drone.pidProfiles.findIndex((p) => p.id === drone.activePid);
  const activeR = drone.rateProfiles.findIndex((p) => p.id === drone.activeRate);
  out.push(`profile ${Math.max(0, activeP)}`, `rateprofile ${Math.max(0, activeR)}`, 'save');
  return out.join('\n');
}

// --- Import d'un `diff all` / `dump` -----------------------------------------
export function parseCli(text) {
  const res = { version: null, craftName: '', pid: {}, rate: {}, global: {} };
  let ctx = 'global';
  let idx = 0;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ver = line.match(/Betaflight\s*\/\s*\S+\s*\(\S+\)\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (ver) res.version = ver[1];
    const prof = line.match(/^#?\s*(profile|rateprofile)\s+(\d+)\s*$/i);
    if (prof) {
      ctx = prof[1].toLowerCase() === 'profile' ? 'pid' : 'rate';
      idx = +prof[2];
      res[ctx][idx] = res[ctx][idx] || {};
      continue;
    }
    if (line.startsWith('#')) continue;
    const m = line.match(/^set\s+(\S+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'craft_name' || k === 'name') res.craftName = v;
    if (ctx === 'global') {
      if (GLOBAL_KEY_RE.test(k)) res.global[k] = v;
    } else {
      res[ctx][idx][k] = v;
    }
  }
  return res;
}

function fwFromVersion(v) {
  if (!v) return '4.5';
  const [maj, min] = v.split('.').map(Number);
  if (maj >= 2025) return '2025.12';
  if (maj === 4 && min >= 3 && min <= 5) return `4.${min}`;
  return '4.5';
}

const num = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : +v);

export function pidFromSets(sets, i, firmware) {
  const p = newPidProfile(sets.profile_name || `Profil ${i + 1}`);
  const scheme = sets.d_max_roll !== undefined ? 'dmax' : sets.d_min_roll !== undefined ? 'dmin' : dSchemeOf(firmware);
  const used = new Set(['profile_name']);
  for (const a of AXES) {
    const def = DEFAULT_PIDS[a];
    const base = num(sets[`d_${a}`], scheme === 'dmax' ? def.dmin : def.dmax);
    const other = scheme === 'dmax' ? num(sets[`d_max_${a}`], def.dmax) : num(sets[`d_min_${a}`], def.dmin);
    p.pids[a] = {
      p: num(sets[`p_${a}`], def.p),
      i: num(sets[`i_${a}`], def.i),
      dmax: scheme === 'dmax' ? other : base,
      dmin: scheme === 'dmax' ? base : other,
      f: num(sets[`f_${a}`], def.f),
    };
    ['p_', 'i_', 'd_', 'f_', 'd_min_', 'd_max_'].forEach((pre) => used.add(pre + a));
  }
  for (const [k, v] of Object.entries(sets)) if (!used.has(k)) p.extra[k] = v;
  return p;
}

export function rateFromSets(sets, i) {
  const r = newRateProfile(sets.rateprofile_name || `Rates ${i + 1}`);
  r.type = (sets.rates_type || 'BETAFLIGHT').toUpperCase();
  if (sets.rates_type === undefined) {
    // diff sans rates_type => valeur par défaut Betaflight (ACTUAL depuis 4.3)
    r.type = DEFAULT_RATES.type;
  }
  const used = new Set(['rateprofile_name', 'rates_type', 'thr_mid', 'thr_expo', 'throttle_limit_type', 'throttle_limit_percent']);
  for (const a of AXES) {
    const d = DEFAULT_RATES.axes[a];
    r.axes[a] = {
      rc_rate: num(sets[`${a}_rc_rate`], d.rc_rate),
      srate: num(sets[`${a}_srate`], d.srate),
      expo: num(sets[`${a}_expo`], d.expo),
    };
    ['_rc_rate', '_srate', '_expo'].forEach((s) => used.add(a + s));
  }
  r.throttle = {
    thr_mid: num(sets.thr_mid, 50),
    thr_expo: num(sets.thr_expo, 0),
    throttle_limit_type: sets.throttle_limit_type || 'OFF',
    throttle_limit_percent: num(sets.throttle_limit_percent, 100),
  };
  for (const [k, v] of Object.entries(sets)) if (!used.has(k)) r.extra[k] = v;
  return r;
}

export function droneFromCli(text) {
  const parsed = parseCli(text);
  const d = newDrone(parsed.craftName || 'Drone importé');
  d.firmware = fwFromVersion(parsed.version);
  const pidIdx = Object.keys(parsed.pid).map(Number).sort((a, b) => a - b);
  const rateIdx = Object.keys(parsed.rate).map(Number).sort((a, b) => a - b);
  if (pidIdx.length) d.pidProfiles = pidIdx.slice(0, 4).map((i) => pidFromSets(parsed.pid[i], i, d.firmware));
  if (rateIdx.length) d.rateProfiles = rateIdx.slice(0, 6).map((i) => rateFromSets(parsed.rate[i], i));
  d.activePid = d.pidProfiles[0].id;
  d.activeRate = d.rateProfiles[0].id;
  d.global = parsed.global;
  return { drone: d, parsed };
}
