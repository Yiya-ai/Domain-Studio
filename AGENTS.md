# Domain Studio

This is the user-requested integration of Domain-Hunter and domain-check.
The Go application at the root embeds the Svelte application in frontend/.
Original projects outside this directory must remain untouched.

Preserve the upstream availability states, localization, portable HTML, CLI,
MCP, rate limits, and feature set. The integration explicitly permits the
same-origin Go API and backend WHOIS capabilities. frontend/SPEC.md describes
the original browser mode; this file and docs/MERGE.md describe the extension.
No new dependencies or CI changes are needed. Keep upstream licenses.

Run frontend typecheck, unit tests, build, and relevant Playwright tests.
Run Go tests and build with the embedded frontend. Test changes to status
interpretation, cancellation, API errors, and authenticated watch access.
