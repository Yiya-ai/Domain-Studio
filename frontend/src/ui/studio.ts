import type { BackendMode, ServerWatch } from '../types';
import { readJson } from './settings';

export const MODE_KEY = 'dh:v1:backend-mode';
export const WATCH_KEY = 'dh:v1:server-watches';

export class ServerRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function isServerWatch(value: unknown): value is ServerWatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !/^[a-f0-9]{16}$/.test(item.id)
    || typeof item.secret !== 'string' || !/^[a-f0-9]{64}$/.test(item.secret)
    || typeof item.domain !== 'string' || !item.domain.trim()
    || typeof item.webhook_url !== 'string') return false;
  for (const key of ['created_at', 'expires_at']) {
    if (typeof item[key] !== 'string' || !Number.isFinite(Date.parse(item[key]))) return false;
  }
  if (item.last_checked !== undefined && (typeof item.last_checked !== 'string' || !Number.isFinite(Date.parse(item.last_checked)))) return false;
  if (item.last_status !== undefined && typeof item.last_status !== 'string') return false;
  if (['dead', 'delivered'].some(key => item[key] !== undefined && typeof item[key] !== 'boolean')) return false;
  if (item.delivery_failures !== undefined && (typeof item.delivery_failures !== 'number' || !Number.isInteger(item.delivery_failures) || item.delivery_failures < 0)) return false;
  try { return ['http:', 'https:'].includes(new URL(item.webhook_url).protocol); } catch { return false; }
}

export function backendUrl(): string | undefined {
  if (typeof document === 'undefined' || !/^https?:$/.test(location.protocol)) return undefined;
  const marker = document.querySelector<HTMLMetaElement>('meta[name="domain-studio-api"]');
  return marker?.content === '/api/v1' ? `${location.origin}/api/v1` : undefined;
}

export function backendMode(): BackendMode {
  const value = readJson<string>(MODE_KEY);
  return value === 'browser' || value === 'server' ? value : 'auto';
}

export function loadServerWatches(): ServerWatch[] {
  const value = readJson<unknown>(WATCH_KEY);
  if (!Array.isArray(value)) return [];
  return [...new Map(value.filter(isServerWatch).map(item => [item.id, item])).values()];
}

// Credentials must not fail to persist silently: callers surface the error
// while retaining the in-memory list so the user can still export it.
export function saveServerWatches(watches: ServerWatch[]): void { localStorage.setItem(WATCH_KEY, JSON.stringify(watches)); }

export async function serverRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = backendUrl();
  if (!base) throw new Error('Backend unavailable');
  const timeout = AbortSignal.timeout(35_000);
  const response = await fetch(`${base}${path}`, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ServerRequestError(response.status, body?.message || `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
