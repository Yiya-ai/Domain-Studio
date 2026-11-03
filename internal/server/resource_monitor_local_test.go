package server

import (
	"context"
	"log/slog"
	"sync"
	"testing"
)

// Capture helper expected by the existing upstream monitor lifecycle test.
type resourceCaptureHandler struct {
	mu      sync.Mutex
	records []slog.Record
}

func (h *resourceCaptureHandler) Enabled(context.Context, slog.Level) bool { return true }
func (h *resourceCaptureHandler) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.records = append(h.records, r.Clone())
	return nil
}
func (h *resourceCaptureHandler) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h *resourceCaptureHandler) WithGroup(string) slog.Handler      { return h }
func (h *resourceCaptureHandler) count(level slog.Level, message string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	count := 0
	for _, r := range h.records {
		if r.Level == level && r.Message == message {
			count++
		}
	}
	return count
}
func TestLocalResourceMonitorCritical(t *testing.T) {
	capture := &resourceCaptureHandler{}
	m := NewResourceMonitor(slog.New(capture))
	m.observe(0, 1)
	if len(capture.records) != 0 {
		t.Fatal("normal usage generated an alert")
	}
	m.observe(m.thresholds.HeapCriticalBytes, m.thresholds.GoroutinesCrit)
	if capture.count(slog.LevelError, "process memory above critical threshold") != 1 {
		t.Fatal("critical memory usage did not generate an error")
	}
	if capture.count(slog.LevelError, "process goroutines above critical threshold") != 1 {
		t.Fatal("critical goroutine usage did not generate an error")
	}
}
