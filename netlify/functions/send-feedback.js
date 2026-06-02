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

  const { email, category, message, name } = body;
  if (!message || !category) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  try {
    // Send via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'Coach Stats Feedback <hello@coachstats.app>',
        to: ['hello@coachstats.app'],
        reply_to: email || 'hello@coachstats.app',
        subject: '[' + category + '] Coach Stats Feedback' + (name ? ' from ' + name : ''),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;">
            <h2 style="color:#16a34a;">New Coach Stats Feedback</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:8px;background:#f0fdf4;font-weight:bold;width:120px;">Category</td><td style="padding:8px;border:1px solid #e5e7eb;">${category}</td></tr>
              <tr><td style="padding:8px;background:#f0fdf4;font-weight:bold;">From</td><td style="padding:8px;border:1px solid #e5e7eb;">${name || 'Anonymous'} ${email ? '&lt;' + email + '&gt;' : ''}</td></tr>
            </table>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
              <p style="margin:0;white-space:pre-wrap;font-size:15px;line-height:1.6;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            </div>
            <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Sent from Coach Stats app · ${new Date().toLocaleString('en-GB')}</p>
          </div>
        `
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('Resend error: ' + err);
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch(err) {
    console.error('Feedback error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
