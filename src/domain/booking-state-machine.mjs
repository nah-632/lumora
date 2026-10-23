export const BOOKING_STATES = [
  "draft","pending_confirmation","confirmed","assigned",
  "technician_en_route","in_progress","completed","cancelled","rejected"
];

export class IllegalTransitionError extends Error {
  constructor(from, to, actor) {
    super(`Illegal booking transition: ${from} -> ${to} by ${actor}`);
    this.name = "IllegalTransitionError";
    this.from = from; this.to = to; this.actor = actor;
  }
}

const TRANSITIONS = {
  draft: [
    { to: "pending_confirmation", actors: ["customer"] },
    { to: "cancelled", actors: ["customer"] },
  ],
  pending_confirmation: [
    { to: "confirmed", actors: ["admin", "operations"] },
    { to: "rejected", actors: ["admin", "operations"] },
    { to: "cancelled", actors: ["customer", "admin", "operations"] },
  ],
  confirmed: [
    { to: "assigned", actors: ["admin", "operations"] },
    { to: "cancelled", actors: ["customer", "admin", "operations"] },
  ],
  assigned: [
    { to: "technician_en_route", actors: ["provider"] },
    { to: "cancelled", actors: ["admin", "operations"] },
  ],
  technician_en_route: [
    { to: "in_progress", actors: ["provider"] },
    { to: "cancelled", actors: ["admin", "operations"] },
  ],
  in_progress: [{ to: "completed", actors: ["provider", "admin", "operations"] }],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function canTransition(from, to, actor) {
  return (TRANSITIONS[from] || []).some(t => t.to === to && t.actors.includes(actor));
}

export function assertTransition(from, to, actor) {
  if (!canTransition(from, to, actor)) throw new IllegalTransitionError(from, to, actor);
}

export const ACTIVE_STATES = [
  "pending_confirmation","confirmed","assigned","technician_en_route","in_progress"
];

export const CANCELLATION_WINDOW_HOURS = 24;
