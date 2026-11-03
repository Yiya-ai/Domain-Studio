import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings, settingsWithoutSecrets, KEYS } from '../src/ui/settings';
import { DEFAULT_SETTINGS } from '../src/types';

afterEach(() => vi.unstubAllGlobals());
describe('release credential privacy', () => {
  it('keeps a usable session token out of saved settings and backup data', () => {
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem });
    const settings = { ...DEFAULT_SETTINGS, githubToken: 'session-test-credential' };
    saveSettings(settings);
    expect(setItem.mock.calls[0]?.[0]).toBe(KEYS.settings);
    expect(setItem.mock.calls[0]?.[1]).not.toContain('session-test-credential');
    expect(settingsWithoutSecrets(settings)).not.toHaveProperty('githubToken');
    expect(settings.githubToken).toBe('session-test-credential');
  });
  it('removes a legacy persisted token while preserving user preferences', () => {
    const store = new Map<string, string>([[KEYS.settings, JSON.stringify({ lang: 'zh', currency: 'EUR', githubToken: 'old-test-credential' })]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value) });
    expect(loadSettings()).toMatchObject({ lang: 'zh', currency: 'EUR', githubToken: '' });
    expect(store.get(KEYS.settings)).not.toContain('old-test-credential');
  });
});
