package server

import (
	"net/http"
	"strings"

	"github.com/jedarden/domain-check/web"
)

// The marker is only injected by the integrated host. Exported HTML stays
// entirely browser-only and never probes arbitrary hosts for a backend.
func studioHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https: blob:; font-src 'self' data:; worker-src blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'")
	html := strings.Replace(web.StudioHTML, "<head>", `<head><meta name="domain-studio-api" content="/api/v1">`, 1)
	_, _ = w.Write([]byte(html))
}
