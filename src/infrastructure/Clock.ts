export interface Clock {
  now(): number;
}

export interface ManualClock extends Clock {
  advance(ms: number): void;
  set(epochMs: number): void;
}

export function SystemClock(): Clock {
  return { now: () => Date.now() };
}

export function ManualClock(startAt: number = 0): ManualClock {
  let current = startAt;
  return {
    now: () => current,
    advance: (ms) => {
      if (ms < 0) throw new Error('Cannot rewind ManualClock');
      current += ms;
    },
    set: (epochMs) => {
      current = epochMs;
    },
  };
}
