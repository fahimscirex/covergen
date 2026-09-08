/* <interior-hold-confirm>: Action Feedback / Hold to Confirm
 * Ported from https://www.interior.dev/docs/hold-to-confirm (React + motion)
 * to a dependency-free custom element. Replaces a confirm() dialog for a
 * destructive action: the cost of the action is paid in held time, not in a
 * modal the user dismisses reflexively.
 *
 *   <interior-hold-confirm label="Hold to delete" confirm-label="Deleted"
 *     tone="danger" duration="1800"></interior-hold-confirm>
 *
 *   el.addEventListener("confirm", () => actuallyDelete());
 *
 * The three failures, handled:
 *  1. No shift: the idle and confirmed faces share one grid cell.
 *  2. Interruptible: release rewinds from wherever the fill currently is at
 *     release-rate x speed; re-pressing resumes from there, never from zero.
 *  3. Motion is not the only channel: the hint text states the hold duration,
 *     the confirmed state is announced, and with reduced motion the fill snaps
 *     rather than sweeping. The hold itself is still required.
 */
(() => {
  if (customElements.get("interior-hold-confirm")) return;

  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: inline-block; --_font: var(--font-ui, inherit); }
    button {
      position: relative;
      isolation: isolate;
      display: inline-grid;
      place-items: center;
      width: 100%;
      min-height: var(--control-h, 36px);
      padding: 0 16px;
      overflow: hidden;
      border-radius: var(--r-sm, 9px);
      border: 1px solid var(--hairline, #e7e5e4);
      background: var(--well, #ffffff);
      color: var(--ink, #44403c);
      font: 500 13px/1 var(--_font);
      cursor: pointer;
      user-select: none;
      touch-action: manipulation;
      -webkit-touch-callout: none;
      outline: none;
    }
    button:focus-visible {
      outline: 2px solid var(--accent, #4568FF);
      outline-offset: 2px;
    }
    :host([tone="danger"]) button { color: var(--flag, #dc2626); }
    :host([disabled]) button { opacity: 0.5; cursor: not-allowed; }

    /* The fill is the same button, clipped. Sweeping the clip reveals the
       inverted copy in place, so nothing moves and nothing re-lays-out. */
    .fill {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 0 16px;
      background: var(--accent, #292524);
      color: var(--on-accent, #fafaf9);
      clip-path: inset(0 100% 0 0);
    }
    :host([tone="danger"]) .fill {
      background: var(--flag, #dc2626);
      color: #ffffff;
    }

    .faces { display: grid; place-items: center; }
    .face {
      grid-area: 1 / 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      transition: opacity 0.2s ease;
    }
    .face[data-face="done"] { opacity: 0; }
    :host([data-committed]) .face[data-face="idle"] { opacity: 0; }
    :host([data-committed]) .face[data-face="done"] { opacity: 1; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    @media (prefers-reduced-motion: reduce) { .face { transition: none; } }
  `;

  const CHECK = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 6.4 4.7 8.6 9.5 3.5"/></svg>`;

  class InteriorHoldConfirm extends HTMLElement {
    static get observedAttributes() { return ["label", "confirm-label"]; }

    #phase = "idle";      // idle | holding | releasing | committed
    #down = false;
    #elapsed = 0;
    #last = 0;
    #raf = 0;
    #origin = null;
    #backTimer = null;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <button type="button" part="button">
          <span class="faces" data-copy="base"></span>
          <span class="fill" aria-hidden="true"><span class="faces" data-copy="fill"></span></span>
          <span class="sr-only" data-hint></span>
          <span class="sr-only" role="status" aria-live="polite" data-live></span>
        </button>`;
      this.$button = root.querySelector("button");
      this.$fill = root.querySelector(".fill");
      this.$hint = root.querySelector("[data-hint]");
      this.$live = root.querySelector("[data-live]");
      this.#bind();
    }

    connectedCallback() { this.#render(); }
    attributeChangedCallback() { if (this.$fill) this.#render(); }
    disconnectedCallback() {
      cancelAnimationFrame(this.#raf);
      clearTimeout(this.#backTimer);
      window.removeEventListener("blur", this.#bail);
      document.removeEventListener("visibilitychange", this.#onVisibility);
    }

    get #duration() { return Number(this.getAttribute("duration") ?? 1800); }
    get #releaseRate() { return Number(this.getAttribute("release-rate") ?? 2.5); }
    get #tolerance() { return Number(this.getAttribute("move-tolerance") ?? 10); }
    get #reduced() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

    #render() {
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const label = esc(this.getAttribute("label") || "Hold to confirm");
      const done = esc(this.getAttribute("confirm-label") || "Confirmed");
      const faces = `
        <span class="face" data-face="idle">${label}</span>
        <span class="face" data-face="done">${CHECK}${done}</span>`;
      this.shadowRoot.querySelectorAll(".faces").forEach((f) => (f.innerHTML = faces));
      this.$hint.textContent =
        `Press and hold for ${Math.round(this.#duration / 100) / 10} seconds to confirm. ` +
        `Releasing early cancels and nothing happens.`;
      this.$button.setAttribute("aria-describedby", "");
      this.$button.setAttribute("aria-label", this.getAttribute("label") || "Hold to confirm");
    }

    #sweep(progress) {
      this.$fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
    }

    #move(phase) {
      this.#phase = phase;
      this.toggleAttribute("data-committed", phase === "committed");
      this.$live.textContent =
        phase === "committed" ? (this.getAttribute("confirm-label") || "Confirmed") : "";
    }

    #reset = () => {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      this.#down = false;
      this.#elapsed = 0;
      this.#origin = null;
      this.#sweep(0);
      this.#move("idle");
    };

    #begin(point) {
      if (this.hasAttribute("disabled")) return;
      if (this.#phase === "committed" || this.#phase === "holding") return;
      this.#origin = point ?? null;
      this.#down = true;
      this.#move("holding");
      if (this.#reduced) this.#sweep(1);
      if (this.#raf) return;

      // Seeded from the first frame, not performance.now(): rAF reports the
      // frame's start time, which can predate the call that scheduled it and
      // would hand the loop a negative first delta.
      this.#last = 0;
      const loop = (now) => {
        if (!this.#last) this.#last = now;
        const dt = Math.min(64, Math.max(0, now - this.#last));
        this.#last = now;
        this.#elapsed += this.#down ? dt : -dt * this.#releaseRate;

        if (this.#elapsed >= this.#duration) {
          this.#raf = 0;
          this.#elapsed = this.#duration;
          this.#down = false;
          this.#origin = null;
          this.#sweep(1);
          this.#move("committed");
          navigator.vibrate?.(14);
          this.dispatchEvent(new CustomEvent("confirm", { bubbles: true }));
          const after = Number(this.getAttribute("reset-after") ?? 1600);
          if (after > 0) this.#backTimer = setTimeout(this.#reset, after);
          return;
        }
        // Only a rewind ends the loop at zero. The first frame legitimately
        // sits at 0 with the pointer still down.
        if (this.#elapsed <= 0 && !this.#down) {
          this.#raf = 0;
          this.#elapsed = 0;
          this.#origin = null;
          this.#sweep(0);
          this.#move("idle");
          return;
        }
        if (!this.#reduced) this.#sweep(this.#elapsed / this.#duration);
        this.#raf = requestAnimationFrame(loop);
      };
      this.#raf = requestAnimationFrame(loop);
    }

    #release = () => {
      if (this.#phase !== "holding") return;
      this.#down = false;
      this.#origin = null;
      if (this.#reduced) this.#sweep(0);
      this.#move("releasing");
      this.dispatchEvent(new CustomEvent("abort", { bubbles: true }));
    };

    #bail = () => this.#release();
    #onVisibility = () => { if (document.hidden) this.#release(); };

    #bind() {
      const b = this.$button;
      b.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        b.setPointerCapture?.(e.pointerId);
        this.#begin({ x: e.clientX, y: e.clientY });
      });
      b.addEventListener("pointermove", (e) => {
        const from = this.#origin;
        if (this.#phase !== "holding" || !from) return;
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > this.#tolerance) this.#release();
      });
      b.addEventListener("pointerup", this.#release);
      b.addEventListener("pointercancel", this.#release);
      b.addEventListener("pointerleave", this.#release);
      b.addEventListener("blur", this.#release);
      b.addEventListener("click", (e) => e.preventDefault());
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      b.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (this.#phase === "holding" || this.#phase === "releasing") {
            e.preventDefault();
            this.#reset();
          }
          return;
        }
        if (e.repeat) return;
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.#begin(); }
      });
      b.addEventListener("keyup", (e) => {
        if (e.key === " " || e.key === "Enter") this.#release();
      });
      window.addEventListener("blur", this.#bail);
      document.addEventListener("visibilitychange", this.#onVisibility);
    }
  }

  customElements.define("interior-hold-confirm", InteriorHoldConfirm);
})();
