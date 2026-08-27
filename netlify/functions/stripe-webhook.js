// netlify/functions/stripe-webhook.js
//
// Listens for Stripe webhook events and is the ONLY place subscription
// status should ever be written to 'active'. The client (app.html) only
// reads this table — it never sets status directly — because a URL
// parameter or a client-side request can be faked by anyone typing a URL
// into their browser; a signed webhook event from Stripe's own servers
// can't be.
//
// ── SETUP (Netlify) ─────────────────────────────────────────────────
// 1. Environment variables — Netlify → Site settings → Environment
//    variables:
//      STRIPE_SECRET_KEY          starts with sk_live_ or sk_test_
//      STRIPE_WEBHOOK_SECRET      starts with whsec_ — see step 3
//      SUPABASE_URL               e.g. https://xxxx.supabase.co
//      SUPABASE_SERVICE_ROLE_KEY  Supabase → Settings → API → service_role
//                                 key. NEVER the anon key, and never put
//                                 this in app.html or anywhere client-side —
//                                 it bypasses Row Level Security entirely,
//                                 which is exactly why only a trusted
//                                 server-side function should hold it.
//
// 2. Dependencies — add to the package.json that covers this functions
//    folder (create one in netlify/functions/ if there isn't one already):
//      { "dependencies": { "stripe": "^14.0.0", "@supabase/supabase-js": "^2.0.0" } }
//    then redeploy so Netlify installs them.
//
// 3. Stripe Dashboard → Developers → Webhooks → Add endpoint:
//      URL: https://coachstats.app/.netlify/functions/stripe-webhook
//      Events to send:
//        checkout.session.completed
//        customer.subscription.updated
//        customer.subscription.deleted
//        invoice.payment_failed
//    Copy the "Signing secret" shown after creating it into
//    STRIPE_WEBHOOK_SECRET above.
//
// 4. REQUIRED on the create-checkout side: the Stripe Checkout Session
//    must be created with client_reference_id (or metadata.userId) set to
//    the Supabase user's id — e.g.
//      stripe.checkout.sessions.create({
//        ...,
//        client_reference_id: userId,   // <- from the request body app.html sends
//        metadata: { userId },
//      })
//    Without this, the webhook has no way to know which user just paid.
//    startCheckout() in app.html already sends userId in the POST body to
//    create-checkout — just confirm that function forwards it through to
//    Stripe rather than dropping it.
//
// 5. Test it: Stripe Dashboard → your webhook endpoint → "Send test
//    webhook" → checkout.session.completed. Confirm the subscriptions row
//    in Supabase updates, and check Netlify's function logs for errors.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    // event.body must be the RAW request body for signature verification to
    // work. This is what actually proves the event came from Stripe and
    // wasn't forged — do not skip or weaken this check.
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.client_reference_id || (session.metadata && session.metadata.userId);

        if (!userId) {
          console.error('checkout.session.completed with no userId attached — cannot update a subscription. Check create-checkout is setting client_reference_id.');
          break;
        }

        let currentPeriodEnd = null;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            current_period_end: currentPeriodEnd,
          })
          .eq('user_id', userId);

        if (error) console.error('Supabase update failed (checkout.session.completed):', error);
        break;
      }

      // Covers renewals and plan changes — keeps current_period_end fresh
      // and catches a subscription moving to past_due or being canceled
      // directly in Stripe (e.g. a customer cancels from the Stripe portal).
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: sub.status, // Stripe's own statuses: active, past_due, canceled, unpaid, etc.
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('Supabase update failed (customer.subscription.updated):', error);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('Supabase update failed (customer.subscription.deleted):', error);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        if (invoice.subscription) {
          const { error } = await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription);
          if (error) console.error('Supabase update failed (invoice.payment_failed):', error);
        }
        break;
      }

      default:
        // Not an event this app acts on — fine to ignore.
        break;
    }
  } catch (err) {
    // Log and still return 200 so Stripe doesn't endlessly retry a bug in
    // this handler itself — check Netlify's function logs to debug.
    // Signature failures above are the one case that DOES return an error,
    // since that's Stripe's cue to retry a genuinely undelivered event.
    console.error('Error handling Stripe webhook:', err);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
