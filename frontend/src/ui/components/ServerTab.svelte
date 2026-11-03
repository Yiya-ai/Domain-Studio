<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import type { BackendMode, BackendResult, ServerWatch, StudioInfo } from '../../types';
  import { backendUrl, backendMode, MODE_KEY, loadServerWatches, saveServerWatches, serverRequest, ServerRequestError, isServerWatch } from '../studio';
  import { isBackendResult, mapBackendResult } from '../../core/backend';
  import { writeJson } from '../settings';
  import { favorites } from '../favorites';
  import { results, registry } from '../store';
  import { clearCache } from '../../core/cache';

  const connected = !!backendUrl();
  let mode = $state<BackendMode>(backendMode());
  let info = $state<StudioInfo | null>(null);
  let health = $state('');
  let error = $state('');
  let busy = $state(false);
  let lookup = $state('');
  let detail = $state<BackendResult | null>(null);
  const detailStatus = $derived(detail ? mapBackendResult(detail, detail.domain, $registry).status : 'unknown');
  const refreshController = new AbortController();
  let domain = $state('');
  let webhook = $state('');
  let watches = $state<ServerWatch[]>(loadServerWatches());
  let importInput: HTMLInputElement;

  function changeMode() {
    writeJson(MODE_KEY, mode);
    // Browser and server results carry different evidence. Recheck on switch.
    clearCache();
    results.set(new Map());
  }
  function persist() { saveServerWatches(watches); }
  async function refresh() {
    if (!connected || busy) return;
    busy = true; error = '';
    try {
      const signal = refreshController.signal;
      info = await serverRequest<StudioInfo>('/studio', { signal });
      const response = await fetch('/health', { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
      const data = await response.json() as { status: string; uptime: string };
      health = `${data.status} · ${data.uptime}`;
      for (let i = 0; i < watches.length; i++) {
        const saved = watches[i];
        if (!saved) continue;
        try {
          const fresh = await serverRequest<ServerWatch>(`/watch/${encodeURIComponent(saved.id)}`, { signal, headers: { 'X-Watch-Secret': saved.secret } });
          const updated = { ...fresh, secret: saved.secret };
          if (!isServerWatch(updated)) throw new Error(t('studio.invalidResponse'));
          watches[i] = updated;
        } catch (e) { error = `${saved.domain}: ${e instanceof Error ? e.message : String(e)}`; }
      }
      if (signal.aborted) return;
      persist();
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { busy = false; }
  }
  async function inspect() {
    if (!lookup.trim() || busy) return;
    busy = true; error = ''; detail = null;
    try {
      const response: unknown = await serverRequest(`/check?d=${encodeURIComponent(lookup.trim())}`);
      if (!isBackendResult(response)) throw new Error(t('studio.invalidResponse'));
      detail = response;
    }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { busy = false; }
  }
  async function register() {
    if (!domain.trim() || !webhook.trim() || busy) return;
    busy = true; error = '';
    try {
      const watch = await serverRequest<ServerWatch>('/watch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), webhook_url: webhook.trim() }),
      });
      watches = [...new Map([...watches, ...loadServerWatches(), watch].map(item => [item.id, item])).values()];
      persist(); domain = '';
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { busy = false; }
  }
  async function cancel(item: ServerWatch) {
    busy = true; error = '';
    try {
      await serverRequest<void>(`/watch/${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: { 'X-Watch-Secret': item.secret } });
      watches = watches.filter(w => w.id !== item.id); persist();
    } catch (e) {
      if (e instanceof ServerRequestError && e.status === 404) {
        watches = watches.filter(w => w.id !== item.id);
        try { persist(); } catch (storageError) { error = String(storageError); }
      } else { error = e instanceof Error ? e.message : String(e); }
    }
    finally { busy = false; }
  }
  function exportWatches() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, watches }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'domain-studio-watches.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importWatches(event: Event) {
    if (busy) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error(t('studio.invalidBackup'));
      const data = JSON.parse(await file.text()) as { version?: number; watches?: ServerWatch[] };
      if (!data || data.version !== 1 || !Array.isArray(data.watches) || data.watches.length > 1000
        || !data.watches.every(isServerWatch)) throw new Error(t('studio.invalidBackup'));
      watches = [...new Map([...watches, ...data.watches].map(w => [w.id, w])).values()]; persist(); error = '';
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
    input.value = '';
  }
  function status(item: ServerWatch): string {
    if (item.dead) return t('studio.dead');
    if (Date.parse(item.expires_at) < Date.now()) return t('studio.expired');
    if (item.delivered) return t('studio.delivered');
    if (item.delivery_failures) return t('studio.retrying');
    return t('studio.watching');
  }
  const date = (value?: string) => value && !value.startsWith('0001-') ? new Date(value).toLocaleString() : '—';
  onMount(() => { void refresh(); return () => refreshController.abort(); });
</script>

<section class="studio">
  <div class="intro"><h2>{t('tab.server')}</h2><p>{t('studio.intro')}</p></div>
  {#if !connected}
    <p class="notice" data-testid="studio-offline">{t('studio.offline')}</p>
  {/if}
  {#if error}<p class="error" role="alert" data-testid="studio-error">{error}</p>{/if}
  <section class="panel">
    <div class="heading"><h3>{t('studio.engine')}</h3><span class="pill" data-testid="studio-health">{connected ? health || t('studio.connecting') : t('studio.browser')}</span></div>
    <label for="engine-mode">{t('studio.mode')}</label>
    <select id="engine-mode" bind:value={mode} onchange={changeMode} disabled={!connected || busy} data-testid="studio-mode">
      <option value="auto">{t('studio.auto')}</option><option value="browser">{t('studio.browser')}</option><option value="server">{t('studio.server')}</option>
    </select>
    <p class="muted">{t('studio.modeHelp')}</p>
    <div class="actions">
      <button onclick={refresh} disabled={!connected || busy} data-testid="studio-refresh">{t('studio.refresh')}</button>
      {#if connected}<a href="/legacy" target="_blank" rel="noopener noreferrer" data-testid="studio-legacy">{t('studio.legacy')}</a><a href="/metrics" target="_blank" rel="noopener noreferrer" data-testid="studio-metrics">{t('studio.metrics')}</a>{/if}
    </div>
  </section>
  <section class="panel">
    <h3>{t('studio.lookup')}</h3>
    <div class="row"><label for="lookup-domain">{t('studio.domain')}</label><input id="lookup-domain" bind:value={lookup} placeholder="example.com" disabled={!connected} data-testid="studio-lookup-input" /><button onclick={inspect} disabled={!connected || busy || !lookup.trim()} data-testid="studio-lookup">{t('studio.lookup')}</button></div>
    {#if detail}
      <dl data-testid="studio-registration">
        <dt>{t('studio.domain')}</dt><dd>{detail.domain}</dd>
        <dt>{t('studio.evidence')}</dt><dd>{detail.source} · {detail.cached ? t('studio.cached') : t('studio.fresh')}</dd>
        <dt>{t('studio.result')}</dt><dd>{t(`status.${detailStatus}`)}</dd>
        <dt>{t('studio.registrar')}</dt><dd>{detail.registration?.registrar || '—'}</dd>
        <dt>{t('studio.created')}</dt><dd>{detail.registration?.created || '—'}</dd>
        <dt>{t('studio.expires')}</dt><dd>{detail.registration?.expires || '—'}</dd>
        <dt>{t('studio.nameservers')}</dt><dd>{detail.registration?.nameservers?.join(', ') || '—'}</dd>
        <dt>{t('studio.registryStatus')}</dt><dd>{detail.registration?.status?.join(', ') || '—'}</dd>
      </dl>
    {/if}
  </section>
  <section class="panel">
    <h3>{t('studio.watch')}</h3><p class="muted">{t('studio.watchHelp', { minutes: info ? Math.round(info.watch_poll_seconds / 60) : 15 })}</p>
    {#if info && !info.watch_enabled}<p>{t('studio.watchDisabled')}</p>{/if}
    <div class="fields">
      <label for="watch-domain">{t('studio.domain')}<input id="watch-domain" bind:value={domain} list="studio-candidates" placeholder="example.com" data-testid="studio-watch-domain" /></label>
      <datalist id="studio-candidates">{#each [...$favorites].filter(name => name.includes('.')) as name}<option value={name}></option>{/each}</datalist>
      <label for="watch-webhook">{t('studio.webhook')}<input id="watch-webhook" type="url" bind:value={webhook} placeholder="https://example.com/webhook" data-testid="studio-watch-webhook" /></label>
    </div>
    <div class="actions"><button onclick={register} disabled={!info?.watch_enabled || busy || !domain.trim() || !webhook.trim()} data-testid="studio-watch-add">{t('studio.add')}</button><button onclick={exportWatches} disabled={!watches.length} data-testid="studio-watch-export">{t('studio.export')}</button><button onclick={() => importInput.click()} data-testid="studio-watch-import">{t('studio.import')}</button><input class="hidden" type="file" accept="application/json,.json" bind:this={importInput} onchange={importWatches} aria-label={t('studio.import')} data-testid="studio-watch-file" /></div>
    <p class="muted">{t('studio.backupHelp')}</p>
    {#if !watches.length}<p data-testid="studio-watch-empty">{t('studio.empty')}</p>{/if}
    {#each watches as item (item.id)}
      <article class="watch-item" data-testid={`studio-watch-${item.id}`}>
        <div class="heading"><strong>{item.domain}</strong><span class="pill">{status(item)}</span></div>
        <p class="endpoint">{item.webhook_url}</p>
        <p class="muted">{t('studio.lastCheck')}: {date(item.last_checked)} · {t('studio.expires')}: {date(item.expires_at)}</p>
        <button onclick={() => cancel(item)} disabled={!connected || busy} data-testid={`studio-cancel-${item.id}`}>{t('studio.cancel')}</button>
      </article>
    {/each}
  </section>
</section>

<style>
  .studio { display: grid; gap: 20px; padding-block: 24px; }
  h2, h3, p { margin: 0; } h2 { font-size: 24px; } h3 { font-size: 17px; }
  .intro, .panel { display: grid; gap: 14px; }
  .panel { border: 1px solid var(--border); border-radius: 14px; padding: 22px; background: var(--bg-elevated); }
  .heading, .actions, .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .heading { justify-content: space-between; }
  .fields { display: grid; grid-template-columns: 1fr 2fr; gap: 14px; }
  label { display: grid; gap: 8px; font-size: 13px; }
  input, select { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); min-width: 0; }
  button { padding: 9px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  a { color: var(--accent); font-size: 13px; }
  .muted, .intro p { color: var(--text-secondary); font-size: 13px; line-height: 1.7; }
  .pill { background: var(--bg-sunken); border-radius: 30px; padding: 5px 10px; font-size: 12px; }
  .notice, .error { padding: 16px; border: 1px solid var(--border); border-radius: 10px; }
  .error { color: var(--red); } .hidden { display: none; }
  dl { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; font-size: 13px; }
  dt { color: var(--text-secondary); } dd { margin: 0; overflow-wrap: anywhere; }
  .watch-item { display: grid; gap: 10px; border-top: 1px solid var(--border); padding-top: 16px; }
  .watch-item button { justify-self: start; } .endpoint { font-size: 13px; overflow-wrap: anywhere; }
  @media(max-width: 600px) { .fields { grid-template-columns: 1fr; } .panel { padding: 16px; } dl { grid-template-columns: 90px minmax(0, 1fr); } }
</style>
