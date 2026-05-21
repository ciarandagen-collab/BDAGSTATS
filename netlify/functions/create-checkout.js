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
      client_reference_id: userId,
      metadata: { user_id: userId },
      success_url: successUrl || 'https://coachstats.netlify.app/?checkout=success',
      cancel_url: cancelUrl || 'https://coachstats.netlify.app/?checkout=cancelled',
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
