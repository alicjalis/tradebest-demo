export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors('', 204);
    if (request.method !== 'POST') return cors('Method not allowed', 405);

    let data;
    try {
      data = await request.json();
    } catch {
      return cors(JSON.stringify({ ok: false, error: 'invalid_json' }), 400);
    }

    const { token, name, contact, message } = data;
    if (!name || !contact || !message) {
      return cors(JSON.stringify({ ok: false, error: 'missing_fields' }), 400);
    }

    // Weryfikacja Turnstile
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
    });
    const result = await verify.json();
    if (!result.success) {
      return cors(JSON.stringify({ ok: false, error: 'captcha_failed' }), 403);
    }

    // Wysyłka e-mail przez Cloudflare Email Routing
    const raw = [
      `From: Formularz TradeBest <formularz@etradebest.com>`,
      `To: tradebest@wp.pl`,
      `Subject: Zapytanie od ${name}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `Imię i firma: ${name}`,
      `Telefon / e-mail: ${contact}`,
      ``,
      `Wiadomość:`,
      message,
    ].join('\r\n');

    const { EmailMessage } = await import('cloudflare:email');
    const msg = new EmailMessage('formularz@etradebest.com', 'tradebest@wp.pl', raw);
    await env.EMAIL.send(msg);

    return cors(JSON.stringify({ ok: true }), 200);
  },
};

function cors(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': 'https://etradebest.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
  });
}
