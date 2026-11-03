package server

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jedarden/domain-check/internal/watch"
)

func TestStudioHomeRefreshDoesNotConsumeQueryQuota(t *testing.T) {
	router := setupIntegrationRouter(&mockChecker{})
	for i := 0; i < 15; i++ {
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
		if rr.Code != 200 {
			t.Fatalf("home refresh %d got %d", i, rr.Code)
		}
	}
}

func TestStudioWatchQuotaUsesTrustedIPWithoutPort(t *testing.T) {
	store, err := watch.NewStore(filepath.Join(t.TempDir(), "watch.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	manager := watch.NewManager(watch.ManagerConfig{Store: store, MaxWatchesPerIP: 1})
	handler := ClientIP(false)(http.HandlerFunc(NewWatchHandler(manager, slog.Default()).RegisterWatch))
	for i, want := range []int{201, 429} {
		req := httptest.NewRequest("POST", "/api/v1/watch", strings.NewReader(fmt.Sprintf(`{"domain":"test%d.com","webhook_url":"https://example.com/hook"}`, i)))
		req.RemoteAddr = fmt.Sprintf("127.0.0.1:%d", 1000+i)
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("192.0.2.%d", i+1))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != want {
			t.Fatalf("request %d got %d, want %d", i, rr.Code, want)
		}
	}
}

func TestStudioEmbeddedFrontend(t *testing.T) {
	rr := httptest.NewRecorder()
	SecurityHeaders(http.HandlerFunc(studioHandler)).ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), `name="domain-studio-api"`) || !strings.Contains(rr.Body.String(), "Domain Studio") {
		t.Fatal("unified frontend not served")
	}
	for _, directive := range []string{"connect-src 'self' https:", "worker-src blob:", "frame-ancestors 'none'"} {
		if !strings.Contains(rr.Header().Get("Content-Security-Policy"), directive) {
			t.Fatalf("missing CSP directive %s", directive)
		}
	}
}

func TestStudioWatchAccess(t *testing.T) {
	store, err := watch.NewStore(filepath.Join(t.TempDir(), "watch.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	manager := watch.NewManager(watch.ManagerConfig{Store: store})
	handler := NewWatchHandler(manager, slog.Default())
	item, err := manager.Register("example.com", "https://example.com/webhook", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		secret string
		want   int
	}{{"", 401}, {"wrong", 403}, {item.Secret, 200}} {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v1/watch/"+item.ID, nil)
		req.Header.Set("X-Watch-Secret", tc.secret)
		handler.GetWatch(rr, req)
		if rr.Code != tc.want {
			t.Fatalf("got %d, want %d", rr.Code, tc.want)
		}
		if strings.Contains(rr.Body.String(), item.Secret) || strings.Contains(rr.Body.String(), "127.0.0.1") {
			t.Fatal("watch credential or client IP disclosed")
		}
	}
	if err := manager.Cancel(item.ID, item.Secret); err != nil {
		t.Fatal(err)
	}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/watch/"+item.ID, nil)
	req.Header.Set("X-Watch-Secret", item.Secret)
	handler.GetWatch(rr, req)
	if rr.Code != 404 {
		t.Fatal("canceled watch should not exist")
	}
}

func TestStudioRejectInvalidWatch(t *testing.T) {
	handler := NewWatchHandler(nil, slog.Default())
	for _, body := range []string{
		`{"domain":"not a domain","webhook_url":"https://example.com/hook"}`,
		`{"domain":"example.com","webhook_url":"file:///secret"}`,
		`{"domain":"example.com","webhook_url":"https://user:password@example.com"}`,
	} {
		rr := httptest.NewRecorder()
		handler.RegisterWatch(rr, httptest.NewRequest("POST", "/api/v1/watch", strings.NewReader(body)))
		if rr.Code != 400 {
			t.Fatalf("invalid watch accepted: %s", body)
		}
	}
}
