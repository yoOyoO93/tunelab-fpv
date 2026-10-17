// Proxy Cloudflare Worker pour TuneLab FPV
// Garde ta clé API côté serveur : l'app appelle ce Worker, qui relaie vers l'API Anthropic.
//
// Variables (wrangler secret put ...) :
//   ANTHROPIC_API_KEY  (obligatoire)  — ta clé sk-ant-...
//   ACCESS_TOKEN       (recommandé)   — jeton à saisir dans Réglages > Jeton d'accès du proxy
//   ALLOWED_ORIGIN     (recommandé)   — ex : https://tonpseudo.github.io  ou  https://tune.famillegermany.fr

const MAX_TOKENS = 4000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'access-control-allow-origin': allowed === '*' ? '*' : allowed,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization, x-access-token',
      'access-control-max-age': '86400',
      vary: 'origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: { message: 'POST uniquement' } }, 405, cors);
    if (allowed !== '*' && origin !== allowed) return json({ error: { message: 'Origine non autorisée' } }, 403, cors);
    if (env.ACCESS_TOKEN && request.headers.get('authorization') !== `Bearer ${env.ACCESS_TOKEN}`) {
      return json({ error: { message: 'Jeton d\'accès invalide' } }, 401, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: 'JSON invalide' } }, 400, cors);
    }
    // On ne relaie que ce dont l'app a besoin
    const payload = {
      model: body.model,
      max_tokens: Math.min(+body.max_tokens || 2000, MAX_TOKENS),
      system: body.system,
      messages: body.messages,
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};

const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { ...headers, 'content-type': 'application/json' } });
