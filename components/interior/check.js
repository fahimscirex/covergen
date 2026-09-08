/* <interior-check>: Input / Checkbox
 * No checkbox ships on interior.dev, so this is built from its parts: the well
 * shadow of an unfilled control, the accent fill of a committed one, and the
 * same 13px/-0.01em label. The tick is drawn, not a glyph, so it can wipe in.
 *
 *   <interior-check label="Display tagline" checked></interior-check>
 *   el.checked; el.addEventListener("change", e => e.detail.checked)
 *
 *  1. No shift: the box is a fixed 16px in both states.
 *  2. Interruptible: stroke-dashoffset and fill are transitions.
 *  3. Motion is not the only channel: it is a real checkbox to the a11y tree;
 *     the fill and tick are both present with reduced motion, just instantly.
 */
(() => {
  if (customElements.get("interior-check")) return;

  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: inline-block; }
    label {
      /* Contains the visually-hidden input below. Without this the absolutely
         positioned input escapes to the initial containing block and stretches
         the page by its own offset. */
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      font: 400 var(--text, 13px)/1.3 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink-2, #454545);
      /* 28px minimum target without a 28px box */
      padding: 6px 0;
    }
    input {
      position: absolute;
      width: 1px; height: 1px;
      opacity: 0;
      margin: 0;
      pointer-events: none;
    }
    .box {
      flex: none;
      position: relative;
      width: 16px; height: 16px;
      border-radius: 5px;
      background: var(--well, #fff);
      box-shadow: var(--shadow-well);
      transition: background-color var(--t-exit, 0.12s) var(--ease-out, ease),
                  box-shadow var(--t-exit, 0.12s) var(--ease-out, ease);
    }
    input:checked + .box {
      background: var(--accent, #4568ff);
      box-shadow: inset 0 0 0 1px #00000014;
    }
    input:focus-visible + .box {
      outline: 2px solid var(--accent, #4568ff);
      outline-offset: 2px;
    }
    svg { position: absolute; inset: 0; width: 16px; height: 16px; }
    path {
      stroke: #fff;
      stroke-width: 1.9;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      stroke-dasharray: 12;
      stroke-dashoffset: 12;
      transition: stroke-dashoffset var(--t-lift, 0.18s) var(--ease-out, ease);
    }
    input:checked + .box path { stroke-dashoffset: 0; }
    input:disabled + .box { opacity: 0.5; }
    :host([disabled]) label { cursor: not-allowed; opacity: 0.6; }
    @media (prefers-reduced-motion: reduce) {
      .box, path { transition: none; }
    }
  `;

  class InteriorCheck extends HTMLElement {
    static get observedAttributes() { return ["label", "checked", "disabled"]; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <label part="label">
          <input type="checkbox">
          <span class="box"><svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 8.3 6.7 11 12 5.2"/></svg></span>
          <span class="text"></span>
        </label>`;
      this.$input = root.querySelector("input");
      this.$text = root.querySelector(".text");
      this.$input.addEventListener("change", () => {
        this.toggleAttribute("checked", this.$input.checked);
        this.dispatchEvent(new CustomEvent("change", {
          detail: { checked: this.$input.checked }, bubbles: true,
        }));
      });
    }

    connectedCallback() { this.#paint(); }
    attributeChangedCallback() { if (this.$input) this.#paint(); }

    get checked() { return this.$input.checked; }
    set checked(v) { this.$input.checked = !!v; this.toggleAttribute("checked", !!v); }

    #paint() {
      this.$text.textContent = this.getAttribute("label") || "";
      this.$input.name = this.getAttribute("name") || this.id || "";
      this.$input.checked = this.hasAttribute("checked");
      this.$input.disabled = this.hasAttribute("disabled");
    }
  }

  customElements.define("interior-check", InteriorCheck);
})();
