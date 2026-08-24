// ── COACH STATS — OFFLINE UNIT TESTS ────────────────────────────────
// Run with:  node tests/unit.test.cjs
//
// MUST stay .cjs, not .js — if package.json has "type": "module", a .js file
// here makes Node throw "require is not defined in ES module scope" and the
// whole suite fails before a single test runs. This happened once already.
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

// Look for app.html beside the tests folder, then at the repo root, so this
// works whether CI runs it from the root or from inside tests/.
const CANDIDATES = [
  path.join(__dirname, '..', 'app.html'),
  path.join(process.cwd(), 'app.html'),
  path.join(__dirname, 'app.html')
];
const APP = CANDIDATES.find(p => fs.existsSync(p));
if (!APP) {
  console.error('Could not find app.html. Looked in:');
  CANDIDATES.forEach(p => console.error('  ' + p));
  process.exit(1);
}

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

// Cache stubs by id so a value set on one getElementById call (e.g.
// simulating a dropdown pick) is still there on the next call for the same
// id — closer to how a real DOM element persists, and needed for testing
// any function that reads back a value it didn't just render itself.
const elCache = {};
function cachedStubEl(id) {
  if (!id) return stubEl(id);
  if (!elCache[id]) elCache[id] = stubEl(id);
  return elCache[id];
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
  getElementById: id => cachedStubEl(id), querySelector: () => stubEl(),
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
// NOTE: a scoring shot writes TWO events — the shot AND a goal/point from
// addScore(). Score counting must use only the goal/point events, so that is
// what these fixtures contain.
state.events = [
  { id:1, team:'home', type:'ballLost', outcome:'handPass', min:10, half:1 },
  { id:2, team:'away', type:'point',                        min:11, half:1 },  // within 2 min -> counts
  { id:3, team:'home', type:'ballLost', outcome:'kickPass', min:20, half:1 },
  { id:4, team:'away', type:'goal',                         min:21, half:1 },  // counts, worth 3
  { id:5, team:'home', type:'ballLost', outcome:'handPass', min:30, half:1 },
  { id:6, team:'away', type:'point',                        min:38, half:1 },  // too late -> ignored
  { id:7, team:'home', type:'ballLost', outcome:'handPass', min:5,  half:2 },
  { id:8, team:'away', type:'point',                        min:6,  half:1 }   // wrong half -> ignored
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
  { id:1, team:'home', type:'point', min:2,  half:1 },
  { id:2, team:'away', type:'point', min:5,  half:1 },
  { id:3, team:'away', type:'point', min:8,  half:1 },
  { id:4, team:'away', type:'goal',  min:11, half:1 },
  { id:5, team:'away', type:'point', min:14, half:1 },
  { id:6, team:'home', type:'point', min:20, half:1 }
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
  { id:1, team:'home', type:'point', min:3,  half:1 },
  { id:2, team:'home', type:'goal',  min:12, half:1 },
  { id:3, team:'home', type:'point', min:25, half:1 },
  { id:4, team:'home', type:'point', min:33, half:2 }
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
    { id:2, team:'away', type:'goal', min:11, half:1 }
  ]}, 'home');
  if (r.chains !== 1 || r.cost !== 3) throw new Error('got ' + JSON.stringify(r));
});
ok('bestRunFromRecord needs 3+ to count', function(){
  var r = bestRunFromRecord({ events:[
    { id:1, team:'away', type:'point', min:1, half:1 },
    { id:2, team:'away', type:'point', min:3, half:1 }
  ]});
  if (r !== null) throw new Error('a run of 2 should not count');
});

// ══ 8c. PHASE B: CONSISTENCY AND SUBSTITUTION IMPACT ══
group('Player consistency');
var _lh2 = loadHistory;
loadHistory = function(){ return [
  // Steady: 3,3,2,4 -> reliable
  // Streaky: 0,0,12,0 -> streaky
  { id:1, savedAt:'2026-01-01', away:'A', players:[
      {name:'Steady', mins:60, stats:{shotsPlay:{point:3}}},
      {name:'Streaky', mins:60, stats:{shotsPlay:{point:0}}} ]},
  { id:2, savedAt:'2026-01-08', away:'B', players:[
      {name:'Steady', mins:60, stats:{shotsPlay:{point:3}}},
      {name:'Streaky', mins:60, stats:{}} ]},
  { id:3, savedAt:'2026-01-15', away:'C', players:[
      {name:'Steady', mins:60, stats:{shotsPlay:{point:2}}},
      {name:'Streaky', mins:60, stats:{shotsPlay:{point:12}}} ]},
  { id:4, savedAt:'2026-01-22', away:'D', players:[
      {name:'Steady', mins:60, stats:{shotsPlay:{point:4}}},
      {name:'Streaky', mins:60, stats:{shotsPlay:{point:0}}} ]}
];};
var cons = playerConsistency();
check('steady player matches', cons['Steady'].matches, 4);
check('steady player total', cons['Steady'].sum, 12);
check('steady average', cons['Steady'].avg, 3);
check('steady best', cons['Steady'].best, 4);
check('steady worst', cons['Steady'].worst, 2);
check('steady scored in every match', cons['Steady'].scoredIn, 4);
check('steady is judged reliable', cons['Steady'].verdict, 'Reliable');
check('streaky best', cons['Streaky'].best, 12);
check('streaky blanks', cons['Streaky'].blanks, 3);
check('streaky is judged streaky', cons['Streaky'].verdict, 'Streaky');
ok('a player with under 3 matches is not judged', function(){
  loadHistory = function(){ return [
    { id:1, savedAt:'2026-01-01', players:[{name:'New', mins:60, stats:{shotsPlay:{point:5}}}] }
  ];};
  var r = playerConsistency();
  if (r['New'].verdict !== 'Too few matches to judge') throw new Error(r['New'].verdict);
});

group('Substitution impact');
loadHistory = function(){ return [
  { id:1, away:'A',
    subs:[{team:'home', off:'X', on:'Sub One', min:20, half:2}],
    players:[{name:'Sub One', mins:20, stats:{shotsPlay:{point:2}}},
             {name:'Starter', mins:60, stats:{shotsPlay:{point:1}}}],
    events:[
      // 10 minutes before the sub (min 10-20): 1 point
      {team:'home', type:'shot', outcome:'point', min:15, half:2},
      // 10 minutes after (min 20-30): 3 points
      {team:'home', type:'shot', outcome:'point', min:22, half:2},
      {team:'home', type:'shot', outcome:'point', min:25, half:2},
      {team:'home', type:'shot', outcome:'point', min:29, half:2},
      // outside the window - ignored
      {team:'home', type:'shot', outcome:'point', min:38, half:2}
    ]},
  { id:2, away:'B',
    subs:[{team:'home', off:'Y', on:'Sub Two', min:30, half:2},
          {team:'away', off:'Z', on:'Their Sub', min:30, half:2}],  // away sub ignored
    players:[{name:'Sub Two', mins:10, stats:{shotsPlay:{goal:1}}}],
    events:[] }
];};
var si = substitutionImpact(10);
check('only home subs counted', si.count, 2);
check('matches with subs', si.matches, 2);
check('scored before the first change', si.subs[0].before, 1);
check('scored after the first change', si.subs[0].after, 3);
check('change looks positive', si.subs[0].delta, 2);
check('bench scoring aggregated', si.benchGoals + '-' + si.benchPoints, '1-2');
ok('bench total counts a goal as 3', function(){
  if (si.benchScores !== 5) throw new Error('expected 5, got ' + si.benchScores);
});
loadHistory = _lh2;

// ══ 8d. PHASE C: CONDITIONS AND OPPOSITION STRENGTH ══
group('Opposition strength');
var _lh3 = loadHistory;
loadHistory = function(){ return [
  // Strong side: puts up big scores against us
  { id:1, away:'Strong', homeGoals:0, homePoints:8,  awayGoals:2, awayPoints:12 },
  { id:2, away:'Strong', homeGoals:1, homePoints:9,  awayGoals:1, awayPoints:15 },
  // Mid
  { id:3, away:'Middling', homeGoals:1, homePoints:12, awayGoals:0, awayPoints:12 },
  { id:4, away:'Middling', homeGoals:0, homePoints:14, awayGoals:1, awayPoints:9 },
  // Weak
  { id:5, away:'Weaker', homeGoals:3, homePoints:15, awayGoals:0, awayPoints:5 },
  { id:6, away:'Weaker', homeGoals:2, homePoints:16, awayGoals:0, awayPoints:7 }
];};
var os = oppositionStrength();
check('matches counted per club', os['Strong'].matches, 2);
check('strong side tiered strong', os['Strong'].tier, 'strong');
check('weak side tiered weaker', os['Weaker'].tier, 'weaker');
check('their average against us', os['Weaker'].avgAgainst, 6);
check('our average against them', os['Weaker'].avgFor, 23);   // 3-15=24 and 2-16=22
check('results recorded', os['Weaker'].w + '-' + os['Weaker'].d + '-' + os['Weaker'].l, '2-0-0');
ok('no tier is claimed with too few opponents', function(){
  loadHistory = function(){ return [
    { id:1, away:'OnlyOne', homeGoals:1, homePoints:5, awayGoals:0, awayPoints:8 }
  ];};
  var r = oppositionStrength();
  if (r['OnlyOne'].tier !== null) throw new Error('should not tier with one opponent');
});
loadHistory = _lh3;

group('Conditions in analysis');
ok('conditions appear as context', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:0, homePoints:9, awayGoals:0, awayPoints:11,
    conditions:'Wet and windy', events:[], players:[],
    shots:{home:{play:{point:7,wide:9},free:{point:2,wide:2}},
           away:{play:{point:9,wide:4},free:{point:2,wide:1}}} });
  var ctx = a.sections.find(function(s){ return s.title === 'Context'; });
  if (!ctx) throw new Error('no context section');
  if (ctx.points[0].text.indexOf('Wet and windy') === -1) throw new Error('conditions not mentioned');
});
ok('poor conditions soften a low conversion verdict', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:0, homePoints:9, awayGoals:0, awayPoints:11,
    conditions:'Windy', events:[], players:[],
    shots:{home:{play:{point:7,wide:12},free:{point:2,wide:3}},
           away:{play:{point:9,wide:4},free:{point:2,wide:1}}} });
  var sc = a.sections.find(function(s){ return s.title === 'Scoring'; });
  if (!sc) throw new Error('no scoring section');
  if (sc.points[0].text.indexOf('conditions were against you') === -1)
    throw new Error('conditions caveat missing: ' + sc.points[0].text);
});
ok('good conditions add no caveat', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:0, homePoints:9, awayGoals:0, awayPoints:11,
    conditions:'Good', events:[], players:[],
    shots:{home:{play:{point:7,wide:12},free:{point:2,wide:3}},
           away:{play:{point:9,wide:4},free:{point:2,wide:1}}} });
  var sc = a.sections.find(function(s){ return s.title === 'Scoring'; });
  if (sc.points[0].text.indexOf('conditions were against you') !== -1)
    throw new Error('caveat added when conditions were fine');
});
ok('a match with no conditions still analyses', function(){
  var a = analyseMatch({ home:'A', away:'B', homeGoals:1, homePoints:9,
    awayGoals:0, awayPoints:11, events:[], players:[] });
  if (!a.verdict) throw new Error('no verdict');
});

// ══ 8e. PHASE D: EXPECTED SCORES ══
group('Expected scores model');
var _lh4 = loadHistory;
loadHistory = function(){ return []; };
var model = shotRateModel(true);
check('with no history every zone uses the baseline', model.learned, 0);
check('a close central shot is rated highest', xsForShot('d-line','play',model), 0.70);
check('a shot from midfield is rated lowest', xsForShot('midfield','play',model), 0.20);
ok('a free is rated above a shot from play in the same zone', function(){
  if (!(xsForShot('45-centre','free',model) > xsForShot('45-centre','play',model)))
    throw new Error('frees should be rated higher');
});
check('an unlocated shot cannot be rated', xsForShot(null,'play',model), null);

group('Expected vs actual');
loadHistory = function(){ return []; };
shotRateModel(true);
// 10 shots from d-line (rated 0.70) => expected 7.0
var evs = [];
for (var i=0;i<10;i++) evs.push({ type:'shot', team:'home', shotMode:'play',
  zone:'d-line', outcome: i < 9 ? 'point' : 'wide', half:1 });
var xs = expectedScores(evs, 'home');
check('shots counted', xs.shots, 10);
check('expected total', xs.expected, 7);
check('actual scores', xs.actual, 9);
check('finishing above expectation', xs.diff, 2);
ok('unlocated shots are excluded, not guessed', function(){
  var e2 = evs.concat([{ type:'shot', team:'home', shotMode:'play', outcome:'point', half:1 }]);
  var r = expectedScores(e2, 'home');
  if (r.shots !== 10) throw new Error('unlocated shot was counted');
  if (r.unlocated !== 1) throw new Error('unlocated shot not reported');
});
ok('a team with no located shots returns null, not zero', function(){
  var r = expectedScores([{ type:'shot', team:'home', shotMode:'play', outcome:'point' }], 'home');
  if (r !== null) throw new Error('expected null');
});

group('Model learns from your own data');
// 20 shots from the wing, converted 15 times — well above the 0.28 baseline
var learnEvents = [];
for (var i=0;i<20;i++) learnEvents.push({ type:'shot', team:'home', shotMode:'play',
  zone:'left-wing', outcome: i < 15 ? 'point' : 'wide', half:1 });
loadHistory = function(){ return [{ id:1, events: learnEvents, players: [] }]; };
var m2 = shotRateModel(true);
check('the zone switches to your own rate', m2.source['left-wing|play'].from, 'own');
check('your own rate is used', xsForShot('left-wing','play',m2), 0.75);
check('a thin zone stays on the baseline', m2.source['midfield|play'].from, 'baseline');
ok('sample size threshold is respected', function(){
  var few = [];
  for (var i=0;i<5;i++) few.push({ type:'shot', team:'home', shotMode:'play',
    zone:'d-line', outcome:'point', half:1 });
  loadHistory = function(){ return [{ id:1, events: few, players: [] }]; };
  var m3 = shotRateModel(true);
  if (m3.source['d-line|play'].from !== 'baseline')
    throw new Error('5 shots should not override the baseline');
});

group('Player finishing');
var finEvents = [];
// Player 0: 10 shots from midfield (0.20 each = 2.0 expected), scores 6 -> +4
for (var i=0;i<10;i++) finEvents.push({ type:'shot', team:'home', shotMode:'play',
  zone:'midfield', outcome: i < 6 ? 'point' : 'wide', half:1, player:0 });
// Player 1: 10 shots from d-line (0.70 each = 7.0 expected), scores 4 -> -3
for (var i=0;i<10;i++) finEvents.push({ type:'shot', team:'home', shotMode:'play',
  zone:'d-line', outcome: i < 4 ? 'point' : 'wide', half:1, player:1 });
loadHistory = function(){ return [{ id:1, events: finEvents,
  players:[{name:'Sharp'},{name:'Wasteful'}] }]; };
shotRateModel(true);
var fin = playerFinishing(8);
check('best finisher ranked first', fin[0].name, 'Sharp');
check('over-performance quantified', fin[0].diff, 4);
check('worst finisher ranked last', fin[fin.length-1].name, 'Wasteful');
check('under-performance quantified', fin[fin.length-1].diff, -3);
ok('players below the shot threshold are excluded', function(){
  if (playerFinishing(50).length !== 0) throw new Error('threshold not applied');
});
loadHistory = _lh4;
shotRateModel(true);

// ══ 8f. CUSTOM COMPETITIONS ══
group('Custom competitions');
localStorage.removeItem('cs_custom_comps');
check('starts empty', loadCustomComps().length, 0);
addCustomComp('Dagen Cup');
check('one added', loadCustomComps().length, 1);
check('name stored', loadCustomComps()[0], 'Dagen Cup');
addCustomComp('Dagen Cup');
check('exact duplicate ignored', loadCustomComps().length, 1);
addCustomComp('dagen cup');
check('case-insensitive duplicate ignored', loadCustomComps().length, 1);
addCustomComp('GAA County SFC');
check('built-in competition not duplicated', loadCustomComps().length, 1);
addCustomComp('   ');
check('blank name ignored', loadCustomComps().length, 1);
addCustomComp('  Parish League  ');
check('name is trimmed', loadCustomComps()[0], 'Parish League');
check('newest first', loadCustomComps().length, 2);
ok('removal works', function(){
  var before = loadCustomComps().length;
  loadCustomComps();
  var list = loadCustomComps().filter(function(x){ return x !== 'Dagen Cup'; });
  saveCustomComps(list);
  if (loadCustomComps().length !== before - 1) throw new Error('not removed');
});
ok('custom competitions survive a reload', function(){
  var saved = loadCustomComps();
  var reread = JSON.parse(localStorage.getItem('cs_custom_comps'));
  if (JSON.stringify(saved) !== JSON.stringify(reread)) throw new Error('not persisted');
});
localStorage.removeItem('cs_custom_comps');

// ══ 8g. SAVED PLAYER RECORDS ══
// Regression: the save format writes null for empty squad slots, which crashed
// the report and the match detail view with "null is not an object".
group('Player score lines');
check('null slot returns null, not a crash', playerScoreLine(null, 0), null);
check('a nameless slot is skipped', playerScoreLine({ stats:{} }, 0), null);
ok('current format reads stats correctly', function(){
  var l = playerScoreLine({ name:'A', num:7, stats:{ shotsPlay:{goal:1,point:2}, shotsFree:{point:1} } }, 6);
  if (l.goals !== 1) throw new Error('goals ' + l.goals);
  if (l.points !== 3) throw new Error('points ' + l.points);
  if (l.total !== 6) throw new Error('total ' + l.total);
  if (l.num !== 7) throw new Error('num ' + l.num);
});
ok('two-pointers count double', function(){
  var l = playerScoreLine({ name:'B', stats:{ shotsPlay:{twopointer:2} } }, 0);
  if (l.points !== 4) throw new Error('expected 4, got ' + l.points);
});
ok('older flat records still work', function(){
  var l = playerScoreLine({ name:'C', num:3, goals:2, points:5 }, 2);
  if (l.goals !== 2 || l.points !== 5 || l.total !== 11) throw new Error(JSON.stringify(l));
});
ok('a full squad array with nulls does not crash', function(){
  var squadArr = [null, {name:'X', stats:{shotsPlay:{point:3}}}, null, {name:'Y', stats:{}}];
  var out = squadArr.map(function(p,i){ return playerScoreLine(p,i); }).filter(Boolean);
  if (out.length !== 2) throw new Error('expected 2 real players, got ' + out.length);
});

// ══ 8h. NO DOUBLE-COUNTING ══
// Regression: a scoring shot writes both a 'shot' event and a 'goal'/'point'
// event. Anything counting scores from the event log must use only the latter,
// or every score is counted twice — which is what "How it unfolded" was doing.
group('Scores are not double-counted');
resetMatch();
for (var i=0;i<15;i++) squad[i] = { name:'P'+(i+1), pos:'', stats:{} };
function recScore(team, outcome, player) {
  startEvent(team, 'shot', 'play');
  selectShotOutcome(outcome);
  if (pendingEvent) confirmPlayerPick(player);
}
recScore('home','point',6);
ok('one point produces both a shot and a point event', function(){
  var shots  = state.events.filter(function(e){ return e.type === 'shot'; }).length;
  var scores = state.events.filter(function(e){ return e.type === 'point'; }).length;
  if (shots !== 1) throw new Error('shot events: ' + shots);
  if (scores !== 1) throw new Error('point events: ' + scores);
});
check('scoreboard shows one point', state.home.points, 1);
ok('periodScore matches the scoreboard', function(){
  var ps = periodScore('home', 1, 1, 40);
  if (ps.total !== 1) throw new Error('periodScore gave ' + ps.total + ', expected 1');
});
resetMatch();
recScore('home','goal',6);
check('scoreboard shows one goal', state.home.goals, 1);
ok('a goal counts once, not twice', function(){
  var ps = periodScore('home', 1, 1, 40);
  if (ps.goals !== 1) throw new Error('periodScore goals: ' + ps.goals);
  if (ps.total !== 3) throw new Error('periodScore total: ' + ps.total);
});
resetMatch();
recScore('home','twopointer',6);
ok('a two-pointer counts as exactly two', function(){
  var ps = periodScore('home', 1, 1, 40);
  if (ps.points !== 2) throw new Error('expected 2 points, got ' + ps.points);
  if (state.home.points !== 2) throw new Error('scoreboard: ' + state.home.points);
});
resetMatch();
['point','point','goal'].forEach(function(o){ recScore('home', o, 6); });
ok('period totals equal the scoreboard', function(){
  var ps = periodScore('home', 1, 1, 40);
  var board = state.home.goals * 3 + state.home.points;
  if (ps.total !== board) throw new Error('period ' + ps.total + ' vs scoreboard ' + board);
});
ok('scoring runs count each score once', function(){
  resetMatch();
  ['point','point','point'].forEach(function(o){ recScore('away', o, 6); });
  var runs = scoringRuns(3);
  if (!runs.length) throw new Error('no run found');
  if (runs[0].n !== 3) throw new Error('run length ' + runs[0].n + ', expected 3');
});
resetMatch();

// ══ 8i. STATS DO NOT CARRY BETWEEN MATCHES ══
// Regression: resetMatch() was the only thing clearing player stats, and it is
// never called after saving. Stats accumulated across matches, so a report
// could credit a player with a goal scored in a previous game.
group('Player stats are per-match');
resetMatch();
for (var i=0;i<15;i++) squad[i] = { name:'P'+(i+1), pos:'', stats:{} };

function recS(team, mode, outcome, player) {
  startEvent(team, 'shot', mode);
  selectShotOutcome(outcome);
  if (pendingEvent) confirmPlayerPick(player);
}

// Match 1: player 7 scores a goal
recS('home','play','goal',6);
check('match 1 goal recorded', (squad[6].stats.shotsPlay||{}).goal, 1);

// Simulate finishing and starting a fresh match WITHOUT calling resetMatch,
// which is exactly what happens when a coach saves and starts the next game.
state.events = [];
state.home = { goals:0, points:0 };
state.away = { goals:0, points:0 };
startGame();

ok('stale stats are cleared at throw-in', function(){
  var g = (squad[6].stats.shotsPlay || {}).goal || 0;
  if (g !== 0) throw new Error('player still carries ' + g + ' goal(s) from the previous match');
});

// And a goalless match should credit nobody with a goal
recS('home','play','point',6);
recS('home','play','point',9);
ok('a goalless match credits no goals', function(){
  var totalGoals = 0;
  squad.forEach(function(p){
    if (!p || !p.stats) return;
    totalGoals += ((p.stats.shotsPlay||{}).goal||0) + ((p.stats.shotsFree||{}).goal||0);
  });
  if (totalGoals !== 0) throw new Error('players credited with ' + totalGoals + ' goals');
  if (state.home.goals !== 0) throw new Error('scoreboard shows goals');
});
ok('player totals match the scoreboard', function(){
  var sumPts = 0;
  squad.forEach(function(p){
    if (!p || !p.stats) return;
    var sp = p.stats.shotsPlay||{}, sf = p.stats.shotsFree||{};
    sumPts += (sp.point||0)+(sf.point||0)+2*((sp.twopointer||0)+(sf.twopointer||0));
  });
  if (sumPts !== state.home.points)
    throw new Error('players total ' + sumPts + ' but scoreboard says ' + state.home.points);
});
resetMatch();

// ══ 8j. KICKOUT FOULS AND SIDELINE BALLS ══
group('Kickout fouls count correctly');
resetMatch();
state.events = [
  { team:'home', type:'kickout', outcome:'wonClean',  half:1, min:5 },
  { team:'home', type:'kickout', outcome:'foulWon',   half:1, min:9 },   // retained
  { team:'home', type:'kickout', outcome:'breakWon',  half:1, min:13 },
  { team:'home', type:'kickout', outcome:'lossClean', half:1, min:17 },
  { team:'home', type:'kickout', outcome:'foulLost',  half:1, min:21 }   // lost
];
var kr = kickoutRetention('home', 0);
check('foul won counts as retained', kr.won, 3);
check('foul lost counts as lost', kr.lost, 2);
check('retention percentage', kr.pct, 60);
check('KO_WON includes foulWon', KO_WON.indexOf('foulWon') !== -1, true);
check('KO_LOST includes foulLost', KO_LOST.indexOf('foulLost') !== -1, true);
ok('koSum ignores unknown keys', function(){
  if (koSum({ wonClean:2, nonsense:99 }, KO_WON) !== 2) throw new Error('unexpected total');
});
ok('koSum handles a missing bucket', function(){
  if (koSum(null, KO_WON) !== 0) throw new Error('should be 0');
});

group('Sideline balls');
check('sideline config exists', !!GENERIC_CONFIG.sideline, true);
check('four outcomes offered', GENERIC_CONFIG.sideline.outcomes.length, 4);
ok('outcomes distinguish whose sideline it was', function(){
  var keys = GENERIC_CONFIG.sideline.outcomes.map(function(o){ return o.key; });
  ['wonRetained','wonLost','oppRetained','oppWon'].forEach(function(k){
    if (keys.indexOf(k) === -1) throw new Error('missing ' + k);
  });
});
resetMatch();
check('state initialised', typeof state.sideline.home.wonRetained, 'number');

group('Kickout winner tagging');
resetMatch();
for (var i=0;i<15;i++) squad[i] = { name:'P'+(i+1), pos:'', stats:{} };
ok('losing a kickout asks who won it', function(){
  startEvent('home','generic','kickout');
  selectGenericOutcome('lossClean');
  if (!pendingEvent) throw new Error('no pending event after outcome');
  confirmPlayerPick(0);
  // Should still be pending — waiting on the winner
  if (!pendingEvent) throw new Error('committed without asking who won it');
  commitPendingKickout(11);
  var ev = state.events.find(function(e){ return e.type === 'kickout'; });
  if (!ev) throw new Error('kickout not recorded');
  if (ev.wonBy !== 'away-11') throw new Error('winner not attached: ' + ev.wonBy);
});
resetMatch();
ok('skipping the winner still records the kickout', function(){
  startEvent('home','generic','kickout');
  selectGenericOutcome('breakLoss');
  confirmPlayerPick(0);
  commitPendingKickout(null);
  var ev = state.events.find(function(e){ return e.type === 'kickout'; });
  if (!ev) throw new Error('kickout lost when winner skipped');
  if (ev.wonBy) throw new Error('winner should be unset');
});
resetMatch();
ok('winning a kickout does not ask', function(){
  startEvent('home','generic','kickout');
  selectGenericOutcome('wonClean');
  confirmPlayerPick(0);
  if (pendingEvent) throw new Error('should have committed immediately');
  var ev = state.events.find(function(e){ return e.type === 'kickout'; });
  if (!ev) throw new Error('not recorded');
});
resetMatch();

// ══ 8k. MATCH REPORT SECTION ORDER ══
// Regression: the report had accumulated patches over time until the Shot Map
// heading and its actual content ended up ~150 lines apart, with unrelated
// player-stats code printed in between. Sections are now numbered by a
// running counter and emitted in a fixed sequence, checked here directly.
group('Match report section order');
ok('sections appear in the requested order', function(){
  var origOpen = global.window.open;
  var captured = null;
  global.window.open = function(){ return { document: { write: function(h){ captured = h; }, close: function(){} } }; };

  var origLH = loadHistory;
  loadHistory = function(){ return [{
    id:1, savedAt: new Date().toISOString(), home:'A', away:'B',
    homeGoals:1, homePoints:5, awayGoals:0, awayPoints:8,
    possMethod:'counted', homePoss:50, awayPoss:50,
    shots:{ home:{play:{point:5,goal:1,wide:2,short:0,saved:0,blocked:0,twopointer:0},free:{point:0,goal:0,wide:0,short:0,saved:0,blocked:0,twopointer:0}},
            away:{play:{point:8,goal:0,wide:0,short:0,saved:0,blocked:0,twopointer:0},free:{point:0,goal:0,wide:0,short:0,saved:0,blocked:0,twopointer:0}} },
    kickout:{ home:{wonClean:2,breakWon:0,foulWon:1,lossClean:1,breakLoss:0,foulLost:1,shortWon:0,shortLoss:0},
              away:{wonClean:3,breakWon:0,foulWon:0,lossClean:0,breakLoss:0,foulLost:0,shortWon:0,shortLoss:0} },
    ballLost:{ home:{handPass:2,kickPass:0,inContact:0,handling:0,overCarrying:0}, away:{handPass:0,kickPass:0,inContact:0,handling:0,overCarrying:0} },
    ballWon:{ home:{tackle:2,interception:0,inContact:0}, away:{tackle:0,interception:0,inContact:0} },
    events:[], subs:[], matchNotes:'', players:[]
  }]; };
  vaLoadTags = function(){ return []; };

  generateMatchReport(1);
  var titles = (captured.match(/<h2[^>]*>[^<]+<\\/h2>/g) || []).map(function(t){ return t.replace(/<[^>]+>/g,''); });
  var expected = ['1. Match Summary','2. Team Key Stats','3. Team Stats \u2014 Full Detail',
                  '3a. Shooting Breakdown','3b. Ball Lost','3c. Ball Won','3d. Kickout Battle'];
  for (var i = 0; i < expected.length; i++) {
    if (titles[i] !== expected[i]) throw new Error('position ' + i + ': got "' + titles[i] + '", expected "' + expected[i] + '"');
  }

  loadHistory = origLH;
  global.window.open = origOpen;
});
ok('Kickout Battle table includes the new foul outcomes', function(){
  var origOpen = global.window.open;
  var captured = null;
  global.window.open = function(){ return { document: { write: function(h){ captured = h; }, close: function(){} } }; };
  var origLH = loadHistory;
  loadHistory = function(){ return [{
    id:2, savedAt: new Date().toISOString(), home:'A', away:'B',
    homeGoals:0, homePoints:0, awayGoals:0, awayPoints:0, homePoss:50, awayPoss:50,
    kickout:{ home:{wonClean:0,foulWon:0,lossClean:0,foulLost:0}, away:{} },
    events:[], subs:[], matchNotes:'', players:[]
  }]; };
  vaLoadTags = function(){ return []; };
  generateMatchReport(2);
  if (captured.indexOf('Foul Won') === -1) throw new Error('Foul Won missing from report');
  if (captured.indexOf('Foul Lost') === -1) throw new Error('Foul Lost missing from report');
  loadHistory = origLH;
  global.window.open = origOpen;
});

// ══ 8l. PENALTY CONCEDED ══
group('Penalty scoreboard direction');
resetMatch();
for (var i=0;i<15;i++) squad[i] = { name:'P'+(i+1), pos:'', stats:{} };

function concedeFoul(team, outcome, player) {
  startEvent(team, 'generic', 'foul');
  selectGenericOutcome(outcome);
  if (pendingEvent) confirmPlayerPick(player);
}

ok('a normal foul (not a penalty) does not touch the scoreboard', function(){
  var hb = state.home.points, ab = state.away.points;
  concedeFoul('home','cynical',3);
  if (state.home.points !== hb || state.away.points !== ab) throw new Error('scoreboard moved');
});

resetMatch();
ok('My Team conceding a penalty scored as a GOAL credits the OPPOSITION', function(){
  concedeFoul('home','penalty',3);          // My Team commits the foul
  if (!pendingEvent) throw new Error('penalty did not pause for a result');
  commitPenaltyResult('goal');
  if (state.home.goals !== 0) throw new Error('conceding team should not gain a goal');
  if (state.away.goals !== 1) throw new Error('opposition should have the goal, got ' + state.away.goals);
});

resetMatch();
ok('My Team conceding a penalty scored as a POINT credits the OPPOSITION', function(){
  concedeFoul('home','penalty',3);
  commitPenaltyResult('point');
  if (state.away.points !== 1) throw new Error('opposition should have the point');
  if (state.home.points !== 0) throw new Error('conceding team should not gain a point');
});

resetMatch();
ok('the Opposition conceding a penalty credits MY TEAM', function(){
  concedeFoul('away','penalty',null);
  commitPenaltyResult('goal');
  if (state.home.goals !== 1) throw new Error('my team should have the goal, got ' + state.home.goals);
  if (state.away.goals !== 0) throw new Error('opposition should not gain from their own concession');
});

resetMatch();
ok('a missed penalty records the foul but adds no score', function(){
  concedeFoul('home','penalty',3);
  commitPenaltyResult(null);
  if (state.home.points || state.home.goals || state.away.points || state.away.goals)
    throw new Error('a missed penalty should not change either scoreboard');
  var ev = state.events.find(function(e){ return e.outcome === 'penalty'; });
  if (!ev) throw new Error('the foul itself should still be recorded');
  if (ev.penaltyResult !== 'missed') throw new Error('result not marked missed');
});

resetMatch();
ok('undoing a scored penalty reverses the correct team', function(){
  concedeFoul('home','penalty',3);
  commitPenaltyResult('goal');
  var ev = state.events.find(function(e){ return e.outcome === 'penalty'; });
  deleteEvent(ev.id);
  if (state.away.goals !== 0) throw new Error('undo should have removed the away goal, still shows ' + state.away.goals);
});

resetMatch();
ok('the foul tally itself is credited to the conceding team, not the scorer', function(){
  concedeFoul('home','penalty',3);
  commitPenaltyResult('goal');
  if (state.foul.home.penalty !== 1) throw new Error('conceding team should carry the foul stat');
  if (state.foul.away.penalty !== 0) throw new Error('the team that did not foul should not gain a foul stat');
});
resetMatch();

// ══ 8m. RESET CLEARS EVERYTHING (regression) ══
// Found while testing penalties: resetMatch() never cleared foul, turnover,
// mark or cards, so those stats silently carried into the next match — the
// same class of bug already fixed for player stats. Also the kickout reset
// was missing the foulWon/foulLost keys added alongside Foul Won/Foul Lost.
group('resetMatch clears every category');
resetMatch();
state.foul.home.penalty = 3;
state.foul.home.cynical = 2;
state.turnover.home.midfield = 4;
state.mark.home.won = 5;
state.cards.home.yellow = 2;
state.kickout.home.foulWon = 3;
state.kickout.home.foulLost = 1;
resetMatch();
check('foul.penalty cleared', state.foul.home.penalty, 0);
check('foul.cynical cleared', state.foul.home.cynical, 0);
check('turnover cleared', state.turnover.home.midfield, 0);
check('mark cleared', state.mark.home.won, 0);
check('cards cleared', state.cards.home.yellow, 0);
check('kickout foulWon cleared', state.kickout.home.foulWon, 0);
check('kickout foulLost cleared', state.kickout.home.foulLost, 0);
ok('kickout retention still works after reset (keys still present, not deleted)', function(){
  var r = kickoutRetention('home', 0);
  if (r.total !== 0) throw new Error('expected a clean slate');
});

// ══ 8n. SUBSTITUTIONS ══
// Found via user feedback: the Off/On dropdowns weren't filtered by who was
// actually on the pitch, so picking the wrong name silently failed to swap
// state.pitchOccupant — the sub showed in the timeline, but the old player
// kept showing up in the player picker for every event after.
group('Substitutions keep the pitch and player picker in sync');
resetMatch();
for (var si=0; si<20; si++) squad[si] = { name:'Player'+(si+1), pos:'', stats:{} };
state.pitchOccupant = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];

ok('Off list only offers players currently on the pitch', function(){
  subTeam = 'home';
  renderSubPlayerSelects();
  var offHtml = document.getElementById('sub-off-select').__html || '';
  if (offHtml.indexOf('Player16') !== -1) throw new Error('a bench player (16) should not be a valid "off" pick');
  if (offHtml.indexOf('Player1<') === -1 && offHtml.indexOf('>Player1 ') === -1 && offHtml.indexOf('1 Player1') === -1)
    throw new Error('an on-pitch player (1) should be offered');
});

ok('On list excludes players already on the pitch', function(){
  subTeam = 'home';
  renderSubPlayerSelects();
  var onHtml = document.getElementById('sub-on-select').__html || '';
  if (onHtml.indexOf('value="Player1"') !== -1) throw new Error('an on-pitch player should not be offered as a substitute');
  if (onHtml.indexOf('value="Player16"') === -1) throw new Error('a bench player (16) should be offered as a substitute');
});

ok('a valid substitution updates pitchOccupant so the new player is tagged afterward', function(){
  subTeam = 'home';
  document.getElementById('sub-off-select').value = 'Player1';
  document.getElementById('sub-on-name').value = '';
  document.getElementById('sub-on-select').value = 'Player16';
  document.getElementById('sub-minute').value = '50';
  saveSubstitution();
  if (state.pitchOccupant[0] !== 15) throw new Error('position 1 should now hold squad index 15 (Player16), got ' + state.pitchOccupant[0]);
  var html = buildPlayerGridHTML('home', 'confirmPlayerPick');
  if (html.indexOf('Player16') === -1) throw new Error('the substitute should now appear in the event player picker');
  if (html.indexOf('confirmPlayerPick(15)') === -1) throw new Error('the picker should reference the substitute\\'s squad index');
});

resetMatch();
for (var sj=0; sj<20; sj++) squad[sj] = { name:'Player'+(sj+1), pos:'', stats:{} };
state.pitchOccupant = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
ok('subbing off someone not on the pitch does not silently corrupt pitchOccupant', function(){
  subTeam = 'home';
  var before = state.pitchOccupant.slice();
  // Bypass the (now-filtered) dropdown to simulate the old bug directly —
  // typing a bench player's name straight into the off field.
  document.getElementById('sub-off-select').value = 'Player16';
  document.getElementById('sub-on-name').value = 'Player17';
  document.getElementById('sub-on-select').value = '';
  document.getElementById('sub-minute').value = '10';
  saveSubstitution();
  if (JSON.stringify(state.pitchOccupant) !== JSON.stringify(before))
    throw new Error('pitchOccupant should be unchanged when the "off" player was never on the pitch');
});

resetMatch();
ok('opening Select Starting 15 mid-match redirects rather than silently editing the pitch', function(){
  for (var sk=0; sk<16; sk++) squad[sk] = { name:'Player'+(sk+1), pos:'', stats:{} };
  state.pitchOccupant = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  gamePhase = 'first_half';
  tsDraft = null;
  openTeamSelector();
  if (tsDraft !== null) throw new Error('team selector should not open a live edit session mid-match');
  gamePhase = 'pregame';
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
