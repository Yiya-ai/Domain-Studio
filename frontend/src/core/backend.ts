import type { BackendResult, CheckResult, EngineOptions, TldRegistry } from '../types';

export function isBackendResult(value: unknown): value is BackendResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (typeof data.domain !== 'string' || typeof data.tld !== 'string'
    || typeof data.available !== 'boolean' || typeof data.source !== 'string'
    || typeof data.checked_at !== 'string' || !Number.isFinite(Date.parse(data.checked_at))) return false;
  if (data.error !== undefined && typeof data.error !== 'string') return false;
  if (data.registration !== undefined && data.registration !== null) {
    if (typeof data.registration !== 'object' || Array.isArray(data.registration)) return false;
    const registration = data.registration as Record<string, unknown>;
    for (const key of ['registrar', 'created', 'expires']) {
      if (registration[key] !== undefined && typeof registration[key] !== 'string') return false;
    }
    for (const key of ['nameservers', 'status']) {
      const list = registration[key];
      if (list !== undefined && (!Array.isArray(list) || !list.every(item => typeof item === 'string'))) return false;
    }
  }
  return true;
}

/** Interpret the Go engine conservatively; DNS absence is never availability. */
export function mapBackendResult(data: BackendResult, domain: string, registry: TldRegistry): CheckResult {
  const tld = data.tld || domain.slice(domain.lastIndexOf('.') + 1);
  const config = registry.tlds.find(item => item.tld === tld);
  const trust = config?.trust ?? (config ? registry.infras[config.infra]?.trust : undefined);
  const source = ['rdap', 'whois', 'dns', 'cache'].includes(data.source) ? data.source : 'server';
  let status: CheckResult['status'] = 'unknown';
  if (!data.error && typeof data.available === 'boolean' && data.domain === domain) {
    if (!data.available && ['rdap', 'whois', 'dns', 'cache'].includes(source)) status = 'taken';
    else if (data.available && source === 'rdap') status = trust === 'high' ? 'available' : 'probably_available';
    else if (data.available && (source === 'whois' || source === 'cache')) status = 'probably_available';
  }
  return {
    domain, tld, status, source: source as CheckResult['source'],
    checkedAt: Number.isFinite(Date.parse(data.checked_at)) ? Date.parse(data.checked_at) : Date.now(),
    latencyMs: data.duration_ms, registration: data.registration,
    note: data.error || undefined,
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function checkBackend(
  domain: string, options: EngineOptions, signal: AbortSignal, fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  const unknown = (note: string): CheckResult => ({ domain, tld: domain.slice(domain.lastIndexOf('.') + 1), status: 'unknown', source: 'server', checkedAt: Date.now(), note });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      signal.throwIfAborted();
      const response = await fetchImpl(`${options.backendUrl}/check?d=${encodeURIComponent(domain)}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]),
        headers: { Accept: 'application/json' },
      });
      if (response.status === 429 && attempt < 3) {
        const header = response.headers.get('Retry-After') ?? '2';
        const seconds = Number(header);
        const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
        // Do not shorten a server-requested delay. Long waits remain abortable.
        await wait(Math.max(1000, Number.isFinite(delay) ? delay : 2000), signal);
        continue;
      }
      if (!response.ok) return unknown(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isBackendResult(data)) return unknown('Invalid server response');
      return mapBackendResult(data, domain, options.registry);
    }
    return unknown('HTTP 429');
  } catch (error) {
    if (signal.aborted) throw error;
    return unknown(error instanceof Error ? error.message : String(error));
  }
}
