import { useEffect } from "react";

/**
 * D-pad / remote navigation for the TV app.
 *
 * Browsers have no spatial navigation, so a remote's arrow keys do nothing on a
 * web page. This moves focus geometrically to the nearest focusable element in
 * the pressed direction, activates with OK/Enter and goes back with Back/Escape.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), select, input:not([type="hidden"]), textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';

type Dir = "up" | "down" | "left" | "right";

function isVisible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function candidates(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

function center(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

function best(from: HTMLElement, dir: Dir): HTMLElement | null {
  const a = center(from);
  let winner: HTMLElement | null = null;
  let winnerScore = Infinity;

  for (const el of candidates()) {
    if (el === from) continue;
    const b = center(el);
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    // Must actually lie in the pressed direction.
    if (dir === "left" && b.r.right > a.r.left - 1) continue;
    if (dir === "right" && b.r.left < a.r.right + 1) continue;
    if (dir === "up" && b.r.bottom > a.r.top - 1) continue;
    if (dir === "down" && b.r.top < a.r.bottom + 1) continue;

    const along = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Prefer things straight ahead: cross-axis drift is penalised heavily.
    const score = along + across * 4;
    if (score < winnerScore) {
      winnerScore = score;
      winner = el;
    }
  }
  return winner;
}

function focus(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type !== "checkbox" && type !== "radio" && type !== "button";
  }
  return false;
}

export function useTvNavigation() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Player routes and sliders own their own arrow handling.
      if (e.defaultPrevented) return;

      const active = document.activeElement as HTMLElement | null;
      const dir: Dir | null =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;

      if (dir) {
        // Let text fields and range inputs handle their own arrows.
        if (isTextEntry(active)) return;
        if (active instanceof HTMLInputElement && active.type === "range") return;

        const all = candidates();
        if (!all.length) return;

        if (!active || active === document.body || !all.includes(active)) {
          e.preventDefault();
          focus(all[0]!);
          return;
        }
        const next = best(active, dir);
        if (next) {
          e.preventDefault();
          focus(next);
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        if (!active || active === document.body) {
          const all = candidates();
          if (all.length) {
            e.preventDefault();
            focus(all[0]!);
          }
        }
        return;
      }

      if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") {
        if (isTextEntry(active)) return;
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
