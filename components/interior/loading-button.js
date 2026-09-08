/* <interior-loading-button>: Action Feedback / Loading Button
 * Ported from https://www.interior.dev/docs/loading-button (React + motion)
 * to a dependency-free custom element.
 *
 *   <interior-loading-button label="Save" pending-label="Saving"
 *     success-label="Saved" error-label="Try again" variant="primary">
 *   </interior-loading-button>
 *
 *   el.action = () => fetch(...);   // may return a promise; rejection => error
 *   el.addEventListener("settle", e => e.detail.status);
 *
 * The three failures, handled:
 *  1. No shift: all four faces are stacked in one grid cell, so the button is
 *     always as wide as its widest reachable state before it reaches it.
 *  2. Interruptible: a click while pending is ignored, not queued; the
 *     crossfade is a CSS transition that retargets from its current opacity.
 *  3. Motion is not the only channel: the label text itself changes and is
 *     announced via aria-live, so reduced motion loses only the fade.
 */
(() => {
  if (customElements.get("interior-loading-button")) return;

  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    /* position: relative contains the visually-hidden live region below. */
    :host { position: relative; display: inline-block; --_font: var(--font-ui, inherit); }
    :host([hidden]) { display: none; }
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: var(--control-h, 36px);
      padding: 0 var(--pad-control, 14px);
      font: 600 var(--text, 13px)/1 var(--_font);
      border-radius: var(--r-sm, 9px);
      border: 1px solid transparent;
      cursor: pointer;
      user-select: none;
      touch-action: manipulation;
      outline: none;
      transition: background-color 0.15s ease, border-color 0.15s ease,
                  box-shadow 0.15s ease, transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
    }
    button:active:not([aria-busy="true"]):not(:disabled) { transform: translateY(1px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:focus-visible {
      outline: 2px solid var(--accent, #4568FF);
      outline-offset: 2px;
    }

    :host([variant="primary"]) button {
      background: var(--accent, #292524);
      color: var(--on-accent, #fafaf9);
      box-shadow: 0 1px 3px rgba(28, 25, 23, 0.25);
    }
    :host([variant="primary"]) button:hover:not(:disabled) {
      background: var(--accent, #1c1917);
    }
    :host([variant="outline"]) button,
    :host(:not([variant])) button {
      background: var(--well, #ffffff);
      border-color: var(--hairline, #e7e5e4);
      color: var(--ink, #44403c);
      box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.95),
                  inset 0 -1px 0 rgba(28, 25, 23, 0.06),
                  0 1px 2px rgba(28, 25, 23, 0.08);
    }
    :host([variant="outline"]) button:hover:not(:disabled),
    :host(:not([variant])) button:hover:not(:disabled) {
      background: var(--sub, #fafaf9);
    }

    /* Every reachable state occupies the same cell: the width is the max. */
    .faces { display: grid; place-items: center; }
    .face {
      grid-area: 1 / 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(3px);
      filter: blur(3px);
      transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0, 1),
                  filter 0.22s ease;
    }
    .face[data-on] { opacity: 1; transform: none; filter: none; }
    svg { flex: none; }
    /* Only the live pending face spins; a permanently animating hidden node
       burns a compositor frame forever (interior.dev gates this on its 'still' flag). */
    .face[data-on] .spin { animation: interior-spin 0.85s linear infinite; }
    @keyframes interior-spin { to { transform: rotate(360deg); } }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .face { transition: none; transform: none; filter: none; }
      .face[data-on] .spin { animation: none; }
      button:active { transform: none; }
    }
  `;

  const SPINNER = `<svg class="spin" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.22"/>
      <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  const CHECK = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.6 6.3 4.9 8.6 9.4 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const ALERT = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 2.9v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M6 9.05h.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    </svg>`;

  class InteriorLoadingButton extends HTMLElement {
    static get observedAttributes() { return ["label", "pending-label", "success-label", "error-label", "disabled"]; }

    /** @type {() => unknown} assign the work this button performs. */
    action = null;
    #status = "idle";
    #timer = null;
    #run = 0;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <button type="button" part="button">
          <span class="faces" aria-hidden="true"></span>
        </button>
        <span class="sr-only" role="status" aria-live="polite"></span>`;
      this.$button = root.querySelector("button");
      this.$faces = root.querySelector(".faces");
      this.$live = root.querySelector(".sr-only");
      this.$button.addEventListener("click", () => this.run());
    }

    connectedCallback() { this.#render(); }
    attributeChangedCallback() { if (this.$faces) this.#render(); }
    disconnectedCallback() { clearTimeout(this.#timer); }

    get status() { return this.#status; }
    get pending() { return this.#status === "pending"; }

    #labels() {
      const idle = this.getAttribute("label") || this.textContent.trim() || "Submit";
      return {
        idle,
        pending: this.getAttribute("pending-label") || idle,
        success: this.getAttribute("success-label") || "Done",
        error: this.getAttribute("error-label") || "Try again",
      };
    }

    /** Slot custom markup (an icon, a longer label) into the idle face. */
    setIdleFace(html) { this.#idleFace = html; this.#render(); }
    #idleFace = null;

    #render() {
      const l = this.#labels();
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      this.$faces.innerHTML = `
        <span class="face" data-face="idle">${this.#idleFace ?? esc(l.idle)}</span>
        <span class="face" data-face="pending">${SPINNER}${esc(l.pending)}</span>
        <span class="face" data-face="success">${CHECK}${esc(l.success)}</span>
        <span class="face" data-face="error">${ALERT}${esc(l.error)}</span>`;
      this.$button.disabled = this.hasAttribute("disabled");
      this.#paint();
    }

    #paint() {
      const l = this.#labels();
      const status = this.#status;
      this.$faces.querySelectorAll(".face").forEach((f) =>
        f.toggleAttribute("data-on", f.dataset.face === status));
      this.$button.setAttribute("aria-label", l[status]);
      this.$button.toggleAttribute("aria-busy", status === "pending");
      this.$live.textContent =
        status === "success" ? l.success : status === "error" ? l.error : "";
      this.setAttribute("status", status);
    }

    #settle(next, id) {
      if (id !== this.#run) return;
      this.#status = next;
      this.#paint();
      this.dispatchEvent(new CustomEvent("settle", { detail: { status: next } }));
      const after = Number(this.getAttribute("reset-after") ?? 1400);
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        if (id !== this.#run) return;
        this.#status = "idle";
        this.#paint();
      }, after);
    }

    run() {
      if (this.pending || this.$button.disabled) return;
      clearTimeout(this.#timer);
      const id = ++this.#run;
      this.#status = "pending";
      this.#paint();

      // Two frames, not a microtask: a synchronous action (window.print, a
      // heavy render) would otherwise block before the pending face ever paints.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (id !== this.#run) return;
        Promise.resolve()
          .then(() => (this.action ? this.action() : undefined))
          .then(() => this.#settle("success", id),
                (err) => {
                  this.dispatchEvent(new CustomEvent("action-error", { detail: { error: err } }));
                  this.#settle("error", id);
                });
      }));
    }
  }

  customElements.define("interior-loading-button", InteriorLoadingButton);
})();
