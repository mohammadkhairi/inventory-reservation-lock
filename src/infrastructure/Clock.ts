export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * Deterministic clock for tests. Time only advances when the test calls `advance`.
 */
export class ManualClock implements Clock {
  private current: number;

  constructor(startAt: number = 0) {
    this.current = startAt;
  }

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error('Cannot rewind ManualClock');
    this.current += ms;
  }

  set(epochMs: number): void {
    this.current = epochMs;
  }
}
