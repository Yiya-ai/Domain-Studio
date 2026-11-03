import { test, expect } from '@playwright/test';
import { mockAll } from '../e2e/helpers/mocks';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort());
  await mockAll(page, { bootstrap: null, porkbun: null, cloudflare: null });
  await page.addInitScript(() => localStorage.setItem('dh:v1:settings', JSON.stringify({ lang: 'zh' })));
});

test('embedded host, engine selection, server check and registration details', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/check?*', route => route.fulfill({ json: {
    domain: 'google.com', tld: 'com', available: false, source: 'rdap', checked_at: new Date().toISOString(),
    registration: { registrar: 'Test Registrar', expires: '2030-01-01', nameservers: ['ns1.google.com'] },
  } }));
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("worker-src blob:");
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.getByTestId('app-tab-server').click();
  await expect(page.getByTestId('studio-health')).toContainText(/ok|degraded/);
  await page.getByTestId('studio-mode').selectOption('server');
  await page.getByTestId('studio-lookup-input').fill('google.com');
  await page.getByTestId('studio-lookup').click();
  await expect(page.getByTestId('studio-registration')).toContainText('Test Registrar');
  await page.getByTestId('app-tab-check').click();
  await page.getByTestId('check-input-domains').fill('google.com');
  await page.getByTestId('check-button-start').click();
  await expect(page.getByTestId('results-row-google-com')).toContainText('已注册');
  expect(errors).toEqual([]);
});

test('watch creation, status refresh, export, reload and cancellation', async ({ page }) => {
  const id = '0123456789abcdef';
  const secret = 'a'.repeat(64);
  let registered = false;
  const watch = { id, secret, domain: 'example.com', webhook_url: 'https://example.com/hook', created_at: new Date().toISOString(), expires_at: '2030-01-01T00:00:00Z' };
  await page.route('**/api/v1/watch', async route => {
    expect(route.request().postDataJSON()).toEqual({ domain: 'example.com', webhook_url: 'https://example.com/hook' });
    registered = true; await route.fulfill({ status: 201, json: watch });
  });
  await page.route('**/api/v1/watch/*', async route => {
    expect(route.request().headers()['x-watch-secret']).toBe(secret);
    expect(route.request().url()).not.toContain(secret);
    if (route.request().method() === 'DELETE') { registered = false; await route.fulfill({ status: 204 }); }
    else await route.fulfill({ json: { ...watch, secret: '', last_status: 'taken', last_checked: new Date().toISOString() } });
  });
  await page.goto('/'); await page.getByTestId('app-tab-server').click();
  await page.getByTestId('studio-watch-domain').fill('example.com');
  await page.getByTestId('studio-watch-webhook').fill('https://example.com/hook');
  await page.getByTestId('studio-watch-add').click();
  await expect(page.getByTestId(`studio-watch-${id}`)).toBeVisible();
  expect(registered).toBe(true);
  const download = page.waitForEvent('download');
  await page.getByTestId('studio-watch-export').click();
  expect((await download).suggestedFilename()).toBe('domain-studio-watches.json');
  await page.reload(); await page.getByTestId('app-tab-server').click();
  await expect(page.getByTestId(`studio-watch-${id}`)).toBeVisible();
  await page.getByTestId('studio-refresh').click();
  await page.getByTestId(`studio-cancel-${id}`).click();
  await expect(page.getByTestId('studio-watch-empty')).toBeVisible();
  expect(registered).toBe(false);
});

test('backend failure stays unknown, mobile tabs remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/check?*', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/'); await page.getByTestId('app-tab-server').click();
  await page.getByTestId('studio-mode').selectOption('server');
  await page.getByTestId('app-tab-check').click();
  await page.getByTestId('check-input-domains').fill('example.com');
  await page.getByTestId('check-button-start').click();
  await expect(page.getByTestId('results-row-example-com')).toContainText('未知');
  await page.getByTestId('app-tab-server').click();
  await expect(page.getByTestId('studio-watch-domain')).toBeVisible();
  await page.screenshot({ path: '../docs/studio-mobile.png', fullPage: true });
});

test('Chinese integrated workspace screenshot', async ({ page }) => {
  await page.goto('/'); await page.getByTestId('app-tab-server').click();
  await expect(page.getByTestId('studio-refresh')).toBeEnabled();
  await page.screenshot({ path: '../docs/studio-desktop.png', fullPage: true });
});

test('cancels an already deleted server watch locally but retains forbidden watches', async ({ page }) => {
  const item = { id: 'fedcba9876543210', secret: 'b'.repeat(64), domain: 'example.com', webhook_url: 'https://example.com/hook', created_at: '2026-11-03T00:00:00Z', expires_at: '2030-01-01T00:00:00Z' };
  await page.addInitScript(watch => localStorage.setItem('dh:v1:server-watches', JSON.stringify([watch])), item);
  let status = 403;
  await page.route('**/api/v1/watch/*', route => route.fulfill({ status, json: { message: status === 403 ? 'invalid secret' : 'watch not found' } }));
  await page.goto('/'); await page.getByTestId('app-tab-server').click();
  await page.getByTestId(`studio-cancel-${item.id}`).click();
  await expect(page.getByTestId(`studio-watch-${item.id}`)).toBeVisible();
  status = 404;
  await page.getByTestId(`studio-cancel-${item.id}`).click();
  await expect(page.getByTestId('studio-watch-empty')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dh:v1:server-watches')!))).toEqual([]);
});

test('rejects corrupt watch imports and malformed registration replies without crashing', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/check?*', route => route.fulfill({ json: { available: false, registration: { nameservers: 'bad' } } }));
  await page.goto('/'); await page.getByTestId('app-tab-server').click();
  await expect(page.getByTestId('studio-refresh')).toBeEnabled();
  await page.getByTestId('studio-watch-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, watches: [{ id: '0123456789abcdef', secret: 'a'.repeat(64), domain: 'example.com', webhook_url: 'https://example.com', expires_at: '2030-01-01', last_checked: 123 }] })) });
  await expect(page.getByTestId('studio-error')).toContainText('备份格式');
  await page.getByTestId('studio-lookup-input').fill('example.com');
  await page.getByTestId('studio-lookup').click();
  await expect(page.getByTestId('studio-error')).toContainText('数据格式');
  await expect(page.getByTestId('studio-registration')).toHaveCount(0);
  expect(errors).toEqual([]);
});
