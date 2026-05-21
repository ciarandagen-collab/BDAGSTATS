const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supaUpdate(userId, patch) {
  const url = SUPA_URL + '/rest/v1/subscriptions?user_id=eq.' + userId;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPA_SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase PATCH failed: ' + text);
  }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch(err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Webhook signature verification failed' };
  }

  const data = stripeEvent.data.object;

  try {
    switch (stripeEvent.type) {

      case 'checkout.session.completed': {
        const session = data;
        if (session.mode !== 'subscription') break;
        const subId = session.subscription;
        const custId = session.customer;
        const uid = session.client_reference_id || (session.metadata && session.metadata.user_id);
        if (!uid) { console.error('No user_id in checkout session'); break; }
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        await supaUpdate(uid, {
          status: 'active',
          stripe_customer_id: custId,
          stripe_subscription_id: subId,
          current_period_end: periodEnd
        });
        console.log('Subscription activated for user:', uid);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = data;
        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update') {
          const subId = invoice.subscription;
          const uid = invoice.metadata && invoice.metadata.user_id;
          if (!uid) break;
          const sub = await stripe.subscriptions.retrieve(subId);
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          await supaUpdate(uid, { status: 'active', current_period_end: periodEnd });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const uid = data.metadata && data.metadata.user_id;
        if (!uid) break;
        await supaUpdate(uid, { status: 'past_due' });
        break;
      }

      case 'customer.subscription.deleted': {
        const uid = data.metadata && data.metadata.user_id;
        if (!uid) break;
        await supaUpdate(uid, {
          status: 'canceled',
          current_period_end: new Date(data.current_period_end * 1000).toISOString()
        });
        break;
      }

      case 'customer.subscription.updated': {
        const uid = data.metadata && data.metadata.user_id;
        if (!uid) break;
        const periodEnd = new Date(data.current_period_end * 1000).toISOString();
        await supaUpdate(uid, {
          status: data.status === 'active' ? 'active' : data.status,
          current_period_end: periodEnd
        });
        break;
      }

      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch(err) {
    console.error('Webhook handler error:', err.message);
    return { statusCode: 500, body: 'Internal error: ' + err.message };
  }
};
