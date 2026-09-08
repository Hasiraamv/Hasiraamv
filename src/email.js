// Transactional email via Resend (api.resend.com). Requires the RESEND_API_KEY secret and
// the RESEND_FROM var (a verified sending address on your Resend domain) to be set --
// without them, sends are skipped rather than throwing, so a missing key never breaks
// signup or checkout.

async function send(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    console.warn('Email skipped: RESEND_API_KEY or RESEND_FROM not set.');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: env.RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend send failed:', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

function wrapper(site, bodyHtml) {
  return `<div style="background:#f4f0e8; padding:32px 16px; font-family:Archivo,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#fffcf6; border:1px solid #d6d0c5;">
      <div style="background:#111111; padding:24px 28px;">
        <span style="font-family:Georgia,serif; font-size:20px; letter-spacing:0.28em; color:#f4f0e8;">${site.toUpperCase()}</span>
      </div>
      <div style="padding:28px;">${bodyHtml}</div>
      <div style="padding:18px 28px; border-top:1px solid #d6d0c5; font-size:11.5px; color:#6b6558;">
        ${site} &middot; The Home of Rare
      </div>
    </div>
  </div>`;
}

export async function sendWelcomeEmail(env, { to, name }) {
  const site = env.SITE_NAME || 'Rarehaus';
  const body = `
    <p style="font-size:15px; color:#191817; margin:0 0 14px;">Hi ${name || 'there'},</p>
    <p style="font-size:14px; line-height:1.6; color:#191817; margin:0 0 14px;">
      Your ${site} account is set up. Every offer here is authenticated in-house before it
      ships, and every piece leaves with a numbered certificate you can verify at any time.
    </p>
    <p style="font-size:14px; line-height:1.6; color:#191817; margin:0 0 14px;">
      You can find your order history any time from your account page.
    </p>`;
  return send(env, { to, subject: `Welcome to ${site}`, html: wrapper(site, body) });
}
