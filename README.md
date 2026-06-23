# Andika Journals

A multi-page e-commerce site for Andika Journals, built with HTML, CSS, and vanilla JavaScript. Deployed on Vercel with serverless API functions for payments, order notifications, and email.

## Preview

Open `index.html` in a browser, or visit the live deployment.

## Pages

- `index.html` — homepage
- `shop.html` — product collection and add-to-cart
- `wise-man-journal.html` — dedicated men's journal product and founder story
- `cart.html` — persistent cart with M-Pesa, bank transfer, and Paystack checkout
- `learn.html` — long-form "5 reasons to journal" page
- `styles.css` — shared styling
- `script.js` — mobile menu, persistent cart, checkout, and order behaviour

## API Functions (`api/`)

| File | Route | Purpose |
|---|---|---|
| `api/paystack/initialize.js` | `POST /api/paystack/initialize` | Creates a Paystack transaction with split payment |
| `api/paystack/verify.js` | `GET /api/paystack/verify` | Confirms payment status after redirect |
| `api/paystack/webhook.js` | `POST /api/paystack/webhook` | Receives charge.success events; stores orders; sends emails |
| `api/order.js` | `POST /api/order` | Handles M-Pesa / bank transfer order notifications |
| `api/subscribe.js` | `POST /api/subscribe` | Newsletter signups + welcome email |
| `api/ledger.js` | `GET /api/ledger` | Password-gated sales ledger (client dashboard) |
| `api/_email.js` | — | Shared Nodemailer/cPanel SMTP helper |

## Checkout Flow

Products are stored in `localStorage` so the cart persists across pages. Checkout supports:
- **M-Pesa / bank transfer** — form submits to `/api/order`, owner gets an email notification
- **Paystack** — redirect to Paystack, on return `/api/paystack/verify` confirms payment. Paystack's webhook fires separately to `/api/paystack/webhook` which stores the order and sends both the owner alert and the customer receipt email.

## Paystack Split Payments

Every Paystack transaction uses a split code that routes:
- **98%** → client's subaccount (her personal bank account — settled by Paystack in ~2 business days)
- **2%** → main account (platform fee)

Set `PAYSTACK_SPLIT_CODE` in Vercel to override the test split code.

## Email (cPanel SMTP via Nodemailer)

All transactional emails (order alerts, customer receipts, newsletter welcome) are sent via your cPanel SMTP account using Nodemailer. No third-party email service required.

## Vercel Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `paystack_dev_secret_key` | Paystack test secret key | Yes (dev) |
| `paystack_live_secret_key` | Paystack live secret key | Yes (prod) |
| `paystack_live_public_key` | Paystack live public key | Yes (prod) |
| `paystack_dev_public_key` | Paystack dev public key | Optional |
| `PAYSTACK_SPLIT_CODE` | Live split code override | Recommended |
| `orders_email_address` | Sender email (e.g. orders@andikajournals.com) | Yes |
| `orders_email_host` | cPanel SMTP host (e.g. mail.andikajournals.com) | Yes |
| `orders_email_password` | cPanel email password | Yes |
| `orders_email_owner` | Owner's email for order alerts | Yes |
| `LEDGER_ACCESS_KEY` | Secret token for the ledger page | Yes |
| `KV_REST_API_URL` | Auto-added when you connect Vercel KV | Yes |
| `KV_REST_API_TOKEN` | Auto-added when you connect Vercel KV | Yes |

## Paystack Webhook Setup

In your Paystack dashboard → Settings → API Keys & Webhooks, set the webhook URL to:
```
https://your-vercel-domain.vercel.app/api/paystack/webhook
```

Paystack will POST `charge.success` events to this URL after every successful payment.

## Ledger (Client Dashboard)

Open `/ledger.html` on the deployed site. You'll be prompted for the `LEDGER_ACCESS_KEY`. The page shows all paid orders, totals, and the client's 98% earnings share.

## Deploying To Vercel

1. Push this folder to GitHub.
2. Import the GitHub repo into Vercel.
3. Use framework preset `Other`.
4. Leave the build command empty.
5. Leave the output directory as the project root.
6. Add all environment variables listed above.
7. Connect a Vercel KV store to the project (Storage tab in the Vercel dashboard).
8. Deploy.

## Before Going Live

Replace these placeholders before launching:

- M-Pesa paybill and bank account details in `script.js`
- Product prices in `api/paystack/initialize.js`
- Founder and product images
- `hello@andikajournals.com` — update throughout
- Remove "Test mode" label from the Paystack payment option in `cart.html`
