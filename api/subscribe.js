/**
 * POST /api/subscribe
 *
 * Handles newsletter signups.
 * Stores the email in Vercel KV and sends a welcome email to the subscriber.
 *
 * Body (JSON):
 *   email — subscriber's email address
 *
 * Required environment variables:
 *   KV_REST_API_URL   — auto-added by Vercel when you connect a KV store
 *   KV_REST_API_TOKEN — auto-added by Vercel when you connect a KV store
 *   orders_email_*    — see api/_email.js
 */

const { sendEmail } = require("./_email");

function send(response, status, body) {
  response.status(status).json(body);
}

async function storeSubscriber(email) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    // KV not connected yet — skip storage silently (don't break the signup flow)
    console.warn("Vercel KV not configured. Subscriber not stored:", email);
    return;
  }

  const key = `subscriber:${email.toLowerCase()}`;
  const value = JSON.stringify({ email, subscribedAt: new Date().toISOString() });

  // Use Vercel KV REST API to SET key (only if not already existing — NX flag)
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?nx`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  // Also add to a sorted set so we can list all subscribers later
  const score = Date.now();
  await fetch(`${url}/zadd/subscribers/${score}/${encodeURIComponent(email.toLowerCase())}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed." });
  }

  const body = request.body || {};
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return send(response, 400, { error: "A valid email address is required." });
  }

  try {
    await storeSubscriber(email);

    // Send welcome email to subscriber
    const welcomeHtml = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin-bottom:8px">Welcome to Andika Journals 📓</h2>
        <p style="color:#444;line-height:1.6">
          You're on the list! We'll be in touch with collection drops,
          founder notes, and early order windows.
        </p>
        <p style="color:#444;line-height:1.6">
          In the meantime, browse our current collection at
          <a href="https://andikajournals.com/shop.html" style="color:#1a1a1a">andikajournals.com</a>.
        </p>
        <p style="color:#888;font-size:13px;margin-top:32px">
          You received this because you signed up at andikajournals.com.
        </p>
      </div>
    `;

    const welcomeText = `
Welcome to Andika Journals!

You're on the list. We'll be in touch with collection drops, founder notes, and early order windows.

Browse our collection at andikajournals.com/shop.html
    `.trim();

    await sendEmail({
      to: email,
      subject: "Welcome to Andika Journals 📓",
      html: welcomeHtml,
      text: welcomeText
    });

    return send(response, 200, { ok: true });
  } catch (error) {
    console.error("Subscribe failed:", error);
    return send(response, 500, { error: "Failed to process your subscription." });
  }
};
