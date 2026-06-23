/**
 * POST /api/order
 *
 * Handles checkout form submissions for M-Pesa and bank transfer orders.
 * Paystack orders get their confirmation from the webhook (/api/paystack/webhook).
 *
 * Sends an order notification email to the business owner.
 * Does NOT send a customer receipt here — that comes from the webhook for Paystack
 * orders, and is out of scope for manual payment orders (they're handled via WhatsApp).
 *
 * Body (JSON or FormData):
 *   name, phone, email, delivery_location, delivery_notes,
 *   payment_method, order_reference, order_total, cart (JSON string)
 */

const { sendEmail } = require("./_email");

function send(response, status, body) {
  response.status(status).json(body);
}

function formatCartHtml(cart) {
  try {
    const items = typeof cart === "string" ? JSON.parse(cart) : cart;
    if (!Array.isArray(items)) return "<em>No item details</em>";
    return items
      .map((item) => `<li>${item.quantity}× ${item.name} — KES ${(item.price * item.quantity).toLocaleString()}</li>`)
      .join("");
  } catch {
    return "<em>Could not parse cart</em>";
  }
}

function formatCartText(cart) {
  try {
    const items = typeof cart === "string" ? JSON.parse(cart) : cart;
    if (!Array.isArray(items)) return "No item details";
    return items
      .map((item) => `  - ${item.quantity}x ${item.name}: KES ${(item.price * item.quantity).toLocaleString()}`)
      .join("\n");
  } catch {
    return "Could not parse cart";
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed." });
  }

  const ownerEmail = process.env.orders_email_owner;
  if (!ownerEmail) {
    return send(response, 500, { error: "Order notification email is not configured." });
  }

  // Support both JSON and FormData submissions
  const body = request.body || {};
  const name = String(body.name || "").slice(0, 120);
  const phone = String(body.phone || "").slice(0, 40);
  const email = String(body.email || "").slice(0, 120);
  const deliveryLocation = String(body.delivery_location || "").slice(0, 180);
  const deliveryNotes = String(body.delivery_notes || "").slice(0, 500);
  const paymentMethod = String(body.payment_method || "").slice(0, 40);
  const orderReference = String(body.order_reference || "").slice(0, 50);
  const orderTotal = String(body.order_total || "").slice(0, 30);
  const cart = body.cart || [];

  if (!name || !email || !phone) {
    return send(response, 400, { error: "Name, email, and phone are required." });
  }

  try {
    const subject = `🛍️ New Andika Order — ${orderTotal} | Ref: ${orderReference}`;

    const html = `
      <h2 style="color:#1a1a1a">New Order — Andika Journals</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;font-size:15px">
        <tr><td style="padding:8px 0;color:#666;width:160px">Customer</td><td style="padding:8px 0"><strong>${name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0">${email}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0">${phone}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Delivery</td><td style="padding:8px 0">${deliveryLocation}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Delivery notes</td><td style="padding:8px 0">${deliveryNotes || "—"}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Payment method</td><td style="padding:8px 0">${paymentMethod}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Reference</td><td style="padding:8px 0"><strong>${orderReference}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#666">Total</td><td style="padding:8px 0"><strong>${orderTotal}</strong></td></tr>
      </table>
      <h3 style="color:#1a1a1a;margin-top:24px">Items ordered</h3>
      <ul style="font-family:sans-serif;font-size:15px;padding-left:18px">
        ${formatCartHtml(cart)}
      </ul>
    `;

    const text = `
New Andika Journals Order

Customer:         ${name}
Email:            ${email}
Phone:            ${phone}
Delivery:         ${deliveryLocation}
Delivery notes:   ${deliveryNotes || "—"}
Payment method:   ${paymentMethod}
Reference:        ${orderReference}
Total:            ${orderTotal}

Items:
${formatCartText(cart)}
    `.trim();

    await sendEmail({ to: ownerEmail, subject, html, text });
    return send(response, 200, { ok: true });
  } catch (error) {
    console.error("Order notification failed:", error);
    return send(response, 500, { error: "Failed to send order notification." });
  }
};
