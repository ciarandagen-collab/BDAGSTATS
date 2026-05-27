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

  const { userId, trialId, sessionId, coachName, grades } = body;
  if (!userId || !trialId || !sessionId || !coachName || !grades) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  try {
    // Fetch existing shared trial data
    const existing = await supaReq('shared_trials?user_id=eq.' + userId + '&select=trials', 'GET');
    let trialData = (existing && existing.length && existing[0].trials) ? existing[0].trials : [];

    // Find or create trial
    let trial = trialData.find(t => t.id === trialId);
    if (!trial) {
      trial = { id: trialId, sessions: [] };
      trialData.push(trial);
    }

    // Find or create session
    let session = trial.sessions.find(s => s.id === sessionId);
    if (!session) {
      session = { id: sessionId, grades: {} };
      trial.sessions.push(session);
    }

    // Merge coach grades into session
    Object.keys(grades).forEach(trialistId => {
      if (!session.grades[trialistId]) {
        session.grades[trialistId] = { submissions: [] };
      }
      // Remove previous submission from this coach if exists
      session.grades[trialistId].submissions = session.grades[trialistId].submissions
        .filter(s => s.coachName !== coachName);
      // Add new submission
      session.grades[trialistId].submissions.push({
        coachName,
        submittedAt: new Date().toISOString(),
        ...grades[trialistId]
      });
      // Recalculate average
      const scores = session.grades[trialistId].submissions
        .filter(s => s.attended && s.overall)
        .map(s => s.overall);
      session.grades[trialistId].avgOverall = scores.length
        ? Math.round((scores.reduce((a,b) => a+b, 0) / scores.length) * 10) / 10
        : 0;
    });

    // Upsert shared trials
    const method = (existing && existing.length) ? 'PATCH' : 'POST';
    const path = method === 'PATCH' ? 'shared_trials?user_id=eq.' + userId : 'shared_trials';
    await supaReq(path, method, { user_id: userId, trials: trialData });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch(err) {
    console.error('Trial grade error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
