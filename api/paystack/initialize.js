const PRODUCTS = {
  "wise-man-journal": { name: "The Wise Man Journal", price: 1500 },
  "womens-journal": { name: "Women's Journal", price: 1500 },
  "kids-journal": { name: "Kids Journal", price: 1200 },
  notebook: { name: "Andika Notebook", price: 900 }
};

const TEST_SPLIT_CODE = "SPL_x1JAhQ9UUF";

function send(response, status, body) {
  response.status(status).json(body);
}

function getSecretKey() {
  return process.env.paystack_dev_secret_key || process.env.PAYSTACK_DEV_SECRET_KEY;
}

function priceCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 20) {
    throw new Error("Your cart is empty or invalid.");
  }

  let total = 0;
  const items = cart.map((item) => {
    const product = PRODUCTS[item.id];
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("One or more cart items are invalid.");
    }
    total += product.price * quantity;
    return { id: item.id, name: product.name, price: product.price, quantity };
  });

  return { items, total };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed." });
  }

  const secretKey = getSecretKey();
  if (!secretKey) {
    return send(response, 500, { error: "Paystack is not configured on this deployment." });
  }

  try {
    const { email, customer = {}, cart } = request.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return send(response, 400, { error: "A valid email address is required." });
    }

    const { items, total } = priceCart(cart);
    const origin = `https://${request.headers["x-forwarded-host"] || request.headers.host}`;
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        amount: total * 100,
        currency: "KES",
        split_code: process.env.PAYSTACK_SPLIT_CODE || TEST_SPLIT_CODE,
        callback_url: `${origin}/cart.html?paystack=callback`,
        metadata: {
          customer_name: String(customer.name || "").slice(0, 120),
          phone: String(customer.phone || "").slice(0, 40),
          delivery_location: String(customer.deliveryLocation || "").slice(0, 180),
          delivery_notes: String(customer.deliveryNotes || "").slice(0, 500),
          items
        }
      })
    });
    const paystack = await paystackResponse.json().catch(() => ({}));

    if (!paystackResponse.ok || !paystack.status || !paystack.data?.authorization_url) {
      return send(response, 502, { error: paystack.message || "Paystack could not initialize the payment." });
    }

    return send(response, 200, {
      authorizationUrl: paystack.data.authorization_url,
      reference: paystack.data.reference,
      total
    });
  } catch (error) {
    return send(response, 400, { error: error.message || "Unable to initialize payment." });
  }
};
