declare module "@/domain/bahrain.mjs" {
  export function normalizeBahrainPhone(raw: string): string | null;
  export const BAHRAIN_GOVERNORATES: ReadonlyArray<{ id: string; ar: string; en: string }>;
}
declare module "@/domain/booking-state-machine.mjs" {
  export class IllegalTransitionError extends Error {}
  export function canTransition(from: string, to: string, actor: string): boolean;
  export function assertTransition(from: string, to: string, actor: string): void;
  export const ACTIVE_STATES: string[];
}
declare module "@/data-access/db.mjs" {
  export function q(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
  export function closePool(): Promise<void>;
}
declare module "@/services/booking-service.mjs" {
  export function createBooking(draft: Record<string, unknown>, actor?: string): Promise<{ id: string; reference: string; state: string }>;
  export function transitionBooking(bookingId: string, to: string, actor: string, reason?: string): Promise<{ id: string; state: string }>;
  export function trackBooking(reference: string, phoneLast4: string): Promise<Record<string, unknown> | null>;
}
