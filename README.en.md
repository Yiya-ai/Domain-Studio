# Domain Studio

[中文](README.md) | English

A local domain discovery and monitoring workspace combining Domain-Hunter's Svelte interface, generators and prices with domain-check's Go engine, APIs and persistent watches. One executable embeds the web application; the original projects do not need to run alongside it.

Recent debugging fixes and verification are recorded in [DEBUG-FIXES.md](docs/DEBUG-FIXES.md).

## Windows quick start

Download `Domain-Studio-v1.0.0-windows-x64.zip` from this repository's Releases and extract it. Run `start-domain-studio.cmd`, keep its console open, then open `open-domain-studio.url` or http://127.0.0.1:8082/. Stop with Ctrl+C. Restart the service and refresh the page after updating.

The release EXE needs no Go, Node.js or Docker. It binds to localhost only and does not install an autostart service. Source clones do not contain the EXE; build it using the instructions below.

## Features

| Capability | Location |
| --- | --- |
| Bulk availability, TLD expansion, progress, stop/resume | Check |
| Browser RDAP, DNS corroboration, Go RDAP/WHOIS/DNS, automatic fallback | Check / Server & monitoring |
| Combinations, syllables, themes, domain hacks and mutations | Generators |
| Candidate tray, favorites, history, filters, sorting and copying | Check / Generators / Drops |
| Dropped-domain lists and rechecks | Drops |
| Registration, renewal, transfer prices, three-year cost, promotions and premium hints | Prices / results |
| Social username checks and profile links | Social |
| Registrar, creation/expiry dates, nameservers and registry status | Server & monitoring |
| Persistent signed-webhook watches, retries, status, cancellation and credential backups | Server & monitoring |
| Eight original locales, themes and mobile layouts | Global; new features use Chinese/English, with English fallback elsewhere |
| CSV/TSV/Markdown and settings/word-set import/export | Check / Settings |
| JSON API, CLI, MCP, health and Prometheus | API and automation |
| Portable browser-only page | `frontend/dist/index.html` |

## Query modes

Automatic mode uses the browser first and asks the local backend when a result is unknown or failed. Browser mode preserves direct RDAP checks and confidence rules. Server mode routes checks through the local Go API. Switching modes clears cached results.

The original `available`, `probably_available`, `taken`, `unknown`, `error` states remain. WHOIS and low-confidence available responses remain tentative; missing DNS, HTTP errors and malformed data never prove availability. Confirm availability and price with a registrar before purchasing.

API limits remain 60 requests/minute/IP and at most 50 domains per bulk request. Browser batch limits remain unchanged; server mode follows API `Retry-After` delays. The static homepage does not consume query quota.

## Persistent monitoring and privacy

The launcher enables monitoring every 15 minutes, with a default 90-day lifetime and 10 new watches/IP/24 hours. The first check establishes a baseline. A subsequent registered-to-available transition sends one HMAC-SHA256-signed webhook. Verify any notification with a registrar.

Watches survive restart in `data/watches.db` and continue with the browser closed, while the computer and service remain running. No notification destination is preconfigured. Private-network webhook protection is retained. Watch inspection/cancellation requires a per-watch secret sent in a header.

Watch backups restore access to existing watches without creating new tasks. Moving computers requires both the database and browser management credentials; stop the service before copying the database. Explicit watch backups are private.

GitHub social-check tokens stay in page memory only and must be re-entered after reload. Normal settings and browser migration backups exclude them. Watch signing/recovery secrets are necessary private runtime data and are excluded from source and release packages. See [SECURITY.md](SECURITY.md).

## Existing data and migration

This integration does not depend on the original sibling projects. Browser storage is isolated by origin: data from port 8081 does not automatically appear on 8082. Existing settings/word sets can be exported/imported from Settings. For favorites and history, use `scripts/export-browser-data.js` on the old page and `scripts/import-browser-data.js` on the new page as described in [MERGE.md](docs/MERGE.md). These local helpers exclude GitHub tokens and watch credentials. Watch credentials use their separate explicit backup workflow.

## CLI, API and MCP

```powershell
.\bin\domain-studio.exe check google.com --format json
.\bin\domain-studio.exe check example --tlds com,org,dev --format json
.\bin\domain-studio.exe bulk domains.txt --concurrency 3 --format csv
.\bin\domain-studio.exe check example.com --watch --interval 2m
.\bin\domain-studio.exe healthcheck --url http://127.0.0.1:8082/health
```

Service routes include `GET /api/v1/check?d=example.com` (also `tlds=` or `suggest=true`), `POST /api/v1/bulk` with `{"domains":["example.com"]}`, `/api/v1/tlds`, and `POST /api/v1/watch` with `domain`/`webhook_url`. Inspect or delete `/api/v1/watch/{id}` with `X-Watch-Secret`. Diagnostics: `/api/v1/studio`, `/health`, `/metrics`, `/api/v1/crashes`. `/legacy` retains the classic query page.

The original Node CLI and MCP need Node.js 20+:

```sh
node frontend/dist-cli/domain-hunter.mjs generate combinator --roots brand,app --tlds com,io
node frontend/dist-cli/domain-hunter.mjs prices --tlds com,dev,io
node frontend/dist-cli/mcp-server.mjs
```

MCP retains the Domain-Hunter toolset; persistent watches use the HTTP API. See [upstream API documentation](docs/domain-check-upstream.md).

## Build and test

Node.js 20+ and Go 1.26.1+ are required:

```sh
npm --prefix frontend ci
npm run typecheck
npm test
npm run build
npm start
```

The build creates the portable Svelte HTML, Node CLI/MCP and embedded Go executable. Go can be on PATH or specified by `GO_BINARY`; the original local portable toolchain is also detected when present.

Run `go test -timeout 120s ./internal/... ./web ./cmd/domain-check`, `npm run test:e2e` and `npm run test:integration`. Install Chromium from `frontend/` with `npx playwright install chromium`, or set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing browser.

Offline operation is limited to saved data, generators and price snapshots. Live status, pricing and notifications require connectivity; external providers may throttle or fail.

## Release checklist

Build with locked dependencies; pass type, unit, browser and Go tests. Never commit runtime databases, logs, tokens, browser backups, dependencies or generated executables. Review the staged source, then run `python scripts/package-release.py` to generate source/Windows ZIPs and SHA-256 sums. Inspect archives before uploading to Releases. See [RELEASE-AUDIT.md](docs/RELEASE-AUDIT.md).

## Attribution and license

Domain-Hunter by WhiteBite / contributors, revision `40ac90f`, and domain-check by jedarden, revision `c137e60`, are MIT-licensed. The integration also preserves the original local resource-monitor patch. MIT attribution is retained; fonts and dictionary notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
