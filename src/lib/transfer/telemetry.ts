export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${Math.round(bytesPerSecond)} B/s`;
  }
  const kb = bytesPerSecond / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB/s`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return '--';
  if (seconds <= 0) return '0s';

  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const minutes = Math.floor(rounded / 60);
  const remainingSec = rounded % 60;
  if (minutes < 60) {
    return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

export interface TransferTelemetry {
  update: (transferredBytes: number) => void;
  getSpeed: () => number;
  getSpeedFormatted: () => string;
  getEta: () => number | null;
  getEtaFormatted: () => string;
}

export function createTransferTelemetry(
  totalBytes: number,
  nowFn: () => number = Date.now,
): TransferTelemetry {
  let lastTimestamp = nowFn();
  let lastBytes = 0;
  let emaSpeed = 0;
  let etaSeconds: number | null = null;

  return {
    update(transferredBytes: number) {
      if (transferredBytes >= totalBytes) {
        etaSeconds = 0;
        lastBytes = transferredBytes;
        return;
      }

      const currentNow = nowFn();
      const dtMs = Math.max(1, currentNow - lastTimestamp);

      if (dtMs >= 100) {
        const deltaBytes = Math.max(0, transferredBytes - lastBytes);
        const instantSpeed = (deltaBytes / dtMs) * 1000;

        // 1-second smoothing window EMA
        const alpha = Math.min(1, dtMs / 1000);
        if (emaSpeed === 0) {
          emaSpeed = instantSpeed;
        } else {
          emaSpeed = alpha * instantSpeed + (1 - alpha) * emaSpeed;
        }

        const remainingBytes = Math.max(0, totalBytes - transferredBytes);
        if (emaSpeed > 0) {
          etaSeconds = Math.max(0, remainingBytes / emaSpeed);
        } else {
          etaSeconds = null;
        }

        lastTimestamp = currentNow;
        lastBytes = transferredBytes;
      }
    },

    getSpeed(): number {
      return emaSpeed;
    },

    getSpeedFormatted(): string {
      return formatSpeed(emaSpeed);
    },

    getEta(): number | null {
      return etaSeconds;
    },

    getEtaFormatted(): string {
      return formatEta(etaSeconds);
    },
  };
}
