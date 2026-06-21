function send(response, status, body) {
  response.status(status).json(body);
}

function getSecretKey() {
  return process.env.paystack_dev_secret_key || process.env.PAYSTACK_DEV_SECRET_KEY;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed." });
  }

  const secretKey = getSecretKey();
  const reference = String(request.query.reference || "");
  if (!secretKey) return send(response, 500, { error: "Paystack is not configured on this deployment." });
  if (!/^[A-Za-z0-9._=-]{5,100}$/.test(reference)) {
    return send(response, 400, { error: "Invalid payment reference." });
  }

  try {
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const paystack = await paystackResponse.json().catch(() => ({}));
    const transaction = paystack.data;

    if (!paystackResponse.ok || !paystack.status || !transaction) {
      return send(response, 502, { error: paystack.message || "Payment verification failed." });
    }

    if (transaction.status !== "success" || transaction.currency !== "KES") {
      return send(response, 200, {
        paid: false,
        reference: transaction.reference,
        error: "Payment has not been completed."
      });
    }

    return send(response, 200, {
      paid: true,
      reference: transaction.reference,
      total: transaction.amount / 100
    });
  } catch (error) {
    return send(response, 502, { error: "Unable to reach Paystack for verification." });
  }
};
