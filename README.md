# Andika Journals Demo

A simple static multi-page demo for Andika Journals, built with HTML, CSS, and vanilla JavaScript.

## Preview

Open `index.html` in a browser.

## Pages

- `index.html` - homepage
- `shop.html` - product collection and add-to-cart actions
- `wise-man-journal.html` - dedicated men's journal product and founder story
- `cart.html` - persistent cart with manual and Paystack test checkout workflows
- `api/paystack/` - Vercel functions for server-side Paystack initialization and verification
- `learn.html` - long-form "5 reasons to journal" page
- `styles.css` - shared styling
- `script.js` - mobile menu, persistent cart, checkout, and order behavior

## Checkout Flow

Products are stored in `localStorage`, so the cart persists across pages and browser refreshes. Checkout supports manual M-Pesa and bank transfer instructions, plus Paystack test payments. Paystack totals are recalculated from the server-side product catalogue before payment initialization.

## Formspree

The site uses the Formspree endpoint `https://formspree.io/f/xzdlpddv` for order notifications and newsletter signups. Formspree acts as the form backend for this static Vercel site: it receives submissions, stores them in the Formspree dashboard, and can send email notifications.

Formspree does not process payments. It sends the order notification before Paystack checkout, while Paystack handles the online transaction separately.

## Paystack test environment

Add the following variables to the Vercel project and redeploy:

- `paystack_dev_secret_key` - Paystack test secret key; server-side only
- `paystack_dev_public` - optional for this redirect-based integration
- `PAYSTACK_SPLIT_CODE` - optional override for the configured test split

The included split code is the current test fallback. Set `PAYSTACK_SPLIT_CODE` in Vercel when the split changes. Never place the secret key in HTML, `script.js`, or Git.

Order submissions include the customer details, delivery location, payment method, generated order reference, order total, and the complete cart as JSON. Newsletter submissions are labelled separately using the `submission_type` field.

## Before Going Live

Replace these placeholders before launch:

- M-Pesa paybill and bank account details
- Product prices
- Founder and product images
- `hello@andikajournals.com`

## Deploying To Vercel

1. Push this folder to GitHub.
2. Import the GitHub repo into Vercel.
3. Use framework preset `Other`.
4. Leave the build command empty.
5. Leave the output directory as the project root.
6. Deploy.
