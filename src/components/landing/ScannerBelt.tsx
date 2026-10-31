"use client";

/**
 * The scanner belt — landing-page section.
 *
 * Three layers stacked in one stage: the result documents (behind), the raw
 * cards, and a canvas of particles on top. One belt offset drives all of them,
 * and every direction difference is resolved by the single mapping in
 * `src/features/scanner/engine.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE GEOMETRY IS IN CSS AND THE ANIMATION IS IN JS
 *
 * The first paint must be the finished composition, with no JavaScript and no
 * layout shift: this section sits under the hero, and the hero owns LCP. So the
 * card positions, the clip and the seam are expressed in CSS custom properties
 * that resolve from `--i` alone — card 1 already 12% past the line — and the
 * engine takes over by writing the same values in pixels once it has measured
 * the stage. Nothing is rendered twice and nothing jumps: the first engine
 * frame is the CSS frame.
 *
 * The clip math lives once, in `clipFor()` in the engine; the four `[dir]` rules
 * in scanner.css restate it for the server-rendered frame only, and
 * tests/design/scanner.test.mjs asserts the two agree.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT ANIMATED PER FRAME
 *
 * No React state changes while the belt runs. The loop writes four transforms,
 * eight clip paths, one counter text and the canvas; React re-renders only when
 * the user presses a control.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, WheelEvent } from "react";
import {
  CELL_SIZE,
  DPR_CAP,
  MAX_SPARKS,
  type Dir,
  type QualityLevel,
  cardBox,
  cellLit,
  clamp,
  clipFor,
  counterTarget,
  crossingIndex,
  densityFor,
  dirSign,
  dragVelocity,
  easeInOutCubic,
  easeToward,
  fillOffsets,
  isStatic,
  localizeDigits,
  nextQuality,
  ringDelta,
  sparksFor,
  stepBelt,
} from "@/features/scanner/engine";

export interface ScannerCardCopy {
  kind: "gradebook" | "trend" | "page" | "worksheet";
  tag: string;
  rawTitle: string;
  rawRows?: { name: string; mark: string; low?: boolean }[];
  rawMarks?: string[];
  rawBars?: number;
  resultLines: string[];
  resultTotal?: string;
}

export interface ScannerLabels {
  counterLabel: string;
  pause: string;
  play: string;
  prev: string;
  next: string;
  sceneLabel: string;
  srHint: string;
}

interface Props {
  locale: "ar" | "en";
  cards: ScannerCardCopy[];
  labels: ScannerLabels;
}

/** The lines a card actually renders as structured items. */
export function resultLineCount(card: ScannerCardCopy): number {
  return card.resultLines.length + (card.resultTotal ? 1 : 0);
}

const N = (v: number) => Math.round(v * 100) / 100;

/* Colours are module constants: a per-dot template string in the loop would
   allocate a few thousand strings a second for no visual difference. */
const C_GOLD = "rgba(212,175,55,0.90)";
const C_RED = "rgba(218,41,28,0.85)";
const C_PURPLE = "rgba(75,30,97,0.80)";
const C_PAPER = "rgba(248,249,250,0.92)";
const C_SPARK_RED = "rgba(218,41,28,0.90)";
const C_SPARK_PURPLE = "rgba(75,30,97,0.90)";

/* ---------------------------------------------------------------- faces --- */

function RawFace({ card }: { card: ScannerCardCopy }) {
  return (
    <>
      <p className="scanner-card-tag">{card.tag}</p>
      <h3 className="scanner-card-title">{card.rawTitle}</h3>
      <span className="scanner-card-rule" aria-hidden="true" />

      {card.kind === "gradebook" && (
        <ul className="scanner-rows">
          {(card.rawRows ?? []).map((row) => (
            <li key={row.name} className="scanner-row" data-low={row.low ? "true" : undefined}>
              <span className="scanner-row-name">{row.name}</span>
              <span className="scanner-row-mark tnum">{row.mark}</span>
            </li>
          ))}
        </ul>
      )}

      {card.kind === "trend" && (
        <div className="scanner-trend">
          {(card.rawMarks ?? []).map((mark, i) => (
            <div
              key={mark}
              className="scanner-mark"
              style={{ "--k": i } as CSSProperties}
              data-last={i === (card.rawMarks?.length ?? 0) - 1 ? "true" : undefined}
            >
              <span className="scanner-mark-value tnum">{mark}</span>
              <span className="scanner-mark-bar" aria-hidden="true" />
            </div>
          ))}
          <span className="scanner-trend-line" aria-hidden="true" />
        </div>
      )}

      {(card.kind === "page" || card.kind === "worksheet") && (
        <div className="scanner-lines" data-kind={card.kind} aria-hidden="true">
          {Array.from({ length: card.rawBars ?? 5 }, (_, i) => (
            <span key={i} className="scanner-line" style={{ "--k": i } as CSSProperties} />
          ))}
        </div>
      )}
    </>
  );
}

function ResultFace({ card }: { card: ScannerCardCopy }) {
  return (
    <>
      <p className="scanner-card-tag">{card.tag}</p>
      <h3 className="scanner-card-title">{card.rawTitle}</h3>
      <span className="scanner-card-rule" aria-hidden="true" />
      <ul className="scanner-results-list">
        {card.resultLines.map((line) => (
          <li key={line} className="scanner-result-line">
            <span className="scanner-bullet" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {card.resultTotal && <p className="scanner-result-total tnum">{card.resultTotal}</p>}
    </>
  );
}

/* --------------------------------------------------------------- section --- */

export function ScannerBelt({ locale, cards, labels }: Props) {
  const dir: Dir = locale === "ar" ? "rtl" : "ltr";
  const sign = dirSign(dir);
  const count = cards.length;
  const lineCounts = useRef<number[]>(cards.map(resultLineCount));

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const twinEls = useRef<(HTMLDivElement | null)[]>([]);
  const counterRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);

  const [paused, setPaused] = useState(false);

  // Mutable scene state. None of it is React state: the loop must never
  // schedule a render, and a render must never reset the belt.
  const scene = useRef({
    off: 0,
    velocity: 0,
    factor: 1,
    shown: 0,
    crossing: -1,
    width: 0,
    height: 0,
    cardW: 0,
    cardH: 0,
    span: 0,
    paused: false,
    reduced: false,
    hovered: false,
    dragging: false,
    quality: 0 as QualityLevel,
    last: 0,
    clock: 0,
    frames: 0,
    accumulator: 0,
    tween: null as null | { from: number; delta: number; start: number; dur: number },
    offsets: new Float64Array(8),
    lastCut: [-1, -1, -1, -1],
    lastShown: [-1, -1, -1, -1],
    onStatic: null as null | (() => void),
    lastLeft: [NaN, NaN, NaN, NaN],
    sparks: new Float32Array(MAX_SPARKS * 7),
    sparkCount: 0,
    seed: 0x2545f491,
  });

  const rand = useCallback(() => {
    const s = scene.current;
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }, []);

  const api = useRef<{ wake: () => void; step: (d: number) => void; setPaused: (v: boolean) => void } | null>(null);

  /* --------------------------------------------------------- measurement --- */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const s = scene.current;
    const rect = stage.getBoundingClientRect();
    const cardRect = itemRefs.current[0]?.getBoundingClientRect();
    s.width = rect.width;
    s.height = rect.height;
    s.cardW = cardRect?.width || rect.width * 0.46;
    s.cardH = cardRect?.height || rect.height;
    const mobile = window.innerWidth < 768;
    s.span = s.cardW * (1 + (mobile ? 7 / 84 : 4.75 / 46));

    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? DPR_CAP.mobile : DPR_CAP.desktop);
    const w = Math.round(s.width * dpr);
    const h = Math.round(s.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = `${s.width}px`;
    canvas.style.height = `${s.height}px`;
  }, []);

  /* --------------------------------------------------------------- paint --- */
  const paint = useCallback(
    (dtSec: number) => {
      const s = scene.current;
      if (!s.cardW || !s.span) return;
      const offsets = s.offsets;
      fillOffsets(offsets, s.off, count, s.span);
      const mobile = window.innerWidth < 768;
      const cell = mobile ? CELL_SIZE.mobile : CELL_SIZE.desktop;
      const lineX = s.width / 2;
      const radius = s.cardW * 0.3;

      for (let i = 0; i < count; i += 1) {
        const box = cardBox(offsets[i], s.cardW, s.width, dir);
        const item = itemRefs.current[i];
        if (item && !(Math.abs(s.lastLeft[i] - box.left) < 0.1)) {
          item.style.transform = `translate3d(${N(box.left)}px, -50%, 0)`;
          s.lastLeft[i] = box.left;
        }
        if (Math.abs(s.lastCut[i] - box.cut) > 0.1) {
          const clip = clipFor(box.cut, s.cardW, dir);
          const card = cardEls.current[i];
          const twin = twinEls.current[i];
          if (card) card.style.clipPath = clip.card;
          if (twin) twin.style.clipPath = clip.twin;
          s.lastCut[i] = box.cut;
        }
        const shown = box.cut > 0.5 ? 1 : 0;
        if (shown !== s.lastShown[i]) {
          const twin = twinEls.current[i];
          if (twin) twin.style.visibility = shown ? "visible" : "hidden";
          s.lastShown[i] = shown;
        }
      }

      /* counter */
      const crossing = crossingIndex(offsets, s.cardW);
      if (crossing >= 0) {
        const box = cardBox(offsets[crossing], s.cardW, s.width, dir);
        const target = counterTarget(lineCounts.current[crossing] ?? 0, box.progress);
        if (crossing !== s.crossing) {
          s.crossing = crossing;
          s.shown = target; // a new card snaps; the same card eases
        } else {
          s.shown = easeToward(s.shown, target, dtSec, 14);
        }
        if (valueRef.current) {
          const text = localizeDigits(Math.round(s.shown), locale);
          if (valueRef.current.textContent !== text) valueRef.current.textContent = text;
        }
        const centre = clamp(box.left + s.cardW / 2, s.width * 0.12, s.width * 0.88);
        if (counterRef.current) counterRef.current.style.transform = `translate3d(${N(centre - lineX)}px, 0, 0)`;
      }

      /* canvas */
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = canvas.width / Math.max(1, s.width);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s.width, s.height);

      // Reduced motion and the static fallback draw nothing: the composition
      // itself is the reduced-motion frame, exactly as it is server-rendered.
      if (s.reduced || isStatic(s.quality)) return;

      const density = densityFor(s.quality);
      const top = (s.height - s.cardH) / 2;
      const rows = Math.floor(s.cardH / cell);
      const cols = Math.floor(s.cardW / cell);

      for (let i = 0; i < count; i += 1) {
        const box = cardBox(offsets[i], s.cardW, s.width, dir);
        if (box.cut <= 0) continue;
        for (let c = 0; c < cols; c += 1) {
          const x = box.left + c * cell + cell / 2;
          const d = (x - lineX) * sign;
          if (d < 0 || d > radius) continue;
          for (let r = -2; r < rows + 2; r += 1) {
            if (density < 1 && (c + r) % 2 !== 0) continue;
            if (!cellLit(c, r, i, d, radius, s.clock)) continue;
            const h = (Math.imul(c + 1, 73856093) ^ Math.imul(r + 7, 19349663) ^ (i + 1)) >>> 0;
            const pick = h % 10;
            ctx.fillStyle = d < 10 ? C_PAPER : pick < 5 ? C_GOLD : pick < 9 ? C_RED : C_PURPLE;
            const size = 1.1 + (((h >>> 8) % 100) / 100) * 1.7;
            const jx = ((((h >>> 16) % 100) / 100) - 0.5) * 1.6;
            const jy = ((((h >>> 24) % 100) / 100) - 0.5) * 1.6;
            ctx.fillRect(x + jx, top + r * cell + cell / 2 + jy, size, size);
          }
        }
      }

      /* sparks */
      const sparks = s.sparks;
      if (!sparksFor(s.quality)) {
        s.sparkCount = 0;
        return;
      }
      const budget = mobile ? 0 : 2;
      for (let k = 0; k < budget; k += 1) {
        if (s.sparkCount >= MAX_SPARKS) break;
        const b = s.sparkCount * 7;
        sparks[b] = lineX;
        sparks[b + 1] = top + rand() * s.cardH;
        sparks[b + 2] = sign * (30 + rand() * 70);
        sparks[b + 3] = -40 + rand() * 80;
        sparks[b + 4] = 1;
        sparks[b + 5] = 1 + rand() * 1.4;
        sparks[b + 6] = rand() < 0.25 ? 2 : 0;
        s.sparkCount += 1;
      }
      for (let k = 0; k < s.sparkCount; k += 1) {
        const b = k * 7;
        sparks[b] += sparks[b + 2] * dtSec;
        sparks[b + 1] += sparks[b + 3] * dtSec;
        sparks[b + 4] -= dtSec * 1.4;
        if (sparks[b + 4] <= 0) {
          s.sparkCount -= 1;
          const last = s.sparkCount * 7;
          for (let m = 0; m < 7; m += 1) sparks[b + m] = sparks[last + m];
          k -= 1;
          continue;
        }
        ctx.globalAlpha = clamp(sparks[b + 4], 0, 1) * 0.85;
        ctx.fillStyle = sparks[b + 6] === 2 ? C_SPARK_PURPLE : C_SPARK_RED;
        ctx.fillRect(sparks[b], sparks[b + 1], sparks[b + 5], sparks[b + 5]);
      }
      ctx.globalAlpha = 1;
    },
    [count, dir, locale, rand, sign],
  );

  /* ---------------------------------------------------------------- loop --- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const s = scene.current;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduced = reducedQuery.matches;

    const ro = new ResizeObserver(() => {
      measure();
      paint(0);
    });
    ro.observe(stage);
    measure();
    s.off = s.span * 0.12; // the CSS first frame: card 1 already 12% past
    paint(0);

    let raf = 0;
    let inView = false;
    let visible = !document.hidden;

    const schedule = () => {
      if (raf) return;
      if (!inView || !visible) return;
      if (s.reduced && !s.tween && !s.dragging) return;
      if (s.paused && !s.tween && !s.dragging && !s.velocity) return;
      raf = requestAnimationFrame(frame);
    };

    function frame(now: number) {
      raf = 0;
      const dt = s.last ? clamp((now - s.last) / 1000, 0, 0.1) : 0.016;
      s.last = now;
      s.clock += dt;

      if (s.tween) {
        const t = clamp((now - s.tween.start) / s.tween.dur, 0, 1);
        s.off = s.tween.from + s.tween.delta * easeInOutCubic(t);
        if (t >= 1) s.tween = null;
      } else {
        const next = stepBelt(
          { off: s.off, velocity: s.velocity, factor: s.factor },
          dt,
          {
            period: s.span * count,
            autoSpeed: s.width * 0.05,
            dragging: s.dragging,
            hovered: s.hovered,
            auto: !s.paused && !s.reduced && !s.dragging,
          },
        );
        s.off = next.off;
        s.velocity = next.velocity;
        s.factor = next.factor;
      }

      paint(dt);

      s.frames += 1;
      s.accumulator += dt;
      if (s.frames >= 30) {
        const avg = (s.accumulator / s.frames) * 1000;
        const level = nextQuality(avg, s.quality);
        if (level !== s.quality) {
          s.quality = level;
          if (isStatic(level)) {
            s.paused = true;
            s.onStatic?.();
          }
        }
        s.frames = 0;
        s.accumulator = 0;
      }

      schedule();
    }

    const wake = () => {
      s.last = 0;
      schedule();
    };

    s.onStatic = () => setPaused(true);
    api.current = {
      wake,
      step: (direction: number) => {
        if (!s.span) return;
        const delta = ringDelta(s.off, s.off + direction * s.span, s.span * count);
        s.tween = { from: s.off, delta, start: performance.now(), dur: 400 };
        wake();
      },
      setPaused: (value: boolean) => {
        s.paused = value;
        if (!value) wake();
      },
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) wake();
      },
      { rootMargin: "120px" },
    );
    io.observe(stage);

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) wake();
    };
    const onReduced = () => {
      s.reduced = reducedQuery.matches;
      paint(0);
      if (!s.reduced) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReduced);
    wake();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReduced);
      api.current = null;
    };
  }, [count, measure, paint]);

  /* ------------------------------------------------------------- pointers --- */
  const drag = useRef({ active: false, x: 0, t: 0 });

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = scene.current;
    drag.current = { active: true, x: e.clientX, t: performance.now() };
    s.dragging = true;
    s.velocity = 0;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    api.current?.wake();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current.active) return;
    const s = scene.current;
    const dx = e.clientX - drag.current.x;
    const dtMs = performance.now() - drag.current.t;
    if (dtMs < 8) return;
    const travel = sign * dx; // dragging toward the raw side runs the belt back
    s.off -= travel;
    s.velocity = -dragVelocity(travel, dtMs, s.velocity);
    drag.current = { active: true, x: e.clientX, t: performance.now() };
    api.current?.wake();
  };

  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    scene.current.dragging = false;
    api.current?.wake();
  };

  const onWheel = (e: WheelEvent) => {
    const s = scene.current;
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    s.off += e.deltaX * 0.6;
    s.velocity = e.deltaX * 2;
    api.current?.wake();
  };

  /* ------------------------------------------------------------- controls --- */
  const togglePause = () => {
    const next = !scene.current.paused;
    api.current?.setPaused(next);
    setPaused(next);
  };
  const step = (direction: number) => api.current?.step(direction);

  // Arrow keys step the belt in the direction of travel, whichever the language.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === (sign === -1 ? "ArrowRight" : "ArrowLeft")) {
      e.preventDefault();
      step(-1);
    } else if (e.key === (sign === -1 ? "ArrowLeft" : "ArrowRight")) {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <div className="scanner">
      <div
        className="scanner-stage"
        ref={stageRef}
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          scene.current.hovered = false;
          onPointerUp();
        }}
        onPointerEnter={() => {
          scene.current.hovered = true;
        }}
        onWheel={onWheel}
      >
        <div className="scanner-layer scanner-results">
          {cards.map((card, i) => (
            <div key={`twin-${card.kind}`} className="scanner-item" style={{ "--i": i } as CSSProperties}>
              <div
                className="scanner-twin"
                data-tone={i % 2 === 0 ? "paper" : "navy"}
                ref={(el) => {
                  twinEls.current[i] = el;
                }}
              >
                <ResultFace card={card} />
              </div>
            </div>
          ))}
        </div>

        <div className="scanner-layer scanner-cards">
          {cards.map((card, i) => (
            <div
              key={`card-${card.kind}`}
              className="scanner-item"
              style={{ "--i": i } as CSSProperties}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
            >
              <div
                className="scanner-card"
                data-tone={i % 2 === 0 ? "paper" : "navy"}
                ref={(el) => {
                  cardEls.current[i] = el;
                }}
              >
                <RawFace card={card} />
              </div>
            </div>
          ))}
        </div>

        <div className="scanner-line" />

        <div className="scanner-counter-rail">
          <div className="scanner-counter" ref={counterRef}>
            <span className="scanner-counter-value tnum" ref={valueRef}>
              {localizeDigits(0, locale)}
            </span>
            <span className="scanner-counter-gap" aria-hidden="true" />
            <span className="scanner-counter-label">{labels.counterLabel}</span>
          </div>
        </div>

        <canvas className="scanner-particles" ref={canvasRef} />
      </div>

      <div className="scanner-controls" role="group" aria-label={labels.sceneLabel} onKeyDown={onKey}>
        <button type="button" className="scanner-btn" onClick={() => step(-1)} aria-label={labels.prev}>
          <Chevron dir="prev" />
        </button>
        <button
          type="button"
          className="scanner-btn scanner-btn-play"
          onClick={togglePause}
          aria-pressed={paused}
          aria-label={paused ? labels.play : labels.pause}
          title={paused ? labels.play : labels.pause}
        >
          {paused ? <PlayGlyph /> : <PauseGlyph />}
        </button>
        <button type="button" className="scanner-btn" onClick={() => step(1)} aria-label={labels.next}>
          <Chevron dir="next" />
        </button>
      </div>

      <ul className="sr-only">
        <li>{labels.sceneLabel}</li>
        {cards.map((card) => (
          <li key={`sr-${card.kind}`}>
            {[card.tag, card.rawTitle, ...card.resultLines, card.resultTotal].filter(Boolean).join(" → ")}
          </li>
        ))}
        <li>{labels.srHint}</li>
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ icons --- */

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={dir === "prev" ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="6" y="4.5" width="2.6" height="11" rx="1" fill="currentColor" />
      <rect x="11.4" y="4.5" width="2.6" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 4.8l8 5.2-8 5.2V4.8z" fill="currentColor" />
    </svg>
  );
}
