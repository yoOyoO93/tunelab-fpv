import { rateAt, fitRates, stats } from '../src/lib/rates.js';
import { exportCli, droneFromCli } from '../src/lib/cli.js';
import { newDrone, normalizeState } from '../src/lib/model.js';
import { extractProposal } from '../src/lib/ai.js';
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
// Valeurs connues du Configurator
ok(Math.round(rateAt('BETAFLIGHT', 1, { rc_rate: 100, srate: 70, expo: 0 })) === 667, 'BF 1.00/0.70 -> 667°/s');
ok(Math.round(rateAt('ACTUAL', 1, { rc_rate: 7, srate: 67, expo: 54 })) === 670, 'Actual 70/670 -> 670°/s');
ok(Math.round(rateAt('KISS', 1, { rc_rate: 100, srate: 70, expo: 0 })) === 667, 'KISS 1.00/0.70 -> 667°/s');
ok(Math.round(rateAt('QUICK', 1, { rc_rate: 100, srate: 67, expo: 0 })) === 670, 'Quick 200/670 -> 670°/s');
console.log('stats actual', stats('ACTUAL', { rc_rate: 7, srate: 67, expo: 54 }));
for (const t of ['BETAFLIGHT', 'KISS', 'QUICK', 'RACEFLIGHT']) {
  const f = fitRates('ACTUAL', { rc_rate: 7, srate: 67, expo: 54 }, t);
  console.log(t, f.params, 'rmse', f.rmse.toFixed(1));
  ok(f.rmse < 25, `conversion Actual -> ${t} (rmse ${f.rmse.toFixed(1)})`);
}
const back = fitRates('ACTUAL', { rc_rate: 7, srate: 67, expo: 54 }, 'ACTUAL');
ok(back.rmse < 0.01, 'Actual -> Actual identique');
// Aller-retour CLI
for (const fw of ['4.5', '2025.12']) {
  const d = newDrone('TEST'); d.firmware = fw;
  d.pidProfiles[0].pids.roll = { p: 52, i: 90, dmax: 44, dmin: 33, f: 140 };
  d.pidProfiles[0].extra = { tpa_rate: 65 };
  d.rateProfiles[0].axes.yaw = { rc_rate: 12, srate: 50, expo: 20 };
  const txt = exportCli(d, { scope: 'all' }).replace('# TuneLab', '# Betaflight / STM32H743 (SH74) ' + (fw === '4.5' ? '4.5.1' : '2025.12.0') + ' x\n# TuneLab');
  const { drone } = droneFromCli(txt + '\nset craft_name = TEST');
  ok(JSON.stringify(drone.pidProfiles[0].pids.roll) === JSON.stringify(d.pidProfiles[0].pids.roll), `CLI PID aller-retour ${fw}`);
  ok(drone.pidProfiles[0].extra.tpa_rate === '65', `CLI extra ${fw}`);
  ok(JSON.stringify(drone.rateProfiles[0].axes.yaw) === JSON.stringify(d.rateProfiles[0].axes.yaw), `CLI rates aller-retour ${fw}`);
  ok(drone.firmware === fw, `détection firmware ${fw}`);
}

// Import d'un vrai `diff all` : valeurs absentes = défauts firmware, profil actif = lignes finales
{
  const diff = `# diff all
# version
# Betaflight / STM32F7X2 (S7X2) 4.5.1 Jul 27 2024 / 07:50:26 (77d01ba3b) MSP API: 1.46
set craft_name = RACER
set dyn_notch_count = 1
set evil key = 1
profile 0

# profile 0
set p_roll = 50
profile 1

# profile 1
set p_roll = 60
# restore original profile selection
profile 1

rateprofile 0

# rateprofile 0
set roll_rc_rate = 10
set roll_srate = 80
rateprofile 1
set roll_srate = 90

# restore original rateprofile selection
rateprofile 1

save`;
  const { drone } = droneFromCli(diff);
  ok(drone.name === 'RACER' && drone.pidProfiles.length === 2 && drone.rateProfiles.length === 2, 'diff all : 2 profils PID, 2 rates');
  ok(drone.rateProfiles[0].axes.roll.expo === 0 && drone.rateProfiles[0].axes.pitch.rc_rate === 7, 'diff all : clés absentes = défauts Betaflight (expo 0)');
  ok(drone.activePid === drone.pidProfiles[1].id && drone.activeRate === drone.rateProfiles[1].id, 'diff all : profil actif repris du FC');
  ok(drone.pidProfiles[0].pids.roll.dmax === 40 && drone.pidProfiles[0].pids.roll.dmin === 30, 'diff all : D par défaut');
  ok(Object.keys(drone.global).join() === 'dyn_notch_count', 'diff all : clé invalide ignorée');
}
// Export : pas d'injection de commande, pas de slot au-delà de 4
{
  const d = newDrone('X');
  d.pidProfiles[0].extra = { tpa_rate: '65\nset motor_pwm_protocol = OFF', 'bad key': '1', ok_key: '3 # x' };
  const txt = exportCli(d, { scope: 'all' });
  ok(!txt.includes('motor_pwm_protocol') && /^set tpa_rate = 65$/m.test(txt) && !txt.includes('bad key') && /^set ok_key = 3$/m.test(txt), 'export : clés et valeurs assainies');
  ok(txt.split('\n').filter((l) => /^(set|profile|rateprofile|save|#|$)/.test(l)).length === txt.split('\n').length, 'export : uniquement des lignes CLI attendues');
  for (let i = 0; i < 5; i++) d.rateProfiles.push({ ...structuredClone(d.rateProfiles[0]), id: 'r' + i, name: 'R' + i });
  d.activeRate = 'r4';
  const t2 = exportCli(d, { scope: 'all' });
  ok(!/^rateprofile [4-9]$/m.test(t2) && t2.includes('NON EXPORTÉ'), 'export : rien au-delà du slot 4');
}
// Données abîmées ou anciennes : réparées, jamais de plantage
{
  ok(normalizeState(null) === null && normalizeState({ drones: [] }) === null, 'normalize : vide -> null');
  const n = normalizeState({ drones: [{ name: 'A', pidProfiles: [{ id: 'p', pids: { roll: { p: 'abc', i: 999 } } }], rateProfiles: [{ id: 'p', type: 'NOPE' }], activePid: 'p' }, { id: 'same' }, { id: 'same' }] });
  const a = n.drones[0];
  ok(a.pidProfiles[0].pids.roll.p === 45 && a.pidProfiles[0].pids.roll.i === 255 && a.pidProfiles[0].pids.yaw.f === 120, 'normalize : valeurs PID complétées et bornées');
  ok(a.rateProfiles[0].type === 'ACTUAL' && Array.isArray(a.chat) && Array.isArray(a.rateProfiles[0].history), 'normalize : champs manquants complétés');
  ok(a.activePid === a.pidProfiles[0].id && a.activeRate === a.rateProfiles[0].id && a.pidProfiles[0].id !== a.rateProfiles[0].id, 'normalize : profils actifs valides, ids uniques');
  ok(n.drones[1].id !== n.drones[2].id, 'normalize : drones en double différenciés');
  const d = newDrone('B');
  ok(JSON.stringify(normalizeState({ version: 1, drones: [d] }).drones[0]) === JSON.stringify(d), 'normalize : données saines inchangées');
}
// Réponses IA
{
  const f = (o) => '```json\n' + JSON.stringify(o) + '\n```';
  ok(extractProposal(f([1, 2])) === null && extractProposal(f('x')) === null && extractProposal(f({ summary: 'rien' })) === null, 'IA : formes inattendues rejetées');
  const p = extractProposal(f({ pid: { roll: { p: 50 }, pitch: 'oops' }, rates: { type: 'actual', yaw: { expo: 10 } }, throttle: [] }));
  ok(p.pid.roll.p === 50 && !p.pid.pitch && p.rates.type === 'ACTUAL' && p.rates.yaw.expo === 10 && !p.throttle, 'IA : proposition nettoyée');
}
process.exit(fail ? 1 : 0);
