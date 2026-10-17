import { profileForAI } from './model.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const QUICK_PROMPTS = [
  { label: 'Propwash', text: "J'ai du propwash en sortie de virage serré et sur les dives. Que modifier en priorité ?" },
  { label: 'Oscillations plein gaz', text: "J'ai des oscillations rapides en haut de gaz / en ligne droite à fond." },
  { label: 'Bounce-back', text: "Le drone rebondit (bounce-back) à la fin des flips et rolls." },
  { label: 'Moteurs chauds', text: "Les moteurs reviennent chauds après un pack. Comment ajuster PID et filtres sans perdre en performance ?" },
  { label: 'Rates race', text: "Propose-moi des rates race précises pour circuit technique MultiGP, basées sur mes rates actuels." },
  { label: 'Rates freestyle', text: "Propose-moi des rates freestyle fluides à partir de mes rates actuels." },
  { label: 'Drift / I-term', text: "Le drone dérive dans les virages longs et ne tient pas sa ligne." },
  { label: 'Analyse globale', text: "Analyse mon profil actuel et dis-moi ce qui te paraît incohérent pour ce type de machine." },
];

export function systemPrompt(drone) {
  const ctx = profileForAI(drone);
  return `Tu es un expert du réglage de drones FPV sous Betaflight (PID, filtres, feedforward, rates) et des simulateurs FPV.
Tu réponds en français, de façon directe et technique, comme à un pilote expérimenté.

Contexte du drone et des profils actifs (valeurs en unités CLI Betaflight brutes) :
${JSON.stringify(ctx, null, 2)}

Conventions :
- PIDs : "dmax" = D maximal, "dmin" = D minimal (en 4.3–4.5 : d_axe = dmax et d_min_axe = dmin ; en 2025.12+ : d_axe = dmin et d_max_axe = dmax).
- Rates (unités CLI) : ACTUAL → rc_rate = centre/10, srate = max/10, expo = expo×100. BETAFLIGHT → rc_rate = RC Rate×100, srate = Super Rate×100, expo = Expo×100.
- "extra" contient les autres clés CLI du profil (filtres D-term, TPA, anti-gravity, sliders simplifiés...).

Méthode :
1. Diagnostique d'abord (cause probable, ce qu'il faudrait vérifier dans le Blackbox : gyro vs setpoint, bruit D-term, saturation moteurs, température).
2. Propose des changements progressifs (5 à 15 % par itération), une variable à la fois quand c'est possible.
3. Rappelle les vérifications de sécurité quand c'est pertinent (hélices retirées pour les tests au banc, température moteurs après un vol court).
4. Si l'info manque (taille d'hélices, poids, RPM filter actif...), dis-le et propose quand même une base prudente.

Si tu proposes des valeurs concrètes, termine OBLIGATOIREMENT ta réponse par un seul bloc \`\`\`json contenant uniquement les champs modifiés, au format :
{
  "summary": "phrase courte décrivant le changement",
  "pid": { "roll": { "p": 50, "i": 85, "dmax": 42, "dmin": 32, "f": 120 }, "pitch": {...}, "yaw": {...} },
  "pidExtra": { "tpa_rate": 65 },
  "rates": { "type": "ACTUAL", "roll": { "rc_rate": 7, "srate": 70, "expo": 50 }, "pitch": {...}, "yaw": {...} },
  "throttle": { "thr_mid": 50, "thr_expo": 0 }
}
N'inclus que les clés que tu modifies. Valeurs entières en unités CLI.`;
}

export async function askAssistant(settings, drone, history) {
  const body = {
    model: settings.model || DEFAULT_MODEL,
    max_tokens: 3000,
    system: systemPrompt(drone),
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  };
  let url;
  const headers = { 'content-type': 'application/json' };
  if (settings.apiMode === 'proxy') {
    if (!settings.proxyUrl) throw new Error('URL du proxy manquante (onglet Réglages).');
    url = settings.proxyUrl;
    if (settings.proxyToken) {
      headers.authorization = `Bearer ${settings.proxyToken}`;
      headers['x-access-token'] = settings.proxyToken;
    }
  } else {
    if (!settings.apiKey) throw new Error('Clé API Anthropic manquante (onglet Réglages).');
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = settings.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try {
      const j = await r.json();
      msg = j.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  const data = await r.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

export function extractProposal(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export const stripJson = (text) => text.replace(/```json[\s\S]*?```/g, '').trim();
