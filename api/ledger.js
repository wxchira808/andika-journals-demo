/**
 * GET /api/ledger
 *
 * Password-gated endpoint that returns all orders stored in Vercel KV.
 * Protected by a secret access key — pass it as ?key=YOUR_KEY
 *
 * Required environment variables:
 *   LEDGER_ACCESS_KEY  — a secret string you choose (e.g. a random UUID)
 *   KV_REST_API_URL    — auto-added by Vercel KV
 *   KV_REST_API_TOKEN  — auto-added by Vercel KV
 *
 * Example usage:
 *   GET /api/ledger?key=my-secret-key
 */

function send(response, status, body) {
  response.status(status).json(body);
}

async function kvGet(url, token, key) {
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvZRange(url, token, key, start = 0, stop = -1) {
  // ZRANGE with WITHSCORES=false — returns members in ascending score order
  const res = await fetch(`${url}/zrange/${encodeURIComponent(key)}/${start}/${stop}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return Array.isArray(data.result) ? data.result : [];
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed." });
  }

  const accessKey = process.env.LEDGER_ACCESS_KEY;
  if (!accessKey) {
    return send(response, 500, { error: "Ledger is not configured." });
  }

  const providedKey = String(request.query.key || "");
  if (!providedKey || providedKey !== accessKey) {
    return send(response, 401, { error: "Unauthorized." });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return send(response, 503, { error: "Vercel KV is not connected. Add a KV store to your project." });
  }

  try {
    // Get all order references in chronological order
    const references = await kvZRange(kvUrl, kvToken, "orders:all");

    // Fetch all orders in parallel
    const orders = await Promise.all(
      references.map((ref) => kvGet(kvUrl, kvToken, `order:${ref}`))
    );

    const validOrders = orders.filter(Boolean).reverse(); // newest first

    // Calculate totals
    const totalSales = validOrders.reduce((sum, o) => sum + (o.amountKES || 0), 0);
    const totalClientShare = validOrders.reduce((sum, o) => sum + (o.clientShareKES || 0), 0);
    const totalYourCut = validOrders.reduce((sum, o) => sum + (o.yourCutKES || 0), 0);

    return send(response, 200, {
      summary: {
        orderCount: validOrders.length,
        totalSalesKES: parseFloat(totalSales.toFixed(2)),
        clientShareKES: parseFloat(totalClientShare.toFixed(2)),
        yourCutKES: parseFloat(totalYourCut.toFixed(2))
      },
      orders: validOrders
    });
  } catch (error) {
    console.error("Ledger fetch error:", error);
    return send(response, 500, { error: "Failed to fetch orders." });
  }
};
