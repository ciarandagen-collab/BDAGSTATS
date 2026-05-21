// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session and returns the redirect URL.
//
// Environment variables to set in Netlify dashboard:
//   STRIPE_SECRET_KEY       — your Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_MONTHLY_PRICE_ID — Stripe Price ID for £5/month plan
//   STRIPE_ANNUAL_PRICE_ID  — Stripe Price ID for £50/year plan

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { priceId, userId, email, successUrl, cancelUrl } = body;

  if (!priceId || !userId || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Validate price ID is one of our expected ones
  const validPrices = [
    process.env.STRIPE_MONTHLY_PRICE_ID,
    process.env.STRIPE_ANNUAL_PRICE_ID
  ];
  if (!validPrices.includes(priceId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid price ID' }) };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,   // used by webhook to link back to Supabase user
      metadata: { user_id: userId },
      success_url: successUrl || 'https://ciarandagen-collab.github.io/BDAGSTATS/?checkout=success',
      cancel_url: cancelUrl  || 'https://ciarandagen-collab.github.io/BDAGSTATS/?checkout=cancelled',
      subscription_data: {
        metadata: { user_id: userId }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      currency: 'gbp',
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: session.url })
    };
  } catch(err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
