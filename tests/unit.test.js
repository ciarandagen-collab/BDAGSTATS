// ── COACH STATS — OFFLINE UNIT TESTS ────────────────────────────────
// Run with:  node tests/unit.test.js
//
// These run against the REAL app code in app.html, with a stubbed DOM, and
// need no deployment and no network. That matters: every costly bug in this
// project so far has been a logic bug that a browser test could only catch
// after shipping —
//   • an outcome label ('POINT') passed where a data key ('point') was needed,
//     so events logged but the scoreboard never moved
//   • functions deleted by an over-wide edit, so the app loaded but did nothing
//   • renderGameControls never called on load, so the clock had no buttons
// All three are caught here in about a second.

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app.html');

// ── Minimal DOM ──────────────────────────────────────────────────────
// Deliberately records what gets written, so "rendered nothing" is
// distinguishable from "rendered correctly" — the gap that hid the clock bug.
const written = {};

function stubEl(id) {
  const el = {
    __id: id, style: {}, dataset: {}, children: [], value: '', checked: false,
    textContent: '', offsetParent: null, offsetWidth: 100, offsetHeight: 100, files: [],
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
    insertAdjacentHTML() {}, focus() {}, click() {}, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100 }; },
    getContext() { return new Proxy({}, { get: () => () => ({ addColorStop() {} }) }); }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el.__html || ''; },
    set(v) { el.__html = v; if (id) written[id] = String(v).length; }
  });
  return el;
}

const store = {};
global.localStorage = {
  get length() { return Object.keys(store).length; },
  key: i => Object.keys(store)[i],
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.document = {
  getElementById: id => stubEl(id), querySelector: () => stubEl(),
  querySelectorAll: () => [], createElement: () => stubEl(),
  addEventListener(t, f) { (global.__doc = global.__doc || []).push([t, f]); },
  body: stubEl(), documentElement: stubEl(), head: stubEl(),
  cookie: '', title: '', hidden: false, activeElement: null,
  contains: () => false, write() {}, close() {}
};
global.window = {
  addEventListener(t, f) { (global.__win = global.__win || []).push([t, f]); },
  location: { href: 'https://coachstats.app/app', search: '', hash: '', pathname: '/app', origin: 'https://coachstats.app', reload() {}, replace() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  innerWidth: 390, innerHeight: 844, localStorage: global.localStorage,
  open: () => ({ document: { write() {}, close() {} } }),
  scrollTo() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  setTimeout, clearTimeout, setInterval, clearInterval
};
global.navigator = {
  serviceWorker: { register: () => Promise.resolve({ update() {}, addEventListener() {} }),
    addEventListener() {}, controller: null, getRegistrations: () => Promise.resolve([]) },
  userAgent: 'node', onLine: true, clipboard: { writeText() {} }
};
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({}), ok: true, text: () => Promise.resolve('') });
global.MutationObserver = class { observe() {} disconnect() {} };
global.Element = class {}; global.HTMLElement = class {}; global.Node = class {};
global.CustomEvent = class {}; global.Event = class {}; global.FormData = class {};
global.XMLHttpRequest = class { open() {} send() {} setRequestHeader() {} addEventListener() {} };
global.Image = class {}; global.Audio = class { play() {} };
global.performance = { now: () => Date.now() };
global.screen = { width: 390, height: 844 };
global.history = { pushState() {}, replaceState() {} };
global.alert = () => {}; global.confirm = () => true; global.prompt = () => null;
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.URL = { createObjectURL: () => 'blob:', revokeObjectURL() {} };
global.Blob = class {}; global.FileReader = class { readAsDataURL() {} };
global.caches = undefined;

// ── Test harness ─────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function group(name) { console.log('\n' + name); }
function check(name, actual, expected) {
  const a = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
  const e = typeof expected === 'object' ? JSON.stringify(expected) : String(expected);
  if (a === e) { passed++; console.log('  PASS  ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL  ' + name + '\n          got:      ' + a + '\n          expected: ' + e); }
}
function ok(name, fn) {
  try { const r = fn(); if (r === false) throw new Error('returned false'); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; failures.push(name); console.log('  FAIL  ' + name + '  ->  ' + e.message); }
}

// ── Load the real app ────────────────────────────────────────────────
const html = fs.readFileSync(APP, 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const SUITE = `
// ══ 1. APP LOADS AND INITIALISES ══
group('App loads');
ok('script executes with no top-level error', function(){ return true; });
ok('core recording functions exist', function(){
  ['startEvent','commitShot','commitGeneric','confirmPlayerPick','addShot','addScore',
   'renderClock','renderGameControls','renderRecordEventGrid','setHalf','loadSquad',
   'deleteEvent','renderTimeline','undoLastEvent','calcPossession','analyseMatch']
    .forEach(function(n){ if (typeof eval(n) !== 'function') throw new Error('missing ' + n); });
});
ok('init handlers run without throwing', function(){
  (global.__doc||[]).forEach(function(h){ h[1]({ preventDefault(){}, stopPropagation(){} }); });
  (global.__win||[]).forEach(function(h){ h[1]({ preventDefault(){}, stopPropagation(){} }); });
});
ok('clock buttons are rendered on load', function(){
  if (!written['clock-btns-area']) throw new Error('clock button area is empty');
});
ok('event grid is rendered on load', function(){
  if (!written['rec-event-grid']) throw new Error('event grid is empty');
});

// ══ 2. SCORING ══
group('Scoring');
for (var i=0;i<15;i++) squad[i] = { name:'Player '+(i+1), pos:'', stats:{} };
function rec(team, kind, arg, outcome, player) {
  startEvent(team, kind, arg);
  if (kind === 'shot') selectShotOutcome(outcome); else selectGenericOutcome(outcome);
  if (pendingEvent) confirmPlayerPick(player);
}
function score(t){ var p = String(state[t].points); if (p.length < 2) p = '0'+p; return state[t].goals + '-' + p; }

resetMatch(); rec('home','shot','play','point',6);
check('point from play', score('home'), '0-01');
resetMatch(); rec('home','shot','play','goal',6);
check('goal from play', score('home'), '1-00');
resetMatch(); rec('home','shot','play','twopointer',6);
check('two-pointer counts 2', score('home'), '0-02');
resetMatch(); rec('home','shot','free','point',13);
check('point from a free', score('home'), '0-01');
resetMatch(); rec('home','shot','play','wide',6);
check('wide does not score', score('home'), '0-00');
check('wide is counted', state.shots.home.play.wide, 1);
resetMatch(); rec('away','generic','fortyFive','scored','away-3');
check('scored 45 adds a point', score('away'), '0-01');
resetMatch();
rec('home','shot','play','point',6); rec('home','shot','play','point',6); rec('home','shot','play','goal',6);
check('two points and a goal', score('home'), '1-02');
check('player stat line', (squad[6].stats.shotsPlay||{}), {point:2, goal:1});

// Regression: the label/key bug that logged events without scoring
resetMatch();
ok('a bad outcome key is rejected, not silently ignored', function(){
  var before = state.home.points;
  addShot('home','play','POINT');
  if (state.home.points !== before) throw new Error('bad key changed the score');
  if (state.shots.home.play.POINT !== undefined) throw new Error('bad key created a counter');
});

// ══ 3. EVENT LIFECYCLE ══
group('Event lifecycle');
resetMatch();
ok('nothing is recorded before the player is chosen', function(){
  startEvent('home','generic','ballWon');
  selectGenericOutcome('tackle');
  if (state.events.length !== 0) throw new Error('event saved too early');
  confirmPlayerPick(4);
  if (state.events.length !== 1) throw new Error('event not saved after player');
});
resetMatch();
ok('abandoning the player step records nothing', function(){
  startEvent('home','generic','ballWon');
  selectGenericOutcome('tackle');
  pendingEvent = null;
  if (state.events.length !== 0) throw new Error('half-saved event left behind');
});
resetMatch();
ok('deleting a scoring shot also reverses the scoreboard', function(){
  rec('home','shot','play','goal',6);
  if (state.home.goals !== 1) throw new Error('goal not scored');
  deleteEvent(state.events[0].id);
  if (state.home.goals !== 0) throw new Error('scoreboard not reversed on delete');
});

// ══ 4. POSSESSION METHOD ══
group('Possession');
resetMatch();
check('untagged falls back to the estimate', calcPossession().method, 'derived');
state.possession = { home:{count:40}, away:{count:35} };
check('both sides tagged uses real counts', calcPossession().method, 'counted');
check('counted split is correct', calcPossession().h, 53);
state.possession = { home:{count:0}, away:{count:12} };
check('one-sided tagging falls back', calcPossession().method, 'derived');

// ══ 5. KICKOUT BANDS ══
group('Kickout destination');
check('my team, screen-right is his left', kickoutBands('home',260,150).channel, 'left');
check('my team, screen-left is his right', kickoutBands('home',60,150).channel, 'right');
check('opposition, screen-left is his left', kickoutBands('away',60,330).channel, 'left');
check('opposition, screen-right is his right', kickoutBands('away',260,330).channel, 'right');
check('short from own goal', kickoutBands('home',160,60).distance, 'short');
check('long past halfway', kickoutBands('home',160,400).distance, 'long');

// ══ 6. DISCIPLINE ══
group('Discipline');
state.events = [
  { type:'cards', team:'home', outcome:'yellow', player:4, min:20 },
  { type:'cards', team:'home', outcome:'yellow', player:4, min:55 }
];
check('two yellows make a red', cardStatus('home')[4], 'red');
state.events = [
  { type:'cards', team:'home', outcome:'black', player:7, min:10 },
  { type:'cards', team:'home', outcome:'yellow', player:7, min:40 }
];
check('a yellow does not downgrade a black', cardStatus('home')[7], 'black');

// ══ 7. SEASON AGGREGATION ══
group('Season stats');
var _lh = loadHistory;
loadHistory = function(){ return [
  { id:1, players:[{name:'A', mins:60, stats:{shotsPlay:{point:3},shotsFree:{point:2,wide:1}}}] },
  { id:2, players:[{name:'A', mins:60, stats:{shotsPlay:{point:2,goal:1}}}] },
  { id:3, players:[{name:'B', mins:0,  stats:{}}] }
];};
var sn = seasonPlayerStats(true);
check('matches counted', sn['A'].matches, 2);
check('goals aggregated', sn['A'].goals, 1);
check('points aggregated', sn['A'].points, 7);
check('free conversion', sn['A'].freeConv, 67);
check('a player who did not feature counts zero', sn['B'].matches, 0);
loadHistory = _lh;

// ══ 8. MATCH ANALYSIS ══
group('Match analysis');
ok('a sparse legacy match produces a report, not a crash', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:2, homePoints:11,
                         awayGoals:1, awayPoints:9, events:[], players:[] });
  if (!a.sections.length) throw new Error('no sections');
  if (!a.dataNote) throw new Error('missing data caveat');
});
ok('an empty match still returns a verdict', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:0, homePoints:0,
                         awayGoals:0, awayPoints:0, events:[], players:[] });
  if (!a.verdict) throw new Error('no verdict');
});
ok('null player slots do not crash the analysis', function(){
  analyseMatch({ home:'A', away:'B', homeGoals:1, homePoints:5, awayGoals:0, awayPoints:3,
                 events:[], players:[null, {name:'X', stats:{shotsPlay:{point:2}}}, null] });
});
check('event log sorts by half then minute',
  matchEventLog({ events:[{min:40,half:2},{min:5,half:1},{min:20,half:1},{min:12,half:2}] })
    .map(function(e){ return e.half+':'+e.min; }).join(','),
  '1:5,1:20,2:12,2:40');

// ══ 8b. PHASE A: TURNOVERS, RUNS, PERIODS, LINES ══
group('Turnover cost');
resetMatch();
state.events = [
  { id:1, team:'home', type:'ballLost', outcome:'handPass', min:10, half:1 },
  { id:2, team:'away', type:'shot',     outcome:'point',    min:11, half:1 },  // within 2 min -> counts
  { id:3, team:'home', type:'ballLost', outcome:'kickPass', min:20, half:1 },
  { id:4, team:'away', type:'shot',     outcome:'goal',     min:21, half:1 },  // counts, worth 3
  { id:5, team:'home', type:'ballLost', outcome:'handPass', min:30, half:1 },
  { id:6, team:'away', type:'shot',     outcome:'point',    min:38, half:1 },  // too late -> ignored
  { id:7, team:'home', type:'ballLost', outcome:'handPass', min:5,  half:2 },
  { id:8, team:'away', type:'shot',     outcome:'point',    min:6,  half:1 }   // wrong half -> ignored
];
var tc = turnoverCost('home', 0, 2);
check('turnovers counted', tc.turnovers, 4);
check('chains that led to a score', tc.chains, 2);
check('goals conceded from them', tc.goals, 1);
check('points conceded from them', tc.points, 1);
check('total cost in points', tc.cost, 4);
check('a score is not double-counted', turnoverCost('home',0,2).chains, 2);

group('Scoring runs');
resetMatch();
state.events = [
  { id:1, team:'home', type:'shot', outcome:'point', min:2,  half:1 },
  { id:2, team:'away', type:'shot', outcome:'point', min:5,  half:1 },
  { id:3, team:'away', type:'shot', outcome:'point', min:8,  half:1 },
  { id:4, team:'away', type:'shot', outcome:'goal',  min:11, half:1 },
  { id:5, team:'away', type:'shot', outcome:'point', min:14, half:1 },
  { id:6, team:'home', type:'shot', outcome:'point', min:20, half:1 }
];
var runs = scoringRuns(3);
check('a run of 4 is found', runs.length, 1);
check('run belongs to the away team', runs[0].team, 'away');
check('run length', runs[0].n, 4);
check('run value (1 goal + 3 points)', runs[0].total, 6);
check('run start minute', runs[0].from, 5);
check('run end minute', runs[0].to, 14);

group('Period splits');
resetMatch();
state.events = [
  { id:1, team:'home', type:'shot', outcome:'point', min:3,  half:1 },
  { id:2, team:'home', type:'shot', outcome:'goal',  min:12, half:1 },
  { id:3, team:'home', type:'shot', outcome:'point', min:25, half:1 },
  { id:4, team:'home', type:'shot', outcome:'point', min:33, half:2 }
];
check('opening 15 of the first half', periodScore('home',1,1,15).total, 4);
check('closing period of the first half', periodScore('home',1,21,40).total, 1);
check('second half is separate', periodScore('home',2,21,40).total, 1);

group('Line analysis');
resetMatch();
for (var i=0;i<15;i++) squad[i] = { name:'P'+(i+1), pos:'', stats:{} };
state.startingFifteen = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
state.events = [
  { id:1, team:'home', type:'shot',     outcome:'point',  min:5,  half:1, player:13 }, // pos 14 FF line
  { id:2, team:'home', type:'shot',     outcome:'goal',   min:9,  half:1, player:12 }, // pos 13 FF line
  { id:3, team:'home', type:'ballWon',  outcome:'tackle', min:11, half:1, player:5 },  // pos 6 HB line
  { id:4, team:'home', type:'ballLost', outcome:'handPass', min:15, half:1, player:7 } // pos 8 midfield
];
var ls = lineStats(0);
check('full-forward line scored 1-01', ls['Full-forward line'].goals + '-' +
      String(ls['Full-forward line'].points).padStart(2,'0'), '1-01');
check('half-back line ball won', ls['Half-back line'].ballWon, 1);
check('midfield ball lost', ls['Midfield'].ballLost, 1);
check('full-back line uninvolved', ls['Full-back line'].shots, 0);

group('Report-level derivations');
ok('turnoverCostFromRecord matches a saved record', function(){
  var r = turnoverCostFromRecord({ events:[
    { id:1, team:'home', type:'ballLost', min:10, half:1 },
    { id:2, team:'away', type:'shot', outcome:'goal', min:11, half:1 }
  ]}, 'home');
  if (r.chains !== 1 || r.cost !== 3) throw new Error('got ' + JSON.stringify(r));
});
ok('bestRunFromRecord needs 3+ to count', function(){
  var r = bestRunFromRecord({ events:[
    { id:1, team:'away', type:'shot', outcome:'point', min:1, half:1 },
    { id:2, team:'away', type:'shot', outcome:'point', min:3, half:1 }
  ]});
  if (r !== null) throw new Error('a run of 2 should not count');
});

// ══ 9. SAFETY HELPERS ══
group('Safety helpers');
check('escapeHtml handles angle brackets', escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
check('escapeHtml handles apostrophes', escapeHtml("O'Brien"), 'O&#39;Brien');
check('escapeHtml handles null', escapeHtml(null), '');
ok('safeSetItem returns true on success', function(){
  if (safeSetItem('__t','1') !== true) throw new Error('expected true');
});
ok('safeSetItem returns false and warns when quota is full', function(){
  var orig = localStorage.setItem;
  localStorage.setItem = function(){ var e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  var r = safeSetItem('__t','1');
  localStorage.setItem = orig;
  if (r !== false) throw new Error('expected false on quota failure');
});

// ══ 10. LIVE SHARE ══
group('Live share');
ok('share codes avoid ambiguous characters', function(){
  for (var i=0;i<100;i++) {
    var c = makeShareCode();
    if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(c)) throw new Error('bad code ' + c);
  }
});
ok('snapshot stays small', function(){
  var b = JSON.stringify(buildLiveSnapshot()).length;
  if (b > 20000) throw new Error('snapshot too large: ' + b);
});
ok('publishing with no session is a no-op', function(){ pushLiveSnapshot(false); });
`;

try {
  eval(js + SUITE);
} catch (e) {
  failed++;
  console.log('\nFATAL: ' + e.message);
  console.log((e.stack || '').split('\n').slice(1, 3).join('\n'));
}

console.log('\n' + '─'.repeat(56));
console.log(`${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  • ' + f));
}
process.exit(failed ? 1 : 0);
