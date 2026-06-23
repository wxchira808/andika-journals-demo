/**
 * POST /api/paystack/webhook
 *
 * Receives charge.success events from Paystack and:
 *   1. Verifies the HMAC signature (security — rejects anything not from Paystack)
 *   2. Stores the order in Vercel KV
 *   3. Sends an owner notification email
 *   4. Sends a customer receipt email
 *
 * Set this URL in your Paystack dashboard under:
 *   Settings → API Keys & Webhooks → Webhook URL
 *   → https://your-domain.vercel.app/api/paystack/webhook
 *
 * Required environment variables:
 *   paystack_dev_secret_key   — used to verify the webhook signature in test mode
 *   paystack_live_secret_key  — used in production
 *   orders_email_owner        — business owner's email for order alerts
 *   orders_email_*            — see api/_email.js
 *   KV_REST_API_URL           — auto-added by Vercel KV
 *   KV_REST_API_TOKEN         — auto-added by Vercel KV
 */

const crypto = require("crypto");
const { sendEmail } = require("../_email");

// Vercel serverless functions parse the body automatically, but we need
// the raw body buffer to verify the Paystack HMAC signature.
// Disable the default body parser for this route.
module.exports.config = {
  api: { bodyParser: false }
};

function send(response, status, body) {
  response.status(status).json(body);
}

function getSecretKey() {
  return (
    process.env.paystack_live_secret_key ||
    process.env.PAYSTACK_LIVE_SECRET_KEY ||
    process.env.paystack_dev_secret_key ||
    process.env.PAYSTACK_DEV_SECRET_KEY
  );
}

async function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function verifySignature(rawBody, signature, secretKey) {
  const expected = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

async function storeOrder(order) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn("Vercel KV not configured. Order not stored:", order.reference);
    return;
  }

  const key = `order:${order.reference}`;
  const value = JSON.stringify(order);

  // Store the full order object
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  // Add to ordered list of all orders (sorted by timestamp)
  await fetch(`${url}/zadd/orders:all/${order.paidAt}/${encodeURIComponent(order.reference)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

function formatItemsHtml(items) {
  if (!Array.isArray(items) || items.length === 0) return "<em>No item details</em>";
  return items
    .map((item) => `<li>${item.quantity}× ${item.name} — KES ${(item.price * item.quantity).toLocaleString()}</li>`)
    .join("");
}

function formatItemsText(items) {
  if (!Array.isArray(items) || items.length === 0) return "No item details";
  return items
    .map((item) => `  - ${item.quantity}x ${item.name}: KES ${(item.price * item.quantity).toLocaleString()}`)
    .join("\n");
}

async function sendOwnerEmail(order, ownerEmail) {
  const subject = `🛍️ Paid Order — KES ${order.amountKES.toLocaleString()} | Ref: ${order.reference}`;
  const clientShare = (order.amountKES * 0.98).toLocaleString();

  const html = `
    <h2 style="color:#1a1a1a">New Paid Order — Andika Journals</h2>
    <p style="font-family:sans-serif;color:#28a745;font-weight:bold">Payment confirmed via Paystack ✓</p>
    <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;font-size:15px">
      <tr><td style="padding:8px 0;color:#666;width:160px">Customer</td><td style="padding:8px 0"><strong>${order.customerName || "—"}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0">${order.customerEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0">${order.phone || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Delivery</td><td style="padding:8px 0">${order.deliveryLocation || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Delivery notes</td><td style="padding:8px 0">${order.deliveryNotes || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Reference</td><td style="padding:8px 0"><strong>${order.reference}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666">Total paid</td><td style="padding:8px 0"><strong>KES ${order.amountKES.toLocaleString()}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#666">Your share (98%)</td><td style="padding:8px 0"><strong style="color:#28a745">KES ${clientShare}</strong></td></tr>
    </table>
    <h3 style="color:#1a1a1a;margin-top:24px">Items</h3>
    <ul style="font-family:sans-serif;font-size:15px;padding-left:18px">
      ${formatItemsHtml(order.items)}
    </ul>
    <p style="font-family:sans-serif;font-size:13px;color:#888;margin-top:24px">
      Paystack will settle your subaccount share within 2 business days.
    </p>
  `;

  const text = `
New Paid Order — Andika Journals
Payment confirmed via Paystack ✓

Customer:         ${order.customerName || "—"}
Email:            ${order.customerEmail}
Phone:            ${order.phone || "—"}
Delivery:         ${order.deliveryLocation || "—"}
Delivery notes:   ${order.deliveryNotes || "—"}
Reference:        ${order.reference}
Total paid:       KES ${order.amountKES.toLocaleString()}
Your share (98%): KES ${clientShare}

Items:
${formatItemsText(order.items)}

Paystack will settle your share within 2 business days.
  `.trim();

  await sendEmail({ to: ownerEmail, subject, html, text });
}

async function sendCustomerReceipt(order) {
  if (!order.customerEmail) return;

  const subject = `Your Andika Journals order is confirmed 🎉`;
  const name = order.customerName || "there";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin-bottom:4px">Thank you for your order, ${name}! 🎉</h2>
      <p style="color:#444;line-height:1.6">
        We've received your payment of <strong>KES ${order.amountKES.toLocaleString()}</strong>
        and your order is being prepared.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:15px;margin:24px 0">
        <tr><td style="padding:6px 0;color:#666;width:160px">Order reference</td><td style="padding:6px 0"><strong>${order.reference}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Delivery to</td><td style="padding:6px 0">${order.deliveryLocation || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Total paid</td><td style="padding:6px 0"><strong>KES ${order.amountKES.toLocaleString()}</strong></td></tr>
      </table>
      <h3 style="font-size:15px;margin-bottom:8px">Items</h3>
      <ul style="font-size:15px;padding-left:18px;color:#444">
        ${formatItemsHtml(order.items)}
      </ul>
      <p style="color:#444;line-height:1.6;margin-top:24px">
        We'll be in touch soon to confirm your delivery details. If you have any questions,
        reply to this email or message us on
        <a href="https://wa.me/254720633009" style="color:#1a1a1a">WhatsApp</a>.
      </p>
      <p style="color:#888;font-size:13px;margin-top:32px">
        Andika Journals · hello@andikajournals.com
      </p>
    </div>
  `;

  const text = `
Hi ${name},

Thank you for your order! We've received your payment of KES ${order.amountKES.toLocaleString()}.

Order reference: ${order.reference}
Delivery to:     ${order.deliveryLocation || "—"}
Total paid:      KES ${order.amountKES.toLocaleString()}

Items:
${formatItemsText(order.items)}

We'll be in touch soon to confirm your delivery details.
You can also reach us on WhatsApp: https://wa.me/254720633009

— The Andika Journals Team
  `.trim();

  await sendEmail({ to: order.customerEmail, subject, html, text });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed." });
  }

  const secretKey = getSecretKey();
  if (!secretKey) {
    return send(response, 500, { error: "Paystack is not configured." });
  }

  // Read raw body for HMAC verification
  const rawBody = await readRawBody(request);
  const signature = request.headers["x-paystack-signature"];

  if (!signature || !verifySignature(rawBody, signature, secretKey)) {
    console.warn("Webhook: invalid signature");
    return send(response, 401, { error: "Invalid signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return send(response, 400, { error: "Invalid JSON." });
  }

  // Only handle successful charges
  if (event.event !== "charge.success") {
    return send(response, 200, { ok: true, skipped: true });
  }

  const data = event.data || {};
  if (data.status !== "success") {
    return send(response, 200, { ok: true, skipped: true });
  }

  // Parse the transaction
  const amountKES = (data.amount || 0) / 100;
  const meta = data.metadata || {};
  const items = Array.isArray(meta.items) ? meta.items : [];

  const order = {
    reference: data.reference,
    paidAt: data.paid_at || new Date().toISOString(),
    amountKES,
    clientShareKES: parseFloat((amountKES * 0.98).toFixed(2)),
    yourCutKES: parseFloat((amountKES * 0.02).toFixed(2)),
    customerEmail: data.customer?.email || "",
    customerName: String(meta.customer_name || "").slice(0, 120),
    phone: String(meta.phone || "").slice(0, 40),
    deliveryLocation: String(meta.delivery_location || "").slice(0, 180),
    deliveryNotes: String(meta.delivery_notes || "").slice(0, 500),
    items,
    subaccountCode: data.subaccount?.subaccount_code || "",
    currency: data.currency || "KES"
  };

  // Run storage and emails in parallel — respond 200 immediately
  // Paystack requires a 200 response quickly to avoid retries
  response.status(200).json({ ok: true });

  try {
    const ownerEmail = process.env.orders_email_owner;
    await Promise.all([
      storeOrder(order),
      ownerEmail ? sendOwnerEmail(order, ownerEmail) : Promise.resolve(),
      order.customerEmail ? sendCustomerReceipt(order) : Promise.resolve()
    ]);
  } catch (error) {
    // We've already responded 200 — log the error for debugging
    console.error("Webhook post-processing error:", error);
  }
};
