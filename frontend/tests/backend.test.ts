import { describe, expect, it, vi } from 'vitest';
import { checkBackend, mapBackendResult } from '../src/core/backend';
import { runQueue } from '../src/core/queue';
import type { BackendResult, EngineEvent, EngineOptions, TldRegistry } from '../src/types';

const registry: TldRegistry = {
  infras: { test: { id: 'test', trust: 'high', rdapBase: 'https://registry.test/domain/', minPauseMs: 0, maxParallel: 2 } },
  tlds: [{ tld: 'com', infra: 'test' }, { tld: 'uk', infra: 'test', trust: 'low' }], hackTlds: [],
};
const options: EngineOptions = { registry, backendUrl: 'http://localhost/api/v1', backendMode: 'server' };
const base: BackendResult = { domain: 'example.com', tld: 'com', source: 'rdap', available: true, checked_at: '2026-11-03T01:00:00Z' };
describe('unified backend evidence mapping', () => {
  it('enforces the global concurrency cap across infrastructures', async () => {
    const multi: TldRegistry = { ...registry, infras: { ...registry.infras, other: { ...registry.infras.test!, id: 'other' } }, tlds: [...registry.tlds, { tld: 'net', infra: 'other' }] };
    let active = 0; let peak = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 20)); active--;
      const domain = new URL(String(url)).searchParams.get('d')!;
      return new Response(JSON.stringify({ ...base, domain, tld: domain.split('.').at(-1) }));
    });
    await runQueue(['example.com', 'example.net'], multi, { ...options, registry: multi, concurrency: 1, fetchImpl }, () => {}, new AbortController().signal);
    expect(peak).toBe(1);
  });
  it('rejects malformed registration arrays instead of passing them to the UI', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...base, registration: { nameservers: 'not-an-array' } })));
    const result = await checkBackend(base.domain, options, new AbortController().signal, fetchImpl);
    expect(result.status).toBe('unknown');
    expect(result.registration).toBeUndefined();
  });
  it.each([
    [{}, 'available'], [{ source: 'whois' }, 'probably_available'],
    [{ source: 'dns' }, 'unknown'], [{ source: 'unrecognized' }, 'unknown'],
    [{ available: false, source: 'dns' }, 'taken'], [{ error: 'timeout' }, 'unknown'],
    [{ domain: 'different.com' }, 'unknown'], [{ source: 'cache' }, 'probably_available'],
    [{ tld: 'uk' }, 'probably_available'],
  ])('preserves confidence for %j', (patch, status) => {
    expect(mapBackendResult({ ...base, ...patch }, base.domain, registry).status).toBe(status);
  });
  it('retains registration details and original evidence', () => {
    const registration = { registrar: 'Example Registrar', nameservers: ['ns.example.com'], expires: '2030-01-01' };
    const result = mapBackendResult({ ...base, available: false, registration, cached: true }, base.domain, registry);
    expect(result.registration).toEqual(registration);
    expect(result.source).toBe('rdap');
  });
  it('HTTP failures and malformed bodies remain unknown', async () => {
    for (const response of [new Response('{}', { status: 503 }), new Response('null'), new Response('not-json')]) {
      const fetchImpl = vi.fn().mockResolvedValue(response);
      expect((await checkBackend(base.domain, options, new AbortController().signal, fetchImpl)).status).toBe('unknown');
    }
  });
  it('abort cancels Retry-After waiting promptly', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const promise = checkBackend(base.domain, options, controller.signal, fetchImpl);
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('server mode runs unknown TLDs and retains progress', async () => {
    const events: EngineEvent[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const domain = new URL(String(url)).searchParams.get('d')!;
      return new Response(JSON.stringify({ ...base, domain, tld: domain.split('.').at(-1), available: false, source: 'whois' }));
    });
    await runQueue(['example.com', 'example.zzz'], registry, { ...options, fetchImpl }, e => events.push(e), new AbortController().signal);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(events.at(-1)).toMatchObject({ type: 'progress', done: 2, total: 2 });
    expect(events.flatMap(e => e.type === 'batch' ? e.results : []).map(r => r.status)).toEqual(['taken', 'taken']);
  });
  it('automatic mode falls back after an unknown browser result', async () => {
    const events: EngineEvent[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith('http://localhost')) return new Response(JSON.stringify({ ...base, source: 'whois', available: false }));
      return new Response('{}', { status: 503 });
    });
    await runQueue([base.domain], registry, { ...options, backendMode: 'auto', maxRetries: 0, fetchImpl }, e => events.push(e), new AbortController().signal);
    expect(events.flatMap(e => e.type === 'batch' ? e.results : [])).toMatchObject([{ status: 'taken', source: 'whois' }]);
  });
});
