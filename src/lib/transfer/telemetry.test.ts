import { describe, expect, it } from 'vitest';
import { createTransferTelemetry, formatEta, formatSpeed } from './telemetry';

describe('Transfer Telemetry', () => {
  it('formats speed appropriately in B/s, KB/s, and MB/s', () => {
    expect(formatSpeed(500)).toBe('500 B/s');
    expect(formatSpeed(1500)).toBe('1.5 KB/s');
    expect(formatSpeed(2.5 * 1024 * 1024)).toBe('2.5 MB/s');
    expect(formatSpeed(100 * 1024 * 1024)).toBe('100.0 MB/s');
  });

  it('formats ETA countdown into human-readable strings', () => {
    expect(formatEta(0)).toBe('0s');
    expect(formatEta(45)).toBe('45s');
    expect(formatEta(90)).toBe('1m 30s');
    expect(formatEta(3665)).toBe('1h 1m');
    expect(formatEta(null)).toBe('--');
  });

  it('computes smooth EMA throughput and ETA over time', () => {
    let now = 1000;
    const telemetry = createTransferTelemetry(10 * 1024 * 1024, () => now); // 10MB total

    // First sample at +500ms: transferred 1MB (2MB/s instant)
    now += 500;
    telemetry.update(1024 * 1024);

    expect(telemetry.getSpeed()).toBeGreaterThan(0);
    expect(telemetry.getEta()).not.toBeNull();
    expect(telemetry.getSpeedFormatted()).toContain('/s');

    // Second sample at +500ms: transferred another 1MB (total 2MB)
    now += 500;
    telemetry.update(2 * 1024 * 1024);

    expect(telemetry.getSpeedFormatted()).toMatch(/MB\/s|KB\/s/);
    expect(telemetry.getEta()).toBeGreaterThan(0);
    expect(telemetry.getEtaFormatted()).not.toBe('--');

    // Finished
    telemetry.update(10 * 1024 * 1024);
    expect(telemetry.getEta()).toBe(0);
    expect(telemetry.getEtaFormatted()).toBe('0s');
  });
});
