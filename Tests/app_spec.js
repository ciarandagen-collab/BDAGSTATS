// ── COACH STATS — BROWSER E2E TESTS (Playwright) ─────────────────────
// Run with:  npx playwright test
//
// These test the actual UI in a real browser — clicking through the event
// grid, modals, and player pickers exactly as a coach would, rather than
// calling functions directly the way tests/unit.test.cjs does. They're the
// right layer for catching things a logic test can't: a modal that never
// opens, a selector that silently stops matching after a markup change, a
// click landing on the wrong element.
//
// Every scenario here was written by first running it live against a real
// Chromium instance and confirming it passes — nothing in this file is
// unverified guesswork. If a selector ever drifts from the markup in
// app.html, the fix is to re-check what actually renders (open the file,
// search for the relevant onclick/aria-label/id) rather than guess a new
// one — that mismatch is exactly what these tests exist to catch early.
//
// AUTH: Coach Stats gates everything behind a real Supabase login. Rather
// than needing a live test account (fragile, needs secrets, hits a real
// backend from CI), every test mocks the three Supabase endpoints the app
// actually calls during sign-in and seeds a fake session in localStorage
// before the page loads. This reliably gets past the login screen without
// touching any real backend. If Coach Stats' auth flow changes (a new
// endpoint gets called during sign-in, or the session storage keys change),
// this is the helper to update — see saveSession/initSupabase in app.html.

const { test, expect } = require('@playwright/test');

async function signIn(page) {
  const fakeUser = { id: 'e2e-test-user', email: 'e2e@test.local', user_metadata: { name: 'E2E Coach' } };
  await page.route('**/auth/v1/user', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) }));
  // Every other Supabase REST call (subscription status, club data, etc.)
  // just gets an empty result — the app's own offline/no-data fallbacks
  // handle that gracefully, so there's no need to mock each one individually.
  await page.route('**/rest/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/settings', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/v1/logout', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.addInitScript((user) => {
    localStorage.setItem('cs_token', 'e2e-fake-token');
    localStorage.setItem('cs_user', JSON.stringify(user));
  }, fakeUser);

  await page.goto('/app.html');
  await expect(page.locator('#login-screen')).toBeHidden({ timeout: 5000 });
}

// Small helper: seed a squad and reset match state directly, rather than
// clicking through the club-search picker and Starting 15 screen for every
// single test — that flow is covered on its own in the substitution test
// below, so re-driving it in every scenario would just slow the suite down
// for no extra coverage.
async function seedSquad(page, count) {
  await page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.squad[i] = { name: 'P' + (i + 1), pos: '', stats: {} };
    window.resetMatch();
  }, count);
}

async function goToRecordTab(page) {
  await page.click('.nav-btn:nth-child(2)');
}

test.describe('Recording events', () => {
  test('a point from play updates the scoreboard', async ({ page }) => {
    await signIn(page);
    await seedSquad(page, 1);
    await goToRecordTab(page);

    await page.click('button[aria-label="Shot from Play — My Team"]');
    await page.click('.outcome-btn.ob-point');
    await page.click('.pp-player:not(.empty)');

    await expect(page.locator('#home-pts')).toHaveText('01');
  });

  test('a two-pointer scores 2 and shows as exactly one timeline entry', async ({ page }) => {
    await signIn(page);
    await seedSquad(page, 1);
    await goToRecordTab(page);

    await page.click('button[aria-label="Shot from Play — My Team"]');
    await page.click('.outcome-btn.ob-twoptr');
    await page.click('.pp-player:not(.empty)');

    await expect(page.locator('#home-pts')).toHaveText('02');
    // A two-pointer used to write 3 separate events (1 shot + 2 silent score
    // companions) and the timeline showed all of them — this is the
    // regression test for that fix.
    await expect(page.locator('#timeline-list > div')).toHaveCount(1);
  });
});

test.describe('Kickouts', () => {
  test('a lost kickout asks who won it — never a player from the team that lost it', async ({ page }) => {
    await signIn(page);
    await seedSquad(page, 16);
    await goToRecordTab(page);

    await page.click('button[aria-label="Kickout — My Team"]');
    await page.click('.outcome-btn:has-text("Loss Clean")');

    await expect(page.locator('#kickout-winner-modal')).toHaveClass(/open/);
    // The normal player-pick modal (for tagging someone on the losing team)
    // should never have opened at all — this flow skips straight past it.
    const playerPickOpen = await page.locator('#player-pick-modal.open').isVisible().catch(() => false);
    expect(playerPickOpen).toBe(false);
  });
});

test.describe('Substitutions', () => {
  test('changing a position via Select Starting 15 mid-match logs a real substitution', async ({ page }) => {
    await signIn(page);
    await seedSquad(page, 16);
    await page.evaluate(() => { window.gamePhase = 'first_half'; });

    await page.click('#team-sheet-btn');
    await expect(page.locator('#team-selector-modal')).toHaveClass(/open/);

    await page.click('.ts-slot >> nth=0');
    await page.waitForSelector('#ts-player-modal.open');
    await page.click('.ts-player-row:has-text("P16")');
    await page.click('button:has-text("Confirm Starting 15")');

    await expect(page.locator('#subs-list-record')).toContainText('P16');
  });
});

test.describe('Penalties', () => {
  test('a penalty conceded and scored credits the OPPOSITION, not the conceding team', async ({ page }) => {
    await signIn(page);
    await seedSquad(page, 16);
    await goToRecordTab(page);

    await page.click('button[aria-label="Foul Given — My Team"]');
    await page.click('.outcome-btn:has-text("Penalty")');
    await page.click('.pp-player:not(.empty)');

    await expect(page.locator('#penalty-result-modal')).toHaveClass(/open/);
    await page.click('button:has-text("Goal")');

    await expect(page.locator('#home-goals')).toHaveText('0');
    await expect(page.locator('#away-goals')).toHaveText('1');
  });
});

test.describe('PWA basics', () => {
  test('the manifest link is present and points at manifest.json', async ({ page }) => {
    await signIn(page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');
  });
});
