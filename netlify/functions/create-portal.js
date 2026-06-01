const Stripe = require('stripe');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { userId } = body;
  if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing userId' }) };

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    // Get customer ID from subscriptions table
    const res = await fetch(SUPA_URL + '/rest/v1/subscriptions?user_id=eq.' + userId + '&select=stripe_customer_id', {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY
      }
    });
    const subs = await res.json();

    if (!subs || !subs.length || !subs[0].stripe_customer_id) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'No subscription found' })
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subs[0].stripe_customer_id,
      return_url: 'https://coachstats.app',
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch(err) {
    console.error('Portal error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
