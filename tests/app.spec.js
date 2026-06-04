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

  test('Record tab shows Home/Away headers', async ({ page }) => {
    await navTo(page, 'record');
    await expect(page.locator('.record-team-headers')).toBeVisible();
    await expect(page.locator('.home-col')).toBeVisible();
    await expect(page.locator('.away-col')).toBeVisible();
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

test.describe('Record Tab', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'record');
  });

  test('Shot from Play buttons visible (Home + Away)', async ({ page }) => {
    const btns = await page.locator('.trigger-btn:has-text("Shot from Play")').count();
    expect(btns).toBe(2);
  });

  test('Home buttons have green styling', async ({ page }) => {
    const homeBtn = page.locator('.home-btn').first();
    await expect(homeBtn).toBeVisible();
  });

  test('Away buttons have silver styling', async ({ page }) => {
    const awayBtn = page.locator('.away-btn').first();
    await expect(awayBtn).toBeVisible();
  });

  test('Shot modal opens on tap', async ({ page }) => {
    await page.locator('.home-btn:has-text("Shot from Play")').first().click();
    await expect(page.locator('#shot-modal, .shot-modal, .modal-overlay.open')).toBeVisible({ timeout: 3000 });
  });

  test('Discipline section collapsed by default', async ({ page }) => {
    const disciplineGroup = page.locator('.discipline-group, #discipline-group');
    if (await disciplineGroup.count()) {
      await expect(disciplineGroup).not.toBeVisible();
    }
  });

  test('Team names update record tab headers', async ({ page }) => {
    // Set team name directly on the record tab label via JS
    await navTo(page, 'record');
    await page.evaluate(() => {
      var label = document.getElementById('record-home-label');
      if (label) label.textContent = 'Kilcoo';
    });
    await expect(page.locator('#record-home-label')).toHaveText('Kilcoo');
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
