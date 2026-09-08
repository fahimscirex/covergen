/* <interior-stepper>: Data / value stepper
 * Built from the interior.dev vocabulary (bezel well, cap-shadowed keys,
 * tabular numerals) for a bounded numeric control such as preview zoom.
 *
 *   <interior-stepper min="25" max="140" step="10" value="100" suffix="%"></interior-stepper>
 *   el.value; el.addEventListener("change", e => e.detail.value)
 *
 *  1. No shift: the readout is tabular-nums with a width reserved for the
 *     longest value the range can reach, so 9% and 140% occupy the same box.
 *  2. Interruptible: press feedback is a transform transition.
 *  3. Motion is not the only channel: it is a spinbutton with aria-valuenow.
 */
(() => {
  if (customElements.get("interior-stepper")) return;

  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: inline-flex; }
    /* Block mode sits in a form row beside dropdowns, so it takes their
       material too: one raised cap at --control-h, with the keys as quiet
       affordances inside it rather than chips in a sunken trough. */
    :host([block]) { display: block; }
    :host([block]) .root {
      display: flex;
      width: 100%;
      height: var(--control-h, 36px);
      padding: 0;
      gap: 0;
      /* The transparent border matches the dropdown trigger's, so the inset
         ring in --shadow-cap lands on the same line in both controls. */
      border: 1px solid transparent;
      background: var(--well, #fff);
      box-shadow: var(--shadow-cap);
    }
    /* Same type as a dropdown's value, not the smaller inline readout. */
    :host([block]) .read {
      font-size: var(--text, 13px);
      font-weight: 500;
    }
    :host([block]) button {
      width: calc(var(--control-h, 36px) + 2px);
      height: 100%;
      background: none;
      box-shadow: none;
      border-radius: var(--r-sm, 9px);
    }
    :host([block]) button:hover:not(:disabled) { background: var(--sub, #fafafa); }
    :host([block]) .read { flex: 1; }
    .root {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border-radius: var(--r-sm, 9px);
      background: var(--sub, #fafafa);
      box-shadow: var(--shadow-well);
    }
    button {
      display: grid;
      place-items: center;
      width: 26px; height: 26px;
      border: 0;
      border-radius: var(--r-xs, 7px);
      background: var(--well, #fff);
      box-shadow: var(--shadow-cap);
      color: var(--ink-2, #454545);
      cursor: pointer;
      outline: none;
      transition: transform 0.1s var(--ease-cell, ease), background-color 0.15s ease;
    }
    button:hover:not(:disabled) { background: var(--panel, #fff); color: var(--ink, #131313); }
    button:active:not(:disabled) { transform: scale(0.94); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button:focus-visible { outline: 2px solid var(--accent, #4568ff); outline-offset: 1px; }
    svg { width: 12px; height: 12px; }
    .read {
      min-width: 46px;
      text-align: center;
      font: 500 var(--text-sm, 11.5px)/1 var(--font-ui, inherit);
      font-variant-numeric: tabular-nums;
      color: var(--ink, #131313);
      letter-spacing: var(--track, -0.01em);
    }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  `;

  class InteriorStepper extends HTMLElement {
    static get observedAttributes() { return ["value", "min", "max", "step", "suffix"]; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div class="root" role="spinbutton" tabindex="0">
          <button type="button" data-dir="-1" aria-label="Decrease">
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6h7"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
          <span class="read"></span>
          <button type="button" data-dir="1" aria-label="Increase">
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2.5v7M2.5 6h7"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </div>`;
      this.$root = root.querySelector(".root");
      this.$read = root.querySelector(".read");
      this.$btns = [...root.querySelectorAll("button")];
      this.$btns.forEach((b) =>
        b.addEventListener("click", () => this.#nudge(Number(b.dataset.dir))));
      this.$root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); this.#nudge(1); }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); this.#nudge(-1); }
      });
    }

    connectedCallback() { this.#paint(); }
    attributeChangedCallback() { if (this.$read) this.#paint(); }

    get value() { return Number(this.getAttribute("value") ?? 0); }
    set value(v) { this.setAttribute("value", String(this.#clamp(v))); }

    #num(a, d) { const n = Number(this.getAttribute(a)); return Number.isFinite(n) ? n : d; }
    #clamp(v) { return Math.min(this.#num("max", 100), Math.max(this.#num("min", 0), Math.round(v))); }

    #nudge(dir) {
      const next = this.#clamp(this.value + dir * this.#num("step", 1));
      if (next === this.value) return;
      this.setAttribute("value", String(next));
      this.dispatchEvent(new CustomEvent("change", { detail: { value: next }, bubbles: true }));
    }

    #paint() {
      const v = this.value;
      const suffix = this.getAttribute("suffix") || "";
      this.$read.textContent = `${v}${suffix}`;
      this.$root.setAttribute("aria-valuenow", String(v));
      this.$root.setAttribute("aria-valuemin", String(this.#num("min", 0)));
      this.$root.setAttribute("aria-valuemax", String(this.#num("max", 100)));
      this.$root.setAttribute("aria-valuetext", `${v}${suffix}`);
      if (this.hasAttribute("label")) this.$root.setAttribute("aria-label", this.getAttribute("label"));
      this.$btns[0].disabled = v <= this.#num("min", 0);
      this.$btns[1].disabled = v >= this.#num("max", 100);
    }
  }

  customElements.define("interior-stepper", InteriorStepper);
})();
