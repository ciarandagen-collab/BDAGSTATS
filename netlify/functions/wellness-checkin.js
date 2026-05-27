const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function supaReq(path, method, body) {
  const res = await fetch(SUPA_URL + '/rest/v1/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPA_SERVICE_KEY,
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return text; }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { userId, date, slotIdx, scores, note } = body;
  if (!userId || !date || slotIdx === undefined || !scores) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  try {
    // Fetch existing wellness data for this user
    const existing = await supaReq('wellness_data?user_id=eq.' + userId + '&select=data', 'GET');
    let wellnessData = (existing && existing.length && existing[0].data) ? existing[0].data : {};

    // Merge new submission
    if (!wellnessData[date]) wellnessData[date] = {};
    wellnessData[date][slotIdx] = {
      ...scores,
      note: note || '',
      submittedAt: new Date().toISOString()
    };

    // Upsert wellness data
    const method = (existing && existing.length) ? 'PATCH' : 'POST';
    const path = method === 'PATCH' ? 'wellness_data?user_id=eq.' + userId : 'wellness_data';
    await supaReq(path, method, { user_id: userId, data: wellnessData });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch(err) {
    console.error('Wellness check-in error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
