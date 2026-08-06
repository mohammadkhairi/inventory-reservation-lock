export enum ReservationState {
  ACTIVE = 'ACTIVE',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export const TERMINAL_STATES: ReadonlySet<ReservationState> = new Set([
  ReservationState.CONFIRMED,
  ReservationState.CANCELLED,
  ReservationState.EXPIRED,
]);

export function isTerminal(state: ReservationState): boolean {
  return TERMINAL_STATES.has(state);
}
