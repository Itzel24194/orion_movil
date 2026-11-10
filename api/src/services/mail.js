// src/services/mailer.js
// Envío de correo con Resend (HTTP API). No usa SMTP, no depende de IP.

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function enviar({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.warn('[mail] Falta RESEND_API_KEY en .env — no se envió el correo.');
    return false;
  }

  const from = process.env.MAIL_DEFAULT_SENDER || 'ORION <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: text || (html || '').replace(/<[^>]+>/g, ''),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[mail] ❌ Error de Resend:', data.message || res.statusText);
      return false;
    }

    console.log(`[mail] ✅ Enviado a ${to} · id=${data.id}`);
    return true;
  } catch (e) {
    console.error('[mail] ❌ Error al enviar:', e.message);
    return false;
  }
}

module.exports = { enviar };