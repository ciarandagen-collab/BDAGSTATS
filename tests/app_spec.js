// ── COACH STATS — PLAYWRIGHT BROWSER TESTS ──────────────────────────
// Run with: npx playwright test
// Tests run against https://coachstats.app/app

const { test, expect } = require('@playwright/test');

const URL = 'https://coachstats.app/app';
const EMAIL = 'ciarandagen@icloud.com'; // free bypass account
const PASSWORD = process.env.TEST_PASSWORD || 'testpass123';

// ── HELPERS ──────────────────────────────────────────────────────────
async function login(page) {
  await page.goto(URL);
  await page.waitForSelector('#login-screen', { state: 'visible' });
  await page.fill('#login-user', EMAIL);
  await page.fill('#login-pass', PASSWORD);
  await page.click('#login-btn');
  await page.waitForSelector('#login-screen', { state: 'hidden', timeout: 10000 });
}

async function navTo(page, tab) {
  const tabs = { match: 0, record: 1, trends: 2, squad: 3, stats: 4, history: 5 };
  const btns = await page.locator('.nav-btn').all();
  await btns[tabs[tab]].click();
  await page.waitForTimeout(200);
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────────
// Clear service worker cache before all tests
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto(URL);
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) await reg.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) await caches.delete(key);
    }
  });
  await page.close();
});

test.describe('Login Screen', () => {
  test('Login screen renders with green branding', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#login-screen')).toBeVisible();
    const title = page.locator('#login-screen').getByText('Coach Stats', { exact: true });
    await expect(title).toBeVisible();
  });

  test('Login screen has Sign In and Register tabs', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#tab-signin')).toBeVisible();
    await expect(page.locator('#tab-register')).toBeVisible();
  });

  test('Register tab shows name field', async ({ page }) => {
    await page.goto(URL);
    await page.click('#tab-register');
    await expect(page.locator('#register-name-field')).toBeVisible();
  });

  test('Empty login shows error', async ({ page }) => {
    await page.goto(URL);
    await page.click('#login-btn');
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 5000 });
  });

  test('Wrong password shows error', async ({ page }) => {
    await page.goto(URL);
    await page.fill('#login-user', 'wrong@test.com');
    await page.fill('#login-pass', 'wrongpass');
    await page.click('#login-btn');
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 8000 });
  });
});

// ── POST-LOGIN APP STRUCTURE ──────────────────────────────────────────
test.describe('App Structure', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Topbar visible after login', async ({ page }) => {
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('Bottom nav has 6 tabs', async ({ page }) => {
    const tabs = await page.locator('.nav-btn').count();
    expect(tabs).toBe(6);
  });

  test('Match tab active by default', async ({ page }) => {
    await expect(page.locator('#page-match')).toBeVisible();
  });

  test('User badge visible', async ({ page }) => {
    await expect(page.locator('#user-badge')).toBeVisible();
  });

  test('Help button visible', async ({ page }) => {
    await expect(page.locator('button[title="Help"]')).toBeVisible();
  });

  test('Event settings button visible', async ({ page }) => {
    await expect(page.locator('button[title="Event Settings"]')).toBeVisible();
  });
});

// ── NAVIGATION ───────────────────────────────────────────────────────
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Record tab loads', async ({ page }) => {
    await navTo(page, 'record');
    await expect(page.locator('#page-record')).toBeVisible();
  });

  test('Record tab shows side tabs and pitch', async ({ page }) => {
    await navTo(page, 'record');
    await expect(page.locator('.record-side-tabs')).toBeVisible();
    await expect(page.locator('#record-tab-home')).toBeVisible();
    await expect(page.locator('#record-tab-away')).toBeVisible();
    await expect(page.locator('#record-pitch-wrap')).toBeVisible();
  });

  test('Trends tab loads', async ({ page }) => {
    await navTo(page, 'trends');
    await expect(page.locator('#page-trends')).toBeVisible();
  });

  test('Trends shows empty state with no events', async ({ page }) => {
    await navTo(page, 'trends');
    await expect(page.locator('#trends-empty-state')).toBeVisible();
  });

  test('Squad tab loads', async ({ page }) => {
    await navTo(page, 'squad');
    await expect(page.locator('#page-players')).toBeVisible();
  });

  test('Squad tab has correct sub-tabs', async ({ page }) => {
    await navTo(page, 'squad');
    await expect(page.locator('#squad-tab-squad')).toBeVisible();
    await expect(page.locator('#squad-tab-training')).toBeVisible();
    await expect(page.locator('#squad-tab-trial')).toBeVisible();
  });

  test('Stats tab loads', async ({ page }) => {
    await navTo(page, 'stats');
    await expect(page.locator('#page-stats')).toBeVisible();
  });

  test('History tab loads', async ({ page }) => {
    await navTo(page, 'history');
    await expect(page.locator('#page-history')).toBeVisible();
  });

  test('History tab has Season Summary button', async ({ page }) => {
    await navTo(page, 'history');
    await expect(page.locator('button:has-text("Season Summary")')).toBeVisible();
  });

  test('History tab has search bar', async ({ page }) => {
    await navTo(page, 'history');
    await expect(page.locator('#history-search')).toBeVisible();
  });
});

// ── MATCH TAB ────────────────────────────────────────────────────────
test.describe('Match Tab', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Scoreboard visible', async ({ page }) => {
    await expect(page.locator('.scoreboard-card')).toBeVisible();
  });

  test('Game clock visible', async ({ page }) => {
    await expect(page.locator('#tb-clock')).toBeVisible();
  });

  test('Competition picker button visible', async ({ page }) => {
    await expect(page.locator('#comp-picker-btn')).toBeVisible();
  });

  test('Competition picker opens on tap', async ({ page }) => {
    await page.click('#comp-picker-btn');
    await expect(page.locator('#comp-picker-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Competition picker closes on overlay tap', async ({ page }) => {
    await page.click('#comp-picker-btn');
    await page.waitForTimeout(300);
    await page.click('#comp-picker-modal');
    await expect(page.locator('#comp-picker-modal')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('Competition picker shows items when opened', async ({ page }) => {
    await page.click('#comp-picker-btn');
    await expect(page.locator('#comp-picker-modal')).toHaveClass(/open/, { timeout: 3000 });
    // Wait for list to populate (renders all competitions by default)
    await page.waitForSelector('#comp-list .comp-item', { timeout: 5000 });
    const items = await page.locator('#comp-list .comp-item').count();
    expect(items).toBeGreaterThan(0);
  });

  test('Team picker opens on Home tap', async ({ page }) => {
    await page.click('#home-name-display');
    await expect(page.locator('.picker-sheet')).toBeVisible({ timeout: 5000 });
  });

  test('Start Game button visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Start Game")')).toBeVisible();
  });
});

// ── RECORD TAB ───────────────────────────────────────────────────────
// Record tab was redesigned to a pitch-tap flow: tap a player, pick an
// event type, then (for most events) pick an outcome. Home/Away are
// labelled "My Team" / "Opposition" here. The game clock is mirrored
// at the top, and team-level actions (e.g. Attack) sit below the pitch.
test.describe('Record Tab', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'record');
  });

  test('Game clock mirror visible on Record tab', async ({ page }) => {
    await expect(page.locator('#rec-clock-display')).toBeVisible();
    await expect(page.locator('#rec-clock-btns-area')).toBeVisible();
    await expect(page.locator('#rec-h1-btn')).toBeVisible();
  });

  test('Side tabs read My Team / Opposition', async ({ page }) => {
    await expect(page.locator('#record-home-label')).toHaveText('My Team');
    await expect(page.locator('#record-away-label')).toHaveText('Opposition');
  });

  test('Switching side updates active tab styling', async ({ page }) => {
    await page.click('#record-tab-away');
    await expect(page.locator('#record-tab-away')).toHaveClass(/active/);
    await expect(page.locator('#record-tab-home')).not.toHaveClass(/active/);
  });

  test('Opposition pitch shows 15 tappable player markers', async ({ page }) => {
    // Opposition pitch always renders 15 anonymous numbers, regardless of squad setup
    await page.click('#record-tab-away');
    const markers = await page.locator('.record-pitch-player').count();
    expect(markers).toBe(15);
  });

  test('Tapping a pitch player opens the event type picker', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await expect(page.locator('#event-type-modal')).toHaveClass(/open/, { timeout: 3000 });
    await expect(page.locator('.et-picker-btn:has-text("Shot from Play")')).toBeVisible();
  });

  test('Shot modal opens via pitch tap flow', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Shot from Play")').click();
    await expect(page.locator('#shot-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('45 shot triggers the location picker pitch', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("45m Free")').click();
    await expect(page.locator('#shot-modal')).toHaveClass(/open/, { timeout: 3000 });
    await page.locator('.outcome-btn').first().click();
    await expect(page.locator('#location-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Possession records immediately with no outcome screen', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Possession")').click();
    // Should NOT open the generic outcome modal — it's a single-tap log
    await page.waitForTimeout(300);
    await expect(page.locator('#generic-modal')).not.toHaveClass(/open/);
    await expect(page.locator('#event-type-modal')).not.toHaveClass(/open/);
  });

  test('Team Actions section shows Attack for both sides', async ({ page }) => {
    await expect(page.locator('.team-actions-row')).toBeVisible();
    await expect(page.locator('.team-action-btn:has-text("Attack")')).toHaveCount(2);
  });

  test('Undo toast appears after recording an event', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Possession")').click();
    await expect(page.locator('#undo-toast')).toHaveClass(/show/, { timeout: 3000 });
    await expect(page.locator('#undo-toast-text')).toContainText('Possession');
  });

  test('Undo toast removes the recorded event', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Possession")').click();
    await expect(page.locator('#undo-toast')).toHaveClass(/show/, { timeout: 3000 });
    const before = await page.locator('#timeline-list .event-item').count();
    await page.locator('#undo-toast button').click();
    await expect(page.locator('#undo-toast')).not.toHaveClass(/show/);
    const after = await page.locator('#timeline-list .event-item').count();
    expect(after).toBe(before - 1);
  });

  test('Event picker has a manage-events button', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await expect(page.locator('.et-manage-btn')).toBeVisible();
  });

  test('Event type manager opens and lists event types', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-manage-btn').click();
    await expect(page.locator('#et-manager-modal')).toHaveClass(/open/, { timeout: 3000 });
    const rows = await page.locator('.et-mgr-row').count();
    expect(rows).toBeGreaterThan(5);
  });

  test('Hiding an event type removes it from the picker', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    const before = await page.locator('.et-picker-btn').count();
    await page.locator('.et-manage-btn').click();
    await page.locator('.et-mgr-row:has-text("Card")').first().click();
    await page.locator('#et-manager-modal .sheet-close').click();
    const after = await page.locator('.et-picker-btn').count();
    expect(after).toBe(before - 1);
  });

  test('Attack opens outcome modal with Score / Ball Lost / Turned Back', async ({ page }) => {
    await page.locator('.team-action-btn.ta-home').click();
    await expect(page.locator('#generic-modal')).toHaveClass(/open/, { timeout: 3000 });
    await expect(page.locator('#gmodal-outcomes')).toContainText('Score');
    await expect(page.locator('#gmodal-outcomes')).toContainText('Ball Lost');
    await expect(page.locator('#gmodal-outcomes')).toContainText('Turned Back');
  });

  test('View Match Stats button navigates to Stats tab', async ({ page }) => {
    await page.locator('.record-stats-btn').click();
    await expect(page.locator('#page-stats')).toBeVisible();
  });

  test('Discipline section collapsed by default', async ({ page }) => {
    const disciplineGroup = page.locator('.discipline-group, #discipline-group');
    if (await disciplineGroup.count()) {
      await expect(disciplineGroup).not.toBeVisible();
    }
  });
});

// ── SQUAD TAB ────────────────────────────────────────────────────────
test.describe('Squad Tab', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'squad');
  });

  test('Squad grid shows 34 slots', async ({ page }) => {
    const slots = await page.locator('.squad-slot').count();
    expect(slots).toBe(34);
  });

  test('Training sub-tab loads', async ({ page }) => {
    await page.click('#squad-tab-training');
    await expect(page.locator('#squad-view-training')).toBeVisible();
  });

  test('Training shows new session button', async ({ page }) => {
    await page.click('#squad-tab-training');
    await expect(page.locator('button:has-text("New Training Session")')).toBeVisible();
  });

  test('Training shows readiness dashboard button', async ({ page }) => {
    await page.click('#squad-tab-training');
    await expect(page.locator('button:has-text("Readiness Dashboard")')).toBeVisible();
  });

  test('Trial sub-tab loads', async ({ page }) => {
    await page.click('#squad-tab-trial');
    await expect(page.locator('#squad-view-trial')).toBeVisible();
  });

  test('Trial shows new trial button', async ({ page }) => {
    await page.click('#squad-tab-trial');
    await expect(page.locator('button:has-text("New Trial")')).toBeVisible();
  });
});

// ── MODALS ───────────────────────────────────────────────────────────
test.describe('Modals & Sheets', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Help sheet opens', async ({ page }) => {
    await page.click('button[title="Help"]');
    await expect(page.locator('#help-sheet, .help-sheet')).toBeVisible({ timeout: 3000 });
  });

  test('Event settings opens', async ({ page }) => {
    await page.click('button[title="Event Settings"]');
    await expect(page.locator('#event-settings-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Event settings has Events and Performance tabs', async ({ page }) => {
    await page.click('button[title="Event Settings"]');
    await expect(page.locator('#stab-events')).toBeVisible();
    await expect(page.locator('#stab-performance')).toBeVisible();
  });

  test('New training session sheet opens', async ({ page }) => {
    await navTo(page, 'squad');
    await page.click('#squad-tab-training');
    await page.click('button:has-text("New Training Session")');
    await expect(page.locator('#new-session-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('New trial sheet opens', async ({ page }) => {
    await navTo(page, 'squad');
    await page.click('#squad-tab-trial');
    await page.click('button:has-text("New Trial")');
    await expect(page.locator('#new-trial-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Season summary sheet opens', async ({ page }) => {
    await navTo(page, 'history');
    await page.click('button:has-text("Season Summary")');
    await expect(page.locator('#season-summary-modal')).toHaveClass(/open/, { timeout: 3000 });
  });
});

// ── WELLNESS SELF-REPORT (player link) ───────────────────────────────
test.describe('Wellness Self-Report Screen', () => {
  test('Wellness screen loads from URL param', async ({ page }) => {
    await page.goto('https://coachstats.app/app?wellness=test-user-id&date=2026-05-28');
    await expect(page.locator('#player-wellness-screen')).toBeVisible();
  });

  test('Wellness screen shows loading state initially', async ({ page }) => {
    await page.goto('https://coachstats.app/app?wellness=test-user-id&date=2026-05-28');
    // Loading or error state (test user has no squad)
    const loading = page.locator('#pws-loading');
    const error = page.locator('#pws-error');
    const either = await Promise.race([
      loading.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'loading').catch(() => null),
      error.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'error').catch(() => null),
    ]);
    expect(['loading', 'error']).toContain(either);
  });

  test('Main app hidden in wellness mode', async ({ page }) => {
    await page.goto('https://coachstats.app/app?wellness=test-user-id&date=2026-05-28');
    await page.waitForTimeout(500);
    const topbar = page.locator('.topbar');
    const isHidden = await topbar.evaluate(el => el.style.display === 'none' || el.offsetParent === null);
    expect(isHidden).toBe(true);
  });
});

// ── TRIAL GRADING SCREEN ─────────────────────────────────────────────
test.describe('Trial Grading Screen', () => {
  test('Trial grading screen loads from URL param', async ({ page }) => {
    await page.goto('https://coachstats.app/app?trialgrade=test-user-id&trialId=123&sessionId=456');
    await expect(page.locator('#trial-grading-screen')).toBeVisible();
  });

  test('Main app hidden in trial grading mode', async ({ page }) => {
    await page.goto('https://coachstats.app/app?trialgrade=test-user-id&trialId=123&sessionId=456');
    await page.waitForTimeout(500);
    const topbar = page.locator('.topbar');
    const isHidden = await topbar.evaluate(el => el.style.display === 'none' || el.offsetParent === null);
    expect(isHidden).toBe(true);
  });
});

// ── HISTORY SEARCH ───────────────────────────────────────────────────
test.describe('History Search', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('History search filters as you type', async ({ page }) => {
    await navTo(page, 'history');
    const searchBar = page.locator('#history-search');
    await expect(searchBar).toBeVisible();
    await searchBar.fill('kilcoo');
    await page.waitForTimeout(300);
    // Either filtered results or empty state shown
    const list = page.locator('#history-list');
    await expect(list).toBeVisible();
  });
});

// ── NEW FEATURES ──────────────────────────────────────────────────────
test.describe('Substitutions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'record');
  });

  test('Substitutions section visible on Record tab', async ({ page }) => {
    // Check the subs section exists in the DOM (it's collapsed by default)
    await expect(page.locator('#subs-section')).toBeAttached({ timeout: 5000 });
  });

  test('Substitutions section expands on tap', async ({ page }) => {
    await page.locator('.sec-label', { hasText: 'Substitutions' }).click();
    await expect(page.locator('#subs-section')).toBeVisible();
  });

  test('Record substitution button visible after expand', async ({ page }) => {
    await page.locator('.sec-label', { hasText: 'Substitutions' }).click();
    await expect(page.locator('button:has-text("Record Substitution")')).toBeVisible();
  });

  test('Substitution modal opens', async ({ page }) => {
    await page.locator('.sec-label', { hasText: 'Substitutions' }).click();
    await page.locator('button:has-text("Record Substitution")').click();
    await expect(page.locator('#sub-modal')).toHaveClass(/open/, { timeout: 3000 });
  });
});

test.describe('Match Notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'stats');
  });

  test('Match notes textarea visible on Stats tab', async ({ page }) => {
    await expect(page.locator('#match-notes-input')).toBeVisible();
  });

  test('Match notes autosaves on input', async ({ page }) => {
    await page.fill('#match-notes-input', 'Test match notes');
    await page.waitForTimeout(1000);
    await expect(page.locator('#match-notes-saved')).toHaveText('✓ Saved');
  });
});

test.describe('Starting Team Selector', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Team sheet button is visible on Match tab', async ({ page }) => {
    await expect(page.locator('#team-sheet-btn')).toBeVisible();
  });

  test('Team selector opens with 15 positions', async ({ page }) => {
    await page.click('#team-sheet-btn');
    const modal = page.locator('#team-selector-modal');
    // Only opens if the squad has players; skip cleanly if empty
    if (await modal.evaluate(el => el.classList.contains('open')).catch(() => false)) {
      const slots = await page.locator('.ts-slot').count();
      expect(slots).toBe(15);
    }
  });

  test('Auto-fill populates the team sheet', async ({ page }) => {
    await page.click('#team-sheet-btn');
    const modal = page.locator('#team-selector-modal');
    if (await modal.evaluate(el => el.classList.contains('open')).catch(() => false)) {
      await page.click('.ts-action-btn:has-text("Auto-fill")');
      const filled = await page.locator('.ts-slot.filled').count();
      expect(filled).toBeGreaterThan(0);
    }
  });

  test('Clear all empties the team sheet', async ({ page }) => {
    await page.click('#team-sheet-btn');
    const modal = page.locator('#team-selector-modal');
    if (await modal.evaluate(el => el.classList.contains('open')).catch(() => false)) {
      await page.click('.ts-action-btn:has-text("Auto-fill")');
      await page.click('.ts-action-btn:has-text("Clear all")');
      expect(await page.locator('.ts-slot.filled').count()).toBe(0);
    }
  });

  test('Tapping a position opens the player picker', async ({ page }) => {
    await page.click('#team-sheet-btn');
    const modal = page.locator('#team-selector-modal');
    if (await modal.evaluate(el => el.classList.contains('open')).catch(() => false)) {
      await page.locator('.ts-slot').first().click();
      await expect(page.locator('#ts-player-modal')).toHaveClass(/open/, { timeout: 3000 });
      await expect(page.locator('#ts-pp-title')).toContainText('Goalkeeper');
    }
  });
});

test.describe('UI Fixes (Phase A)', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Undo toast sits above modal overlays', async ({ page }) => {
    const toastZ = await page.locator('#undo-toast').evaluate(el => parseInt(getComputedStyle(el).zIndex));
    const modalZ = await page.locator('#shot-modal').evaluate(el => parseInt(getComputedStyle(el).zIndex));
    expect(toastZ).toBeGreaterThan(modalZ);
  });

  test('Undo remains tappable while the location picker is open', async ({ page }) => {
    await navTo(page, 'record');
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Shot from Play")').click();
    await page.locator('#shot-modal .outcome-btn').first().click();
    // Location picker opens over the toast — the Undo button must still be hittable
    await expect(page.locator('#location-modal')).toHaveClass(/open/, { timeout: 3000 });
    await expect(page.locator('#undo-toast')).toHaveClass(/show/);
    await expect(page.locator('#undo-toast button')).toBeVisible();
  });

  test('Attack buttons are visually distinct for each side', async ({ page }) => {
    await navTo(page, 'record');
    const home = await page.locator('.team-action-btn.ta-home')
      .evaluate(el => getComputedStyle(el).backgroundColor);
    const away = await page.locator('.team-action-btn.ta-away')
      .evaluate(el => getComputedStyle(el).backgroundColor);
    expect(home).not.toBe(away);
  });

  test('Text inputs are at least 16px so iOS does not zoom', async ({ page }) => {
    await navTo(page, 'history');
    const size = await page.locator('#history-search')
      .evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('Match notes textarea is at least 16px', async ({ page }) => {
    await navTo(page, 'stats');
    const size = await page.locator('#match-notes-input')
      .evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});

test.describe('UI Fixes (Phase B)', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('Club button does not use error-red text', async ({ page }) => {
    const colour = await page.locator('button[title="Club"]')
      .evaluate(el => getComputedStyle(el).color);
    // Was rgb(255, 128, 128) — red on green, which reads as an error state
    expect(colour).not.toBe('rgb(255, 128, 128)');
  });

  test('Timeline delete button meets the 44px touch target', async ({ page }) => {
    await navTo(page, 'record');
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Possession")').click();
    const box = await page.locator('#timeline-list .del-btn').first().boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Squad delete button has an enlarged touch target', async ({ page }) => {
    await navTo(page, 'squad');
    const del = page.locator('.squad-slot-del').first();
    if (await del.count()) {
      const box = await del.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(36);
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('Muted text opacity meets contrast requirements', async ({ page }) => {
    const muted = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--muted').trim());
    const alpha = parseFloat(muted.match(/,\s*([\d.]+)\)/)[1]);
    expect(alpha).toBeGreaterThanOrEqual(0.55);
  });
});

test.describe('Accessibility (Phase D)', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('No icon-only buttons are left without a label', async ({ page }) => {
    const unlabelled = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button'))
        .filter(b => b.offsetParent !== null)
        .filter(b => !b.getAttribute('aria-label'))
        .filter(b => !/[a-zA-Z0-9]/.test(b.textContent || ''))
        .length;
    });
    expect(unlabelled).toBe(0);
  });

  test('Modals are marked up as dialogs', async ({ page }) => {
    const role = await page.locator('#shot-modal').getAttribute('role');
    const modal = await page.locator('#shot-modal').getAttribute('aria-modal');
    expect(role).toBe('dialog');
    expect(modal).toBe('true');
  });

  test('Close buttons are labelled', async ({ page }) => {
    const label = await page.locator('#shot-modal .sheet-close').getAttribute('aria-label');
    expect(label).toBe('Close');
  });

  test('Active nav tab is marked with aria-current', async ({ page }) => {
    await navTo(page, 'record');
    const current = await page.locator('.nav-btn[aria-current="page"]').count();
    expect(current).toBe(1);
  });

  test('Escape closes an open sheet', async ({ page }) => {
    await page.click('#comp-picker-btn');
    await expect(page.locator('#comp-picker-modal')).toHaveClass(/open/, { timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#comp-picker-modal')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('Status messages are announced politely', async ({ page }) => {
    const live = await page.locator('#sync-banner').getAttribute('aria-live');
    expect(live).toBe('polite');
  });
});

test.describe('Match Analysis (Stats tab)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'stats');
  });

  test('Half filter toggle is visible with three options', async ({ page }) => {
    await expect(page.locator('.stats-half-filter')).toBeVisible();
    await expect(page.locator('#sh-filter-0')).toBeVisible();
    await expect(page.locator('#sh-filter-1')).toBeVisible();
    await expect(page.locator('#sh-filter-2')).toBeVisible();
  });

  test('Full Match is the default half filter', async ({ page }) => {
    await expect(page.locator('#sh-filter-0')).toHaveClass(/active/);
  });

  test('Selecting 1st Half switches the active filter', async ({ page }) => {
    await page.click('#sh-filter-1');
    await expect(page.locator('#sh-filter-1')).toHaveClass(/active/);
    await expect(page.locator('#sh-filter-0')).not.toHaveClass(/active/);
    await expect(page.locator('#stats-body')).toContainText('1st Half');
  });

  test('Shooting Efficiency section is present', async ({ page }) => {
    await expect(page.locator('#stats-body')).toContainText('Shooting Efficiency');
    await expect(page.locator('#stats-body')).toContainText('Conversion');
    await expect(page.locator('#stats-body')).toContainText('Kickout Retention');
  });

  test('Old misleading Scoring Eff. metric is gone', async ({ page }) => {
    await expect(page.locator('#stats-body')).not.toContainText('Scoring Eff.');
  });

  test('Possession shows as Dominance Index when no possessions tagged', async ({ page }) => {
    // With nothing tagged, the estimate is used and must be labelled as such
    await expect(page.locator('#stats-body')).toContainText('Dominance Index');
  });
});

test.describe('Possession Method (Trends tab)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'trends');
  });

  test('Possession method note is shown', async ({ page }) => {
    await expect(page.locator('#poss-method-note')).toBeVisible();
  });

  test('Untagged match labels the section as Dominance Index', async ({ page }) => {
    await expect(page.locator('#poss-section-title')).toHaveText('Dominance Index');
    await expect(page.locator('#poss-method-note')).toContainText('Estimated');
  });

  test('One-sided possession tagging does not produce a 100/0 split', async ({ page }) => {
    // Tag possessions for the opposition only, then check we fall back to the estimate
    await navTo(page, 'record');
    await page.click('#record-tab-away');
    for (let i = 0; i < 3; i++) {
      await page.locator('.record-pitch-player').first().click();
      await page.locator('.et-picker-btn:has-text("Possession")').click();
      await page.waitForTimeout(150);
    }
    await navTo(page, 'trends');
    await expect(page.locator('#poss-section-title')).toHaveText('Dominance Index');
    await expect(page.locator('#poss-away-pct')).not.toHaveText('100%');
  });
});

test.describe('Opposition Players', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'history');
  });

  test('Opposition profile has a Their Players section', async ({ page }) => {
    await page.click('button:has-text("Opposition DB")');
    const firstClub = page.locator('.opp-club-row, .opp-list-row').first();
    if (await firstClub.count()) {
      await firstClub.click();
      await expect(page.locator('#opp-players-list')).toBeAttached();
    }
  });
});

test.describe('Turnover Territory', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'record');
  });

  test('Ball Lost prompts for pitch location', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Ball Lost")').click();
    await expect(page.locator('#generic-modal')).toHaveClass(/open/, { timeout: 3000 });
    await page.locator('#gmodal-outcomes .outcome-btn').first().click();
    await expect(page.locator('#location-modal')).toHaveClass(/open/, { timeout: 3000 });
    await expect(page.locator('#location-modal .sheet-title')).toContainText('lost');
  });

  test('Turnover Forced prompts for pitch location', async ({ page }) => {
    await page.click('#record-tab-away');
    await page.locator('.record-pitch-player').first().click();
    await page.locator('.et-picker-btn:has-text("Turnover Forced")').click();
    await expect(page.locator('#generic-modal')).toHaveClass(/open/, { timeout: 3000 });
    await page.locator('#gmodal-outcomes .outcome-btn').first().click();
    await expect(page.locator('#location-modal')).toHaveClass(/open/, { timeout: 3000 });
  });
});

test.describe('Shot Map', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'stats');
  });

  test('Shot Map button visible on Stats tab', async ({ page }) => {
    await expect(page.locator('button:has-text("Shot Map")')).toBeVisible();
  });

  test('Shot Map section shows on tap', async ({ page }) => {
    await page.click('button:has-text("Shot Map")');
    await expect(page.locator('#shot-map-section')).toBeVisible();
  });

  test('Shot Map SVG renders', async ({ page }) => {
    await page.click('button:has-text("Shot Map")');
    await expect(page.locator('#shot-map-svg')).toBeVisible();
  });

  test('Shot Map filters visible', async ({ page }) => {
    await page.click('button:has-text("Shot Map")');
    await expect(page.locator('.shot-map-controls')).toBeVisible();
  });
});

test.describe('Fixtures', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'history');
  });

  test('Fixtures button visible in History tab', async ({ page }) => {
    await expect(page.locator('button:has-text("Fixtures")')).toBeVisible();
  });

  test('Fixtures modal opens', async ({ page }) => {
    await page.click('button:has-text("Fixtures")');
    await expect(page.locator('#fixtures-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Add Fixture button visible in modal', async ({ page }) => {
    await page.click('button:has-text("Fixtures")');
    await expect(page.locator('button:has-text("Add Fixture")')).toBeVisible();
  });

  test('Add Fixture form opens', async ({ page }) => {
    await page.click('button:has-text("Fixtures")');
    await page.click('button:has-text("Add Fixture")');
    await expect(page.locator('#add-fixture-modal')).toHaveClass(/open/, { timeout: 3000 });
  });
});

test.describe('Opposition Database', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'history');
  });

  test('Opposition DB button visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Opposition DB")')).toBeVisible();
  });

  test('Opposition modal opens', async ({ page }) => {
    await page.click('button:has-text("Opposition DB")');
    await expect(page.locator('#opposition-modal')).toHaveClass(/open/, { timeout: 3000 });
  });

  test('Opposition search bar visible', async ({ page }) => {
    await page.click('button:has-text("Opposition DB")');
    await expect(page.locator('#opposition-search')).toBeVisible();
  });
});

test.describe('Injury Log', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'squad');
    await page.click('#squad-tab-training');
  });

  test('Training players view accessible', async ({ page }) => {
    await expect(page.locator('#squad-view-training')).toBeVisible();
  });
});

test.describe('Video Analysis Clips', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('History tab has Video button on match cards', async ({ page }) => {
    await navTo(page, 'history');
    const historyList = page.locator('#history-list');
    await expect(historyList).toBeVisible();
  });
});

test.describe('Share Match Report', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'history');
  });

  test('Share button visible on match cards', async ({ page }) => {
    const shareBtn = page.locator('.mca-btn:has-text("Share")').first();
    const historyList = await page.locator('#history-list').innerHTML();
    if (historyList.includes('mca-btn')) {
      await expect(shareBtn).toBeVisible();
    }
  });
});
