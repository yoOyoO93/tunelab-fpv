import { rateAt, fitRates, stats } from '../src/lib/rates.js';
import { exportCli, droneFromCli } from '../src/lib/cli.js';
import { newDrone } from '../src/lib/model.js';
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
process.exit(fail ? 1 : 0);
