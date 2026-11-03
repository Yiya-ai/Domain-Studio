import { afterEach, describe, expect, it, vi } from 'vitest';
import { isServerWatch, loadServerWatches, saveServerWatches } from '../src/ui/studio';

const watch = { id: '0123456789abcdef', secret: 'a'.repeat(64), domain: 'example.com', webhook_url: 'https://example.com/hook', created_at: '2026-11-03T00:00:00Z', expires_at: '2030-01-01T00:00:00Z' };
afterEach(() => vi.unstubAllGlobals());
describe('watch storage validation', () => {
  it.each([{ last_checked: 123 }, { expires_at: 'broken' }, { delivered: 'false' }, { webhook_url: 'javascript:alert(1)' }, { delivery_failures: -1 }])('rejects corrupt watch %j', patch => {
    expect(isServerWatch({ ...watch, ...patch })).toBe(false);
  });
  it('loads valid watches once without rendering corrupt entries', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([watch, watch, { ...watch, id: 'broken' }]) });
    expect(loadServerWatches()).toEqual([watch]);
  });
  it('does not silently lose watch secrets when storage is full', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('Quota exceeded'); } });
    expect(() => saveServerWatches([watch])).toThrow('Quota exceeded');
  });
});
