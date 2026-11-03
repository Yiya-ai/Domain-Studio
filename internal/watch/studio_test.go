package watch

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jedarden/domain-check/internal/domain"
)

func TestWatchQuotaIsAtomic(t *testing.T) {
	store, err := NewStore(filepath.Join(t.TempDir(), "watch.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	manager := NewManager(ManagerConfig{Store: store, MaxWatchesPerIP: 2})
	var wg sync.WaitGroup
	var created atomic.Int32
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := manager.Register(fmt.Sprintf("test%d.com", i), "https://example.com/hook", "127.0.0.1"); err == nil {
				created.Add(1)
			}
		}()
	}
	wg.Wait()
	if created.Load() != 2 {
		t.Fatalf("expected 2 registrations, got %d", created.Load())
	}
}

type studioChecker struct{ result *domain.DomainResult }

func TestRetryDoesNotNotifyForTakenOrInvalidResults(t *testing.T) {
	for _, tc := range []struct {
		name   string
		result *domain.DomainResult
		reset  bool
	}{
		{"taken", &domain.DomainResult{Domain: "example.com", Available: false}, true},
		{"error", &domain.DomainResult{Domain: "example.com", Available: true, Error: "timeout"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, err := NewStore(filepath.Join(t.TempDir(), "watch.db"))
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			manager := NewManager(ManagerConfig{Store: store, Checker: studioChecker{tc.result}})
			item, err := manager.Register("example.com", "https://example.com/hook", "127.0.0.1")
			if err != nil {
				t.Fatal(err)
			}
			item.LastStatus = "available"
			item.DeliveryFailures = 1
			item.LastDeliveryAttempt = time.Now().Add(-2 * time.Hour)
			ctx, cancel := context.WithCancel(context.Background())
			cancel() // a faulty delivery returns immediately, never sends
			manager.retryWebhookDelivery(ctx, item)
			if tc.reset {
				if item.LastStatus != "taken" || item.DeliveryFailures != 0 {
					t.Fatal("stale notification must be cleared when domain is registered again")
				}
			} else if item.DeliveryFailures != 1 {
				t.Fatal("invalid result must not be delivered or counted as a failed delivery")
			}
		})
	}
}

func (c studioChecker) Check(context.Context, string) (*domain.DomainResult, error) {
	return c.result, nil
}

func TestStudioWatchBaselineAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "watch.db")
	store, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	manager := NewManager(ManagerConfig{Store: store, Checker: studioChecker{&domain.DomainResult{Domain: "example.com", Source: domain.SourceRDAP, Available: true, CheckedAt: time.Now()}}})
	item, err := manager.Register("example.com", "https://example.com/hook", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if item.LastStatus != "unknown" {
		t.Fatal("must not invent registered baseline")
	}
	manager.checkWatch(context.Background(), item) // no webhook client: an erroneous delivery panics
	if item.Delivered || item.LastStatus != "available" {
		t.Fatal("initial check must establish baseline only")
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	saved, err := reopened.Get(item.ID)
	if err != nil || saved.Secret != item.Secret || saved.LastStatus != "available" {
		t.Fatal("watch did not survive reopening")
	}
}

func TestStudioWatchIgnoresErrorResult(t *testing.T) {
	manager := NewManager(ManagerConfig{Checker: studioChecker{&domain.DomainResult{Error: "DNS timeout"}}})
	item := &WatchData{Domain: "example.com", LastStatus: "available"}
	manager.checkWatch(context.Background(), item)
	if item.LastStatus != "available" || !item.LastChecked.IsZero() {
		t.Fatal("error changed watch baseline")
	}
}
