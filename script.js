const CART_KEY = "andikaCart";
const PENDING_PAYMENT_KEY = "andikaPendingPayment";

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCounts(cart);
}

function cartQuantity(cart = readCart()) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function cartTotal(cart = readCart()) {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function formatKES(amount) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(amount);
}

function updateCartCounts(cart = readCart()) {
  const quantity = cartQuantity(cart);
  document.querySelectorAll("[data-cart-count], .bag").forEach((count) => {
    count.textContent = quantity;
  });
}

function addToCart(product) {
  const cart = readCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += product.quantity;
  } else {
    cart.push(product);
  }

  writeCart(cart);
}

function showCartToast(productName) {
  let toast = document.querySelector("[data-cart-toast]");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.setAttribute("data-cart-toast", "");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<strong>${productName}</strong><span>Added to your cart</span><a href="cart.html">View cart</a>`;
  toast.classList.add("show");
  window.clearTimeout(showCartToast.timeout);
  showCartToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 3500);
}

const toggle = document.querySelector("[data-menu-toggle]");
const panel = document.querySelector("[data-mobile-panel]");

if (toggle && panel) {
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const product = {
      id: button.dataset.productId,
      name: button.dataset.productName,
      price: Number(button.dataset.productPrice),
      image: button.dataset.productImage,
      quantity: Number(button.dataset.productQuantity || 1)
    };

    addToCart(product);
    showCartToast(product.name);
    const originalText = button.textContent;
    button.textContent = "Added to Cart";
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1600);
  });
});

const cartItems = document.querySelector("[data-cart-items]");
const cartEmpty = document.querySelector("[data-cart-empty]");
const cartSummary = document.querySelector("[data-cart-summary]");
const checkoutSection = document.querySelector("[data-checkout-section]");

function renderCart() {
  if (!cartItems) return;

  const cart = readCart();
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartEmpty.hidden = false;
    cartSummary.hidden = true;
    checkoutSection.hidden = true;
    return;
  }

  cartEmpty.hidden = true;
  cartSummary.hidden = false;
  checkoutSection.hidden = false;

  cart.forEach((item) => {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.dataset.cartItem = item.id;
    row.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p>${formatKES(item.price)}</p>
        <button class="remove-button" type="button" data-cart-action="remove" aria-label="Remove ${item.name}">Remove</button>
      </div>
      <div class="quantity-control" aria-label="Quantity for ${item.name}">
        <button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button>
      </div>
      <strong class="cart-line-total">${formatKES(item.price * item.quantity)}</strong>
    `;
    cartItems.appendChild(row);
  });

  document.querySelectorAll("[data-cart-subtotal]").forEach((subtotal) => {
    subtotal.textContent = formatKES(cartTotal(cart));
  });
}

if (cartItems) {
  cartItems.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-cart-action]");
    const row = event.target.closest("[data-cart-item]");
    if (!actionButton || !row) return;

    const cart = readCart();
    const index = cart.findIndex((item) => item.id === row.dataset.cartItem);
    if (index === -1) return;

    const action = actionButton.dataset.cartAction;
    if (action === "increase") cart[index].quantity += 1;
    if (action === "decrease") cart[index].quantity -= 1;
    if (action === "remove" || cart[index].quantity <= 0) cart.splice(index, 1);

    writeCart(cart);
    renderCart();
  });
}

const checkoutForm = document.getElementById("checkoutForm");
const checkoutStatus = document.getElementById("checkoutStatus");
const paymentConfirmation = document.getElementById("paymentConfirmation");
const paymentInstructions = document.getElementById("paymentInstructions");

function selectedPaymentMethod() {
  return checkoutForm?.querySelector("[name='payment_method']:checked")?.value || "";
}

function paymentInstructionsFor(method, reference, total) {
  if (method === "mpesa") {
    return `
      <h3>Pay with M-Pesa</h3>
      <p>Use your order reference <strong>${reference}</strong> when making payment.</p>
      <dl class="payment-details">
        <div><dt>Amount</dt><dd>${formatKES(total)}</dd></div>
        <div><dt>Paybill / Till</dt><dd>Details will be added here</dd></div>
        <div><dt>Account number</dt><dd>${reference}</dd></div>
      </dl>
    `;
  }

  return `
    <h3>Pay by bank transfer</h3>
    <p>Use your order reference <strong>${reference}</strong> as the transfer narration.</p>
    <dl class="payment-details">
      <div><dt>Amount</dt><dd>${formatKES(total)}</dd></div>
      <div><dt>Bank and account</dt><dd>Details will be added here</dd></div>
      <div><dt>Reference</dt><dd>${reference}</dd></div>
    </dl>
  `;
}

function setCheckoutBusy(isBusy, message = "Place Order") {
  const submitButton = checkoutForm?.querySelector("[data-checkout-submit]");
  if (!submitButton) return;
  submitButton.disabled = isBusy;
  submitButton.textContent = message;
}

async function submitOrderNotification(formData, endpoint) {
  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
    headers: { Accept: "application/json" }
  });

  if (!response.ok) throw new Error("Order submission failed");
}

async function beginPaystackCheckout(cart, formData, endpoint) {
  checkoutStatus.textContent = "Preparing secure payment...";
  setCheckoutBusy(true, "Preparing Payment...");

  const response = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: formData.get("email"),
      customer: {
        name: formData.get("name"),
        phone: formData.get("phone"),
        deliveryLocation: formData.get("delivery_location"),
        deliveryNotes: formData.get("delivery_notes")
      },
      cart
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.authorizationUrl) {
    throw new Error(result.error || "We couldn’t start the Paystack payment.");
  }

  formData.set("order_reference", result.reference);
  formData.set("order_total", formatKES(result.total));
  formData.set("payment_status", "Awaiting Paystack payment");
  await submitOrderNotification(formData, endpoint);

  localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
    reference: result.reference,
    total: result.total
  }));
  window.location.assign(result.authorizationUrl);
}

async function verifyReturnedPaystackPayment() {
  if (!checkoutForm) return;

  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref");
  if (params.get("paystack") !== "callback" || !reference) return;

  checkoutStatus.textContent = "Confirming your payment...";
  setCheckoutBusy(true, "Confirming Payment...");

  try {
    const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.paid) {
      throw new Error(result.error || "Payment has not been confirmed yet.");
    }

    paymentInstructions.innerHTML = `
      <h3>Payment confirmed</h3>
      <p>Your secure payment of <strong>${formatKES(result.total)}</strong> was received successfully.</p>
      <dl class="payment-details">
        <div><dt>Payment reference</dt><dd>${result.reference}</dd></div>
        <div><dt>Status</dt><dd>Paid</dd></div>
      </dl>
    `;
    paymentConfirmation.querySelector(".eyebrow").textContent = "Payment successful";
    paymentConfirmation.querySelector("h2").textContent = "Thank you for your order.";
    paymentConfirmation.querySelector("h2 + p").textContent = "We’ll contact you shortly to confirm your delivery details.";
    paymentConfirmation.hidden = false;
    checkoutForm.hidden = true;
    checkoutStatus.textContent = "Your payment has been confirmed and your order is being prepared.";
    localStorage.removeItem(PENDING_PAYMENT_KEY);
    writeCart([]);
    window.history.replaceState({}, document.title, `${window.location.pathname}#payment-confirmed`);
    paymentConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    checkoutStatus.textContent = `${error.message} Your cart is still here, so you can try again.`;
    setCheckoutBusy(false);
  }
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cart = readCart();

    if (cart.length === 0) {
      checkoutStatus.textContent = "Your cart is empty.";
      return;
    }

    if (!checkoutForm.checkValidity()) {
      checkoutForm.reportValidity();
      return;
    }

    const method = selectedPaymentMethod();
    const total = cartTotal(cart);
    const reference = `AND-${Date.now().toString().slice(-8)}`;
    const endpoint = checkoutForm.getAttribute("action");
    const formData = new FormData(checkoutForm);
    formData.append("order_reference", reference);
    formData.append("order_total", formatKES(total));
    formData.append("cart", JSON.stringify(cart));
    formData.append("payment_status", method === "paystack" ? "Awaiting Paystack payment" : "Awaiting manual payment");

    checkoutStatus.textContent = "Placing your order...";

    try {
      if (method === "paystack") {
        await beginPaystackCheckout(cart, formData, endpoint);
        return;
      }

      setCheckoutBusy(true, "Placing Order...");
      await submitOrderNotification(formData, endpoint);

      paymentInstructions.innerHTML = paymentInstructionsFor(method, reference, total);
      paymentConfirmation.hidden = false;
      checkoutStatus.textContent = "Your order has been received. Complete the manual payment below and we’ll confirm delivery details shortly.";
      writeCart([]);
      paymentConfirmation.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      checkoutStatus.textContent = error.message || "We couldn’t submit the order. Please check your connection and try again.";
      setCheckoutBusy(false);
    }
  });
}

document.querySelectorAll("[data-formspree-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const feedback = form.parentElement.querySelector("[data-form-feedback]");
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    feedback.textContent = "Subscribing...";
    feedback.className = "form-feedback";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.errors?.map((error) => error.message).join(" ") || "Something went wrong. Please try again.";
        throw new Error(message);
      }

      form.reset();
      feedback.textContent = "You’re on the list. Thank you!";
      feedback.classList.add("success");
    } catch (error) {
      feedback.textContent = error.message || "Something went wrong. Please try again.";
      feedback.classList.add("error");
    } finally {
      submitButton.disabled = false;
    }
  });
});

updateCartCounts();
renderCart();
verifyReturnedPaystackPayment();

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
