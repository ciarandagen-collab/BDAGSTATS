// ── COACH STATS — UNIT TESTS ─────────────────────────────────────────
// Run with: node tests/unit.test.js
// No dependencies required — pure Node.js

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ pass: true, name });
  } catch(e) {
    failed++;
    results.push({ pass: false, name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((msg || '') + ` — expected ~${expected}, got ${actual}`);
  }
}

// ── 1. SEASON CALCULATION ────────────────────────────────────────────

function getCurrentSeason(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 7) return year + '-' + String(year + 1).slice(2);
  return (year - 1) + '-' + String(year).slice(2);
}

test('Season: August 2026 → 2026-27', () => {
  assertEqual(getCurrentSeason('2026-08-01'), '2026-27');
});
test('Season: July 2026 → 2025-26', () => {
  assertEqual(getCurrentSeason('2026-07-31'), '2025-26');
});
test('Season: January 2026 → 2025-26', () => {
  assertEqual(getCurrentSeason('2026-01-15'), '2025-26');
});
test('Season: December 2025 → 2025-26', () => {
  assertEqual(getCurrentSeason('2025-12-01'), '2025-26');
});
test('Season: September 2025 → 2025-26', () => {
  assertEqual(getCurrentSeason('2025-09-01'), '2025-26');
});

// ── 2. SCORE CALCULATION ─────────────────────────────────────────────

function calcScore(goals, points) {
  return goals * 3 + points;
}

function matchResult(homeGoals, homePoints, awayGoals, awayPoints) {
  const hT = calcScore(homeGoals, homePoints);
  const aT = calcScore(awayGoals, awayPoints);
  return hT > aT ? 'W' : hT < aT ? 'L' : 'D';
}

test('Score: 1-10 = 13', () => assertEqual(calcScore(1, 10), 13));
test('Score: 2-14 = 20', () => assertEqual(calcScore(2, 14), 20));
test('Score: 0-0 = 0', () => assertEqual(calcScore(0, 0), 0));
test('Score: 3-9 = 18', () => assertEqual(calcScore(3, 9), 18));
test('Result: 1-10 vs 0-12 → W (13 vs 12)', () => assertEqual(matchResult(1,10,0,12), 'W'));
test('Result: 0-10 vs 1-8 → L (10 vs 11)', () => assertEqual(matchResult(0,10,1,8), 'L'));
test('Result: 1-9 vs 0-12 → D (12 vs 12)', () => assertEqual(matchResult(1,9,0,12), 'D'));

// ── 3. SHOT CONVERSION ───────────────────────────────────────────────

function shotConversion(scored, total) {
  if (!total) return 0;
  return Math.round((scored / total) * 100);
}

test('Shot conv: 5/10 = 50%', () => assertEqual(shotConversion(5, 10), 50));
test('Shot conv: 3/7 = 43%', () => assertEqual(shotConversion(3, 7), 43));
test('Shot conv: 0/5 = 0%', () => assertEqual(shotConversion(0, 5), 0));
test('Shot conv: 0/0 = 0%', () => assertEqual(shotConversion(0, 0), 0));
test('Shot conv: 10/10 = 100%', () => assertEqual(shotConversion(10, 10), 100));

// ── 4. PLAYER PERFORMANCE ────────────────────────────────────────────

const DEFAULT_EVENT_CONFIG = [
  { id:'shot-play', outcomes:[
    {key:'point',perf:5},{key:'goal',perf:8},{key:'wide',perf:-1},{key:'saved',perf:0}
  ]},
  { id:'ballWon', outcomes:[
    {key:'tackle',perf:4},{key:'interception',perf:4}
  ]},
  { id:'cards', outcomes:[
    {key:'yellow',perf:-3},{key:'red',perf:-8}
  ]},
  { id:'turnover', outcomes:[
    {key:'inAttack',perf:5}
  ]},
];

function calcPlayerPerformance(playerStats) {
  if (!playerStats) return 0;
  let score = 0;
  DEFAULT_EVENT_CONFIG.forEach(evt => {
    const statGroup = playerStats[evt.id] || playerStats[evt.id.replace(/-/g,'_')];
    if (!statGroup) return;
    evt.outcomes.forEach(o => {
      score += (statGroup[o.key] || 0) * (o.perf || 0);
    });
  });
  // Also handle shots stored under shotsPlay
  const playEvt = DEFAULT_EVENT_CONFIG.find(e => e.id === 'shot-play');
  if (playEvt && playerStats.shotsPlay) {
    playEvt.outcomes.forEach(o => {
      score += (playerStats.shotsPlay[o.key] || 0) * (o.perf || 0);
    });
  }
  return score;
}

test('Perf: 1 goal = +8', () => {
  assertEqual(calcPlayerPerformance({ shotsPlay: { goal: 1 } }), 8);
});
test('Perf: 2 points = +10', () => {
  assertEqual(calcPlayerPerformance({ shotsPlay: { point: 2 } }), 10);
});
test('Perf: 1 red card = -8', () => {
  assertEqual(calcPlayerPerformance({ cards: { red: 1 } }), -8);
});
test('Perf: 1 wide = -1', () => {
  assertEqual(calcPlayerPerformance({ shotsPlay: { wide: 1 } }), -1);
});
test('Perf: 1 goal + 1 wide = +7', () => {
  assertEqual(calcPlayerPerformance({ shotsPlay: { goal: 1, wide: 1 } }), 7);
});
test('Perf: 1 tackle = +4', () => {
  assertEqual(calcPlayerPerformance({ ballWon: { tackle: 1 } }), 4);
});
test('Perf: 1 yellow = -3', () => {
  assertEqual(calcPlayerPerformance({ cards: { yellow: 1 } }), -3);
});
test('Perf: empty stats = 0', () => {
  assertEqual(calcPlayerPerformance({}), 0);
});
test('Perf: null = 0', () => {
  assertEqual(calcPlayerPerformance(null), 0);
});
test('Perf: goal + tackle + yellow = +8+4-3 = +9', () => {
  assertEqual(calcPlayerPerformance({
    shotsPlay: { goal: 1 }, ballWon: { tackle: 1 }, cards: { yellow: 1 }
  }), 9);
});

// ── 5. TRIALIST AVERAGE ──────────────────────────────────────────────

function getTrialistAvg(sessions, trialistId) {
  const scores = [];
  sessions.forEach(s => {
    const g = s.grades && s.grades[trialistId];
    if (g && g.attended && g.overall) scores.push(g.overall);
    const sg = s.sharedGrades && s.sharedGrades[trialistId];
    if (sg && sg.submissions) {
      sg.submissions.forEach(sub => {
        if (sub.attended && sub.overall) scores.push(sub.overall);
      });
    }
  });
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

test('Trialist avg: single score 7 = 7', () => {
  const sessions = [{ grades: { 1: { attended: true, overall: 7 } } }];
  assertEqual(getTrialistAvg(sessions, 1), 7);
});
test('Trialist avg: two scores 6+8 = 7', () => {
  const sessions = [
    { grades: { 1: { attended: true, overall: 6 } } },
    { grades: { 1: { attended: true, overall: 8 } } },
  ];
  assertEqual(getTrialistAvg(sessions, 1), 7);
});
test('Trialist avg: absent session excluded', () => {
  const sessions = [
    { grades: { 1: { attended: true, overall: 8 } } },
    { grades: { 1: { attended: false, overall: 3 } } },
  ];
  assertEqual(getTrialistAvg(sessions, 1), 8);
});
test('Trialist avg: no sessions = null', () => {
  assertEqual(getTrialistAvg([], 1), null);
});
test('Trialist avg: multi-coach merged correctly (head 7 + co-coach 9 = 8)', () => {
  const sessions = [{
    grades: { 1: { attended: true, overall: 7 } },
    sharedGrades: { 1: { submissions: [{ attended: true, overall: 9, coachName: 'Sean' }] } }
  }];
  assertEqual(getTrialistAvg(sessions, 1), 8);
});
test('Trialist avg: three coaches (6+7+8 = 7)', () => {
  const sessions = [{
    grades: { 1: { attended: true, overall: 6 } },
    sharedGrades: { 1: { submissions: [
      { attended: true, overall: 7, coachName: 'Sean' },
      { attended: true, overall: 8, coachName: 'Padraig' }
    ]}}
  }];
  assertClose(getTrialistAvg(sessions, 1), 7, 0.01);
});

// ── 6. ATTENDANCE STATS ──────────────────────────────────────────────

function getPlayerAttStats(sessions, slotIdx, season) {
  const filtered = sessions.filter(s => s.season === season);
  const total = filtered.length;
  if (!total) return { pct: 100, present: 0, total: 0, streak: 0 };
  const present = filtered.filter(s => (s.attendance || {})[slotIdx] === 'present').length;
  const pct = Math.round((present / total) * 100);
  const sorted = filtered.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const s of sorted) {
    if ((s.attendance || {})[slotIdx] === 'present') streak++;
    else break;
  }
  return { pct, present, total, streak };
}

const testSessions = [
  { season:'2025-26', date:'2026-01-06', attendance: { 0:'present', 1:'absent' } },
  { season:'2025-26', date:'2026-01-13', attendance: { 0:'present', 1:'present' } },
  { season:'2025-26', date:'2026-01-20', attendance: { 0:'present', 1:'present' } },
  { season:'2025-26', date:'2026-01-27', attendance: { 0:'absent',  1:'present' } },
  { season:'2024-25', date:'2025-09-01', attendance: { 0:'present', 1:'present' } },
];

test('Attendance: player 0 — 3/4 = 75%', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2025-26').pct, 75);
});
test('Attendance: player 1 — 3/4 = 75%', () => {
  assertEqual(getPlayerAttStats(testSessions, 1, '2025-26').pct, 75);
});
test('Attendance: correct present count', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2025-26').present, 3);
});
test('Attendance: correct total count', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2025-26').total, 4);
});
test('Attendance: streak — player 0 last absent = streak 0', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2025-26').streak, 0);
});
test('Attendance: streak — player 1 last 3 present = streak 3', () => {
  assertEqual(getPlayerAttStats(testSessions, 1, '2025-26').streak, 3);
});
test('Attendance: cross-season filter works', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2024-25').total, 1);
});
test('Attendance: empty season = 100% default', () => {
  assertEqual(getPlayerAttStats(testSessions, 0, '2023-24').pct, 100);
});

// ── 7. KICKOUT % ─────────────────────────────────────────────────────

function kickoutPct(ko) {
  const won = (ko.wonClean||0) + (ko.breakWon||0) + (ko.shortWon||0);
  const total = Object.values(ko).reduce((a,b) => a+b, 0);
  return total ? Math.round((won/total)*100) : 0;
}

test('Kickout: 4 won / 10 total = 40%', () => {
  assertEqual(kickoutPct({wonClean:3,breakWon:1,lossClean:4,breakLoss:2}), 40);
});
test('Kickout: all won = 100%', () => {
  assertEqual(kickoutPct({wonClean:5}), 100);
});
test('Kickout: empty = 0%', () => {
  assertEqual(kickoutPct({}), 0);
});

// ── 8. HISTORY SEARCH FILTER ─────────────────────────────────────────

function filterHistory(list, query) {
  if (!query || !query.trim()) return list;
  const q = query.toLowerCase().trim();
  return list.filter(m =>
    (m.home && m.home.toLowerCase().includes(q)) ||
    (m.away && m.away.toLowerCase().includes(q)) ||
    (m.competition && m.competition.toLowerCase().includes(q)) ||
    (m.venue && m.venue.toLowerCase().includes(q))
  );
}

const historyList = [
  { home:'Kilcoo', away:'Burren', competition:'Down SFC', venue:'Páirc Esler' },
  { home:'Mayobridge', away:'Kilcoo', competition:'Down SFC', venue:'Warrenpoint' },
  { home:'Clonduff', away:'Ballyholland', competition:'Down JFC', venue:'Newcastle' },
];

test('History filter: search "kilcoo" returns 2 matches', () => {
  assertEqual(filterHistory(historyList, 'kilcoo').length, 2);
});
test('History filter: search "down sfc" returns 2 matches', () => {
  assertEqual(filterHistory(historyList, 'down sfc').length, 2);
});
test('History filter: search "newcastle" returns 1 match', () => {
  assertEqual(filterHistory(historyList, 'newcastle').length, 1);
});
test('History filter: empty query returns all', () => {
  assertEqual(filterHistory(historyList, '').length, 3);
});
test('History filter: no match returns 0', () => {
  assertEqual(filterHistory(historyList, 'tyrone').length, 0);
});
test('History filter: case insensitive', () => {
  assertEqual(filterHistory(historyList, 'KILCOO').length, 2);
});

// ── 9. WELLNESS SCORING ──────────────────────────────────────────────

function wellnessAvg(submission) {
  const scores = ['sleep','energy','soreness','stress','mood']
    .map(k => submission[k])
    .filter(Boolean);
  if (!scores.length) return 0;
  return scores.reduce((a,b) => a+b, 0) / scores.length;
}

function wellnessColor(avg) {
  return avg >= 4 ? 'green' : avg >= 3 ? 'yellow' : 'red';
}

test('Wellness avg: all 5s = 5.0', () => {
  assertEqual(wellnessAvg({sleep:5,energy:5,soreness:5,stress:5,mood:5}), 5);
});
test('Wellness avg: all 1s = 1.0', () => {
  assertEqual(wellnessAvg({sleep:1,energy:1,soreness:1,stress:1,mood:1}), 1);
});
test('Wellness avg: mixed = 3.0', () => {
  assertEqual(wellnessAvg({sleep:5,energy:3,soreness:3,stress:2,mood:2}), 3);
});
test('Wellness color: avg 4.5 = green', () => {
  assertEqual(wellnessColor(4.5), 'green');
});
test('Wellness color: avg 3.0 = yellow', () => {
  assertEqual(wellnessColor(3), 'yellow');
});
test('Wellness color: avg 2.5 = red', () => {
  assertEqual(wellnessColor(2.5), 'red');
});
test('Wellness color: avg 4.0 = green (boundary)', () => {
  assertEqual(wellnessColor(4), 'green');
});

// ── RESULTS ──────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(55));
console.log('  COACH STATS — UNIT TEST RESULTS');
console.log('─'.repeat(55));

results.forEach(r => {
  const icon = r.pass ? '✅' : '❌';
  console.log(`${icon}  ${r.name}`);
  if (!r.pass) console.log(`     → ${r.error}`);
});

console.log('─'.repeat(55));
console.log(`  ${passed} passed · ${failed} failed · ${passed+failed} total`);
console.log('─'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
