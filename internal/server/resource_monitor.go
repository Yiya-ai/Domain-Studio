package server

import (
	"context"
	"log/slog"
	"runtime"
	"time"
)

// ResourceThresholds defines warning and critical levels for process resources.
// This local implementation restores the module missing from upstream HEAD.
type ResourceThresholds struct {
	HeapWarnBytes     uint64
	HeapCriticalBytes uint64
	GoroutinesWarn    int
	GoroutinesCrit    int
}

type ResourceMonitor struct {
	thresholds ResourceThresholds
	log        *slog.Logger
}

func NewResourceMonitor(log *slog.Logger) *ResourceMonitor {
	return newResourceMonitorWithThresholds(ResourceThresholds{
		HeapWarnBytes:     512 << 20,
		HeapCriticalBytes: 1 << 30,
		GoroutinesWarn:    1000,
		GoroutinesCrit:    10000,
	}, log)
}

func newResourceMonitorWithThresholds(thresholds ResourceThresholds, log *slog.Logger) *ResourceMonitor {
	if log == nil {
		log = slog.Default()
	}
	return &ResourceMonitor{thresholds: thresholds, log: log}
}

func (m *ResourceMonitor) Run(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = resourceMonitorInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var memory runtime.MemStats
			runtime.ReadMemStats(&memory)
			m.observe(memory.HeapAlloc, runtime.NumGoroutine())
		}
	}
}

func (m *ResourceMonitor) observe(heap uint64, goroutines int) {
	t := m.thresholds
	if t.HeapCriticalBytes > 0 && heap >= t.HeapCriticalBytes {
		m.log.Error("process memory above critical threshold", "heap_bytes", heap, "threshold_bytes", t.HeapCriticalBytes)
	} else if t.HeapWarnBytes > 0 && heap >= t.HeapWarnBytes {
		m.log.Warn("process memory above warning threshold", "heap_bytes", heap, "threshold_bytes", t.HeapWarnBytes)
	}
	if t.GoroutinesCrit > 0 && goroutines >= t.GoroutinesCrit {
		m.log.Error("process goroutines above critical threshold", "goroutines", goroutines, "threshold", t.GoroutinesCrit)
	} else if t.GoroutinesWarn > 0 && goroutines >= t.GoroutinesWarn {
		m.log.Warn("process goroutines above warning threshold", "goroutines", goroutines, "threshold", t.GoroutinesWarn)
	}
}
