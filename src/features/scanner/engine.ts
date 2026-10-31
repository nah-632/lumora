/**
 * The scanner belt — geometry, timing and quality, with no DOM in sight.
 *
 * This file is the whole of the motion logic. The React component measures the
 * stage, feeds numbers in, and writes the strings that come back; everything
 * that can be wrong in a direction (which side the raw material is on, which
 * side of the card is clipped, which way the belt travels) is decided here, once,
 * and tested without a browser.
 *
 * ---------------------------------------------------------------------------
 * FLOW SPACE
 *
 * One coordinate system, and a single mapping to the screen.
 *
 *   u = how far the card's LEADING edge is past the scanner, in the direction of
 *       travel, measured in px. u < 0 means the card has not reached the line
 *       yet; u > 0 means part of it is past.
 *
 * The leading edge is the edge that arrives first: the left edge in RTL (the
 * belt travels leftward) and the right edge in LTR. Every direction difference
 * lives in `screenLeft()`, which is the one place a dir multiplier is applied.
 *
 *   cut = clamp(u, 0, w)      how much of the card has crossed, in px
 *
 * `cut` is direction-free by construction, which is why the clip and the counter
 * need no branch for the two languages.
 */

export type Dir = "rtl" | "ltr";

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** +1 in LTR (flow grows rightward), -1 in RTL (flow grows leftward). */
export function dirSign(dir: Dir): -1 | 1 {
  return dir === "rtl" ? -1 : 1;
}

/** The first card is already this far past the line on the first frame. */
export const INITIAL_PAST = 0.12;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * One position per card, in flow space, wrapped onto the belt.
 *
 *   x_i = mod(off + i·span + span, period) − span        period = span × count
 *
 * Adding `span` before taking the modulus keeps the result inside
 * (−span, period − span], so a card never sits a whole period away.
 */
export function wrapOffsets(off: number, count: number, span: number): number[] {
  const period = span * count;
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = mod(off + i * span + span, period) - span;
  }
  return out;
}

/**
 * The same wrap, written into a preallocated buffer.
 *
 * The render loop calls this once per frame; returning a new array 60 times a
 * second is a small allocation, but the rule for this section is none at all.
 */
export function fillOffsets(
  out: Float64Array | number[],
  off: number,
  count: number,
  span: number,
): void {
  const period = span * count;
  for (let i = 0; i < count; i += 1) {
    out[i] = mod(off + i * span + span, period) - span;
  }
}

/**
 * Arabic-Indic numerals for Arabic, Latin for English.
 *
 * Done by hand rather than with Intl: `toLocaleString` depends on the ICU build
 * the renderer was compiled with, and a server and a browser that disagree about
 * `ar` numbering produce a hydration mismatch in the one number on screen.
 */
const AR_DIGITS = ["\u0660", "\u0661", "\u0662", "\u0663", "\u0664", "\u0665", "\u0666", "\u0667", "\u0668", "\u0669"];

export function localizeDigits(value: number, locale: "ar" | "en"): string {
  const text = String(Math.max(0, Math.round(value)));
  if (locale !== "ar") return text;
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i) - 48;
    out += code >= 0 && code <= 9 ? AR_DIGITS[code] : text[i];
  }
  return out;
}

/** Offsets for the first frame: card 0 is `INITIAL_PAST` past the scanner. */
export function initialOffsets(count: number, span: number): number[] {
  return wrapOffsets(span * INITIAL_PAST, count, span);
}

export interface CardBox {
  /** Screen x of the card's left edge, in px. */
  left: number;
  /** How much of the card is past the line, 0..w. */
  cut: number;
  /** 0..1, cut / w. */
  progress: number;
}

/**
 * The single direction-aware mapping. Everything else is direction-free.
 *
 * RTL: the leading edge is the left edge, so the box starts there.
 * LTR: the leading edge is the right edge, so the box starts one width earlier.
 */
export function cardBox(u: number, w: number, stageW: number, dir: Dir): CardBox {
  const leading = stageW / 2 + dirSign(dir) * u;
  const left = dir === "rtl" ? leading : leading - w;
  const cut = clamp(u, 0, w);
  return { left, cut, progress: w > 0 ? cut / w : 0 };
}

/**
 * `clip-path` strings for a card and its twin result block.
 *
 * The card keeps the part that has NOT crossed; the twin keeps exactly the part
 * that has, so the two together always describe one whole document with the
 * scanner line as the seam. `round` keeps the outer corners of the visible
 * remainder rounded while the seam stays square.
 */
export function clipFor(cut: number, w: number, dir: Dir): { card: string; twin: string } {
  const c = Math.round(clamp(cut, 0, w) * 100) / 100;
  const rest = Math.round((w - c) * 100) / 100;
  if (dir === "rtl") {
    return {
      card: `inset(0 0 0 ${c}px round 16px)`,
      twin: `inset(0 ${rest}px 0 0 round 16px)`,
    };
  }
  return {
    card: `inset(0 ${c}px 0 0 round 16px)`,
    twin: `inset(0 0 0 ${rest}px round 16px)`,
  };
}

/**
 * How many structured items the pill should read for the card crossing now.
 *
 * `progress` is cut / w, so the number grows with the reveal and never exceeds
 * the number of result lines the card actually renders.
 */
export function counterTarget(resultLines: number, progress: number): number {
  return Math.round(clamp(resultLines, 0, 999) * clamp(progress, 0, 1));
}

/** The card under the line: the one with the largest cut that is not complete. */
export function crossingIndex(offsets: ArrayLike<number>, w: number): number {
  let best = -1;
  let bestCut = 0;
  for (let i = 0; i < offsets.length; i += 1) {
    const cut = clamp(offsets[i], 0, w);
    if (cut > bestCut && cut < w) {
      best = i;
      bestCut = cut;
    }
  }
  return best;
}

/** Frame-rate independent easing toward a target. 1 − e^(−rate·dt). */
export function easeToward(current: number, target: number, dtSec: number, rate: number): number {
  const k = 1 - Math.exp(-rate * Math.max(0, dtSec));
  return current + (target - current) * k;
}

/** Hover slows the belt to 35%, eased at 4/s so it never snaps. */
export function hoverFactor(current: number, hovered: boolean, dtSec: number): number {
  return easeToward(current, hovered ? 0.35 : 1, dtSec, 4);
}

/** Pointer inertia: 80% of the instantaneous drag velocity, 20% of the last. */
export function dragVelocity(dx: number, dtMs: number, previous: number): number {
  return (dx / Math.max(8, dtMs)) * 1000 * 0.8 + previous * 0.2;
}

export interface BeltState {
  off: number;
  velocity: number;
  factor: number;
}

export interface BeltConfig {
  period: number;
  /** px per second at full speed (0.05 × viewport width). */
  autoSpeed: number;
  dragging: boolean;
  hovered: boolean;
  /** False while paused, or under reduced motion. */
  auto: boolean;
}

/**
 * Advance the belt by dt seconds.
 *
 * When the belt is paused the drag velocity still decays to rest rather than
 * freezing mid-flight, so releasing a drag while paused settles instead of
 * leaving the belt drifting on the next play.
 */
export function stepBelt(state: BeltState, dtSec: number, cfg: BeltConfig): BeltState {
  const dt = clamp(dtSec, 0, 0.1);
  const factor = cfg.dragging ? 1 : hoverFactor(state.factor, cfg.hovered, dt);
  const auto = cfg.auto && !cfg.dragging ? cfg.autoSpeed * factor : 0;
  const velocity = state.velocity * Math.exp(-3 * dt);
  const off = mod(state.off + (auto + velocity) * dt, cfg.period);
  return {
    off,
    velocity: Math.abs(velocity) < 0.5 ? 0 : velocity,
    factor,
  };
}

/** Previous/next: move the belt exactly one card, in the travel direction. */
export function stepTarget(off: number, span: number, count: number, steps: number): number {
  const period = span * count;
  return mod(off + steps * span, period);
}

/** The eased path the buttons use to reach a one-card target in ~400ms. */
export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Shortest signed distance from `from` to `to` on a ring of length `period`.
 * Stepping "next" must never travel the long way round.
 */
export function ringDelta(from: number, to: number, period: number): number {
  const d = mod(to - from + period / 2, period) - period / 2;
  return d;
}

/* -------------------------------------------------------------------------
   Particles
   ------------------------------------------------------------------------- */

/** A 32-bit integer hash. Deterministic, allocation-free, no Math.random. */
export function hash32(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const UNIT = 1 / 4294967295;

/** p = (1 − d/R)^1.7 — density falls away from the seam, never a hard edge. */
export function particleProbability(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = 1 - clamp(distance / radius, 0, 1);
  return Math.pow(t, 1.7);
}

/**
 * Is this grid cell lit on this frame?
 *
 * A fifth of the cells blink (their hash is divisible by five) and change nine
 * times a second; the rest hold a stable state, which is what keeps the field
 * from reading as television static.
 */
export function cellLit(
  col: number,
  row: number,
  cardIndex: number,
  distance: number,
  radius: number,
  timeSec: number,
): boolean {
  const p = particleProbability(distance, radius);
  if (p <= 0) return false;
  const cell = hash32(col * 73856093 ^ row * 19349663, cardIndex + 1);
  const blink = cell % 5 === 0;
  if (!blink) return cell * UNIT < p;
  const phase = Math.floor(timeSec * 9);
  const frame = hash32(cell ^ 0x9e3779b9, cardIndex * 31 + phase);
  return frame * UNIT < p;
}

/* -------------------------------------------------------------------------
   Adaptation
   ------------------------------------------------------------------------- */

export type QualityLevel = 0 | 1 | 2 | 3;

/**
 * Decide the next quality level from a 30-frame average.
 *
 * Steps down only. A machine that recovers does not climb back up, because a
 * belt that re-enables its own particles every few seconds is worse than one
 * that stays calm.
 */
export function nextQuality(avgFrameMs: number, level: QualityLevel): QualityLevel {
  if (level === 0 && avgFrameMs > 20) return 1;
  if (level === 1 && avgFrameMs > 20) return 2;
  if (level === 2 && avgFrameMs > 24) return 3;
  return level;
}

/** 1 = full density, 0.5 after the first downgrade, 0 once sparks are gone. */
export function densityFor(level: QualityLevel): number {
  if (level >= 2) return 0.5;
  return 1;
}

export function sparksFor(level: QualityLevel): boolean {
  return level < 2;
}

export function isStatic(level: QualityLevel): boolean {
  return level >= 3;
}

/** Particle grid, capped-DPR backing store, and the spark pool size. */
export const CELL_SIZE = { desktop: 3, mobile: 4 } as const;
export const DPR_CAP = { desktop: 2, mobile: 1.5 } as const;
export const MAX_SPARKS = 48;
