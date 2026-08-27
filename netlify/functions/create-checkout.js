const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { priceId, userId, email, successUrl, cancelUrl } = body;

  if (!priceId || !userId || !email) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      metadata: { user_id: userId },
      success_url: successUrl || 'https://coachstats.netlify.app/?checkout=success',
      cancel_url: cancelUrl || 'https://coachstats.netlify.app/?checkout=cancelled',
      subscription_data: {
        metadata: { user_id: userId }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // currency intentionally NOT set here — it was previously hardcoded
      // to 'gbp', which conflicts with any EUR (or other-currency) price
      // passed in via priceId. A Checkout Session's currency is already
      // fully determined by the Price object referenced in line_items, so
      // this doesn't need to be — and must not be — specified separately.
    });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch(err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
