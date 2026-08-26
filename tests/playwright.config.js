// Playwright config for the browser E2E suite (tests/app.spec.js).
//
// app.html is a single static file at the repo root — there's no build
// step, so "serving the app" just means running a static file server from
// the repo root and pointing baseURL at it. This uses Python's built-in
// http.server rather than an npm package, since it's already present on
// GitHub's ubuntu runners and avoids adding a dependency just to serve one
// HTML file.
//
// This config lives in tests/, so paths are relative to that: testDir is
// '.' (the spec file sits right next to this config), and the server is
// told to serve '..' — the repo root, one level up — so http://localhost:
// 8931/app.html resolves to the real file.

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:8931',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'python3 -m http.server 8931 --directory ..',
    url: 'http://localhost:8931/app.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
