"use client";

/**
 * Scroll reveal + header state.
 *
 * The page is visible by default and stays that way unless this effect proves it
 * can hide and un-hide an element again. Nothing is hidden before paint: an
 * element is only marked pending when this effect runs and finds it below the
 * fold, so a blocked script, a failed hydration or a missing IntersectionObserver
 * leaves a complete, readable document rather than a blank one.
 *
 * Two safety nets, because a reveal that never fires is a blank page:
 *   1. if IntersectionObserver is unavailable, nothing is hidden at all;
 *   2. a one-shot timer reveals everything still pending after 2s, which also
 *      covers an observer that is present but never reports (some embedded
 *      webviews, background tabs, print).
 *
 * One observer serves every element, so a page with twenty revealable blocks
 * costs one observer rather than twenty. Elements animate once: a card that
 * re-animates every time it scrolls back into view reads as a demo, not a
 * product.
 */
import { useEffect } from "react";

const FAILSAFE_MS = 2000;

export function MotionRoot() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");

    // The header gains its background once the page has been scrolled.
    const onScroll = () => {
      if (!header) return;
      header.dataset.scrolled = window.scrollY > 24 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canObserve = typeof IntersectionObserver === "function";

    // Reduced motion, or no observer: leave every element in its default, visible
    // state. Movement is decoration; the content must not depend on it.
    if (prefersReduced || !canObserve) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    const reveal = (el: HTMLElement) => {
      el.classList.add("is-revealed");
    };

    // Only elements that start below the fold are hidden. Anything already on
    // screen is content the visitor is reading right now and is left alone.
    const fold = window.innerHeight;
    const pending = targets.filter((el) => el.getBoundingClientRect().top > fold * 0.9);
    pending.forEach((el) => el.setAttribute("data-reveal-pending", el.dataset.reveal ?? "true"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      },
      // A little inside the bottom edge: the reveal finishes before the element
      // reaches reading position, so text is never animated while being read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    pending.forEach((el) => io.observe(el));

    const failsafe = window.setTimeout(() => {
      pending.forEach(reveal);
      io.disconnect();
    }, FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}