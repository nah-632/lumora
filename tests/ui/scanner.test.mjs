/**
 * The scanner belt — logic that can be wrong without looking wrong.
 *
 * Four things are tested here, and nothing else:
 *   1. the flow-space mapping, in both directions;
 *   2. the wrap, which is the only reason four cards never collide;
 *   3. the counter's target, which must never exceed the lines on screen;
 *   4. the reduced-motion and pause behaviour of the belt.
 *
 * Plus two drift guards: scanner.css restates `clipFor()` for the
 * server-rendered frame, and the two catalogs must describe the same four cards
 * in the same order with the same number of result lines — a mismatch would make
 * the counter disagree with the card it is counting.
 *
 * Run with: node --test tests/ui/scanner.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const {
  cardBox,
  cellLit,
  clipFor,
  counterTarget,
  crossingIndex,
  dragVelocity,
  easeInOutCubic,
  easeToward,
  fillOffsets,
  hoverFactor,
  initialOffsets,
  localizeDigits,
  nextQuality,
  particleProbability,
  ringDelta,
  stepBelt,
  stepTarget,
  wrapOffsets,
  INITIAL_PAST,
} = await import("../../build-test/scanner-engine.mjs");

const W = 600;
const STAGE = 1200;
const SPAN = W + 60;
const COUNT = 4;

/* ------------------------------------------------------------ flow space --- */

test("cardBox: RTL puts the leading edge on the left and the box to its right", () => {
  // u = 0: the leading (left) edge is on the line, nothing has crossed.
  const at0 = cardBox(0, W, STAGE, "rtl");
  assert.equal(at0.left, STAGE / 2);
  assert.equal(at0.cut, 0);
  assert.equal(at0.progress, 0);

  // u = W/2: half past the line, so the box starts half a card right of it.
  const half = cardBox(W / 2, W, STAGE, "rtl");
  assert.equal(half.left, STAGE / 2 - W / 2);
  assert.equal(half.cut, W / 2);
  assert.equal(half.progress, 0.5);

  // u = W: fully past, the whole box sits left of the line.
  const full = cardBox(W, W, STAGE, "rtl");
  assert.equal(full.left + W, STAGE / 2);
  assert.equal(full.cut, W);
});

test("cardBox: LTR is the same box mirrored around the line", () => {
  for (const u of [-W, 0, W / 3, W / 2, W, 1.5 * W]) {
    const rtl = cardBox(u, W, STAGE, "rtl");
    const ltr = cardBox(u, W, STAGE, "ltr");
    assert.equal(ltr.cut, rtl.cut, `cut differs at u=${u}`);
    assert.ok(Math.abs(rtl.left + ltr.left + W - STAGE) < 1e-9, `not mirrored at u=${u}`);
  }
});

test("cardBox: a card that has not reached the line is whole and unclipped", () => {
  // In LTR the raw side is the LEFT of the line: an un-crossed card approaches
  // from negative x, which is the mirror of the RTL case above.
  const before = cardBox(-SPAN, W, STAGE, "ltr");
  assert.equal(before.cut, 0);
  assert.ok(before.left + W < STAGE / 2, "a raw card in LTR sits left of the line");
  const rawRtl = cardBox(-SPAN, W, STAGE, "rtl");
  assert.equal(rawRtl.cut, 0);
  assert.ok(rawRtl.left > STAGE / 2, "and right of it in RTL");
});

/* ------------------------------------------------------------------ wrap --- */

test("wrap: four cards are always one span apart, whatever the offset", () => {
  for (const off of [0, 12, SPAN * 0.5, SPAN * 3.9, SPAN * 11.3]) {
    const xs = wrapOffsets(off, COUNT, SPAN);
    const sorted = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i] - sorted[i - 1];
      assert.ok(Math.abs(gap - SPAN) < 1e-9, `gap ${gap} at off=${off}`);
    }
  }
});

test("wrap: one full period is the same picture", () => {
  const a = wrapOffsets(37, COUNT, SPAN);
  const b = wrapOffsets(37 + SPAN * COUNT, COUNT, SPAN);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9));
});

test("wrap: the first frame has card 0 exactly 12% past the line", () => {
  const xs = initialOffsets(COUNT, SPAN);
  assert.ok(Math.abs(xs[0] - SPAN * INITIAL_PAST) < 1e-9, `got ${xs[0]}`);
  assert.ok(xs[0] > 0 && xs[0] < W * 0.2, "a sliver crossed, not a whole card");
});

test("fillOffsets writes the same numbers without allocating", () => {
  const out = new Float64Array(COUNT);
  fillOffsets(out, 91, COUNT, SPAN);
  const ref = wrapOffsets(91, COUNT, SPAN);
  out.forEach((v, i) => assert.equal(v, ref[i]));
});

/* ------------------------------------------------------------------ clip --- */

test("clip: the card keeps the raw side, the twin keeps the crossed side", () => {
  const rtl = clipFor(W / 2, W, "rtl");
  assert.equal(rtl.card, "inset(0 0 0 300px round 16px)");
  assert.equal(rtl.twin, "inset(0 300px 0 0 round 16px)");

  const ltr = clipFor(W / 2, W, "ltr");
  assert.equal(ltr.card, "inset(0 300px 0 0 round 16px)");
  assert.equal(ltr.twin, "inset(0 0 0 300px round 16px)");
});

test("clip: at cut 0 the twin is empty, at cut W the card is", () => {
  assert.equal(clipFor(0, W, "ltr").twin, "inset(0 0 0 600px round 16px)");
  assert.equal(clipFor(0, W, "ltr").card, "inset(0 0px 0 0 round 16px)");
  assert.equal(clipFor(W, W, "rtl").card, "inset(0 0 0 600px round 16px)");
});

test("clip: the CSS restates the same four rules, so the first frame matches", () => {
  const css = readFileSync(resolve(root, "src/styles/scanner.css"), "utf8");
  const expected = [
    ['[dir="rtl"] .scanner-card', "inset(0 0 0 var(--cut) round var(--radius))"],
    ['[dir="ltr"] .scanner-card', "inset(0 var(--cut) 0 0 round var(--radius))"],
    ['[dir="rtl"] .scanner-twin', "inset(0 var(--rest) 0 0 round var(--radius))"],
    ['[dir="ltr"] .scanner-twin', "inset(0 0 0 var(--rest) round var(--radius))"],
  ];
  for (const [selector, rule] of expected) {
    const start = css.indexOf(selector);
    assert.ok(start > -1, `${selector} missing from scanner.css`);
    const block = css.slice(start, start + 400);
    assert.ok(block.includes(rule), `${selector} does not carry ${rule}`);
  }
});

/* --------------------------------------------------------------- counter --- */

test("counter: the target is a share of the lines the card really shows", () => {
  assert.equal(counterTarget(3, 0), 0);
  assert.equal(counterTarget(3, 0.5), 2); // 1.5 rounds up
  assert.equal(counterTarget(3, 1), 3);
  assert.equal(counterTarget(5, 0.6), 3);
});

test("counter: never above the number of lines, never negative", () => {
  for (const lines of [0, 3, 4, 5]) {
    for (const p of [-1, 0, 0.01, 0.33, 0.5, 0.99, 1, 2]) {
      const v = counterTarget(lines, p);
      assert.ok(v >= 0 && v <= lines, `${v} out of range for ${lines} @ ${p}`);
      assert.equal(Number.isInteger(v), true);
    }
  }
});

test("counter: crossing picks the card under the line, not a finished one", () => {
  // Only index 2 is partially crossed; 3 is fully past and is not "crossing".
  assert.equal(crossingIndex([-W - 10, -W / 2, W / 4, SPAN], W), 2, "a fully crossed card is not crossing");
  // 0.9W has the largest cut that is still incomplete.
  assert.equal(crossingIndex([-2 * W, W / 3, W * 0.9, SPAN], W), 2, "the most-cut card wins");
  assert.equal(crossingIndex([-W, -W, SPAN, SPAN], W), -1, "nothing crossing");
});

/* ------------------------------------------------- reduced motion & pause --- */

const cfg = (over = {}) => ({
  period: SPAN * COUNT,
  autoSpeed: 72,
  dragging: false,
  hovered: false,
  auto: true,
  ...over,
});

test("pause: with auto off the belt does not advance", () => {
  const after = stepBelt({ off: 100, velocity: 0, factor: 1 }, 1 / 60, cfg({ auto: false }));
  assert.equal(after.off, 100);
});

test("reduced motion uses the same path: auto off, so nothing drifts", () => {
  const after = stepBelt({ off: 250, velocity: 0, factor: 1 }, 1 / 60, cfg({ auto: false }));
  assert.equal(after.off, 250);
});

test("autoplay: 0.05 x viewport width per second, within a frame's rounding", () => {
  let state = { off: 0, velocity: 0, factor: 1 };
  for (let i = 0; i < 120; i += 1) state = stepBelt(state, 1 / 60, cfg({ autoSpeed: 72 }));
  assert.ok(Math.abs(state.off - 144) < 3, `expected ~144px after 2s, got ${state.off}`);
});

test("autoplay never runs while dragging", () => {
  const after = stepBelt({ off: 40, velocity: 0, factor: 1 }, 1 / 60, cfg({ dragging: true }));
  assert.equal(after.off, 40);
});

test("hover eases toward 35% of the speed, and back to 100%", () => {
  let f = 1;
  for (let i = 0; i < 120; i += 1) f = hoverFactor(f, true, 1 / 60);
  assert.ok(Math.abs(f - 0.35) < 0.02, `hover factor settled at ${f}`);
  for (let i = 0; i < 120; i += 1) f = hoverFactor(f, false, 1 / 60);
  assert.ok(Math.abs(f - 1) < 0.02, `release factor settled at ${f}`);
});

test("drag inertia keeps 20% of the previous velocity", () => {
  const first = dragVelocity(60, 16, 0);
  assert.ok(Math.abs(first - (60 / 16) * 1000 * 0.8) < 1e-6);
  const second = dragVelocity(0, 16, first);
  assert.ok(Math.abs(second - first * 0.2) < 1e-6);
  assert.ok(Number.isFinite(dragVelocity(10, 0, 0)), "a zero-dt sample is floored, not divided by zero");
});

test("buttons: one step is exactly one span, on a ring", () => {
  const period = SPAN * COUNT;
  assert.equal(stepTarget(0, SPAN, COUNT, 1), SPAN);
  assert.equal(stepTarget(SPAN, SPAN, COUNT, -1), 0);
  assert.equal(stepTarget(0, SPAN, COUNT, -1), period - SPAN);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const e = easeInOutCubic(t);
    assert.ok(e >= 0 && e <= 1);
  }
});

test("next/prev wraps the short way round, never the long way", () => {
  const period = SPAN * COUNT;
  assert.ok(Math.abs(ringDelta(period - 10, 10, period) - 20) < 1e-9);
  assert.ok(Math.abs(ringDelta(10, period - 10, period) + 20) < 1e-9);
});

/* ------------------------------------------------------------- particles --- */

test("particles: density falls monotonically away from the seam", () => {
  assert.equal(particleProbability(0, 100), 1);
  assert.equal(particleProbability(100, 100), 0);
  assert.equal(particleProbability(150, 100), 0);
  let previous = 2;
  for (let d = 0; d <= 100; d += 5) {
    const p = particleProbability(d, 100);
    assert.ok(p <= previous + 1e-12, `not monotone at d=${d}`);
    previous = p;
  }
});

test("particles: the same cell and card give the same answer (no Math.random)", () => {
  assert.equal(cellLit(4, 9, 1, 20, 180, 1.5), cellLit(4, 9, 1, 20, 180, 1.5));
  assert.equal(cellLit(4, 9, 1, 400, 180, 1.5), false, "nothing lights off the band");
});

test("particles: some cells blink, most do not", () => {
  let changed = 0;
  for (let c = 0; c < 200; c += 1) {
    if (cellLit(c, 3, 0, 10, 180, 0) !== cellLit(c, 3, 0, 10, 180, 0.5)) changed += 1;
  }
  assert.ok(changed > 0, "nothing blinks");
  assert.ok(changed < 200, "everything blinks: that is noise, not a field");
});

/* -------------------------------------------------------------- quality --- */

test("quality steps down once and never climbs back", () => {
  assert.equal(nextQuality(16, 0), 0);
  assert.equal(nextQuality(21, 0), 1);
  assert.equal(nextQuality(21, 1), 2);
  assert.equal(nextQuality(25, 2), 3);
  assert.equal(nextQuality(10, 3), 3);
});

/* ----------------------------------------------------------------- digits --- */

test("digits follow the language, without Intl", () => {
  assert.equal(localizeDigits(12, "en"), "12");
  assert.equal(localizeDigits(12, "ar"), "\u0661\u0662");
  assert.equal(localizeDigits(0, "ar"), "\u0660");
});

test("easeToward is frame-rate independent", () => {
  const oneStep = easeToward(0, 100, 1 / 30, 14);
  let twoSteps = 0;
  for (let i = 0; i < 2; i += 1) twoSteps = easeToward(twoSteps, 100, 1 / 60, 14);
  assert.ok(Math.abs(oneStep - twoSteps) < 0.5, `${oneStep} vs ${twoSteps}`);
});

/* ------------------------------------------------------- catalog parity --- */

test("both catalogs describe the same four cards in the same order", () => {
  const load = (loc) => JSON.parse(readFileSync(resolve(root, `messages/${loc}.json`), "utf8")).scanner;
  const ar = load("ar");
  const en = load("en");

  assert.equal(ar.cards.length, 4);
  assert.equal(en.cards.length, 4);
  assert.deepEqual(
    ar.cards.map((c) => c.kind),
    en.cards.map((c) => c.kind),
  );

  ar.cards.forEach((card, i) => {
    const other = en.cards[i];
    assert.equal(
      card.resultLines.length,
      other.resultLines.length,
      `card ${i} (${card.kind}) has a different number of result lines`,
    );
    assert.equal(Boolean(card.resultTotal), Boolean(other.resultTotal), `card ${i} total differs`);
    if (card.kind === "gradebook") {
      assert.equal(card.rawRows.length, 5);
      assert.equal(other.rawRows.length, 5);
      const low = (c) => c.rawRows.filter((r) => r.low).length;
      assert.equal(low(card), 2, "the result names two low marks; the raw card must show two");
      assert.equal(low(other), 2);
    }
  });
});

test("the counter can only ever show a number the card can back", () => {
  const scanner = JSON.parse(readFileSync(resolve(root, "messages/ar.json"), "utf8")).scanner;
  for (const card of scanner.cards) {
    const lines = card.resultLines.length + (card.resultTotal ? 1 : 0);
    assert.ok(lines >= 3 && lines <= 5, `card ${card.kind} shows ${lines} lines`);
    assert.equal(counterTarget(lines, 1), lines);
  }
});
