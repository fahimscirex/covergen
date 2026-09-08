/* <interior-field>: Input / Floating Label
 * Ported from https://www.interior.dev/docs/floating-label to a custom element.
 *
 *   <interior-field label="Course code" value="MKT-3104" hint="As printed"></interior-field>
 *   <interior-field label="Topic" multiline rows="2"></interior-field>
 *
 *   el.value          // read / write, no event on write
 *   el.addEventListener("input", e => e.detail.value)
 *
 * Geometry from the original: 20px of headroom above a 40px field, label rests
 * at left 12px and lifts by (-32, -12) at 0.92 scale from its top-left origin.
 *
 *  1. No shift: the hint row is always 16px tall whether or not there is a
 *     hint, and the label lifts into reserved headroom instead of pushing.
 *  2. Interruptible: the lift is a transform transition, so focusing and
 *     blurring quickly retargets rather than replaying.
 *  3. Motion is not the only channel: the label is a real <label>, the resting
 *     position is legible, and reduced motion simply removes the travel.
 */
(() => {
  if (customElements.get("interior-field")) return;

  let uid = 0;
  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: block; width: 100%; }
    :host([hidden]) { display: none; }
    .wrap { position: relative; padding-top: 20px; }
    .box {
      position: relative;
      height: var(--field-h, 40px);
      border-radius: var(--r-md, 10px);
      border: 1.5px solid var(--hairline);
      box-shadow: var(--shadow-well);
      background: var(--sub, #fafafa);
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    :host([multiline]) .box { height: auto; }
    .box:has(:focus) {
      border-color: var(--accent, #4568ff);
      background: var(--well, #fff);
      box-shadow: none;
    }
    :host([invalid]) .box { border-color: var(--flag, #c0442f); background: var(--well, #fff); }
    :host([disabled]) .wrap { opacity: 0.55; }

    input, textarea {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0 12px;
      border: 0;
      border-radius: calc(var(--r-md, 10px) - 1px);
      background: transparent;
      color: var(--ink, #131313);
      font: 400 var(--text, 13px)/20px var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      outline: none;
      resize: none;
    }
    textarea {
      position: relative;
      inset: auto;
      display: block;
      height: auto;
      padding: 10px 12px;
      line-height: 20px;
      resize: vertical;
    }
    input::placeholder, textarea::placeholder { color: transparent; }
    :host([placeholder-visible]) input::placeholder,
    :host([placeholder-visible]) textarea::placeholder { color: var(--ink-3, #6e6e6e); }

    label {
      position: absolute;
      left: 12px;
      top: 32px;
      display: block;
      cursor: text;
      user-select: none;
      font: 400 var(--text, 13px)/16px var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink-3, #6e6e6e);
      transform-origin: 0 0;
      will-change: transform;
      transition: transform var(--t-lift, 0.18s) var(--ease-cell, ease),
                  color 0.15s ease;
    }
    :host([data-raised]) label {
      transform: translate(-12px, -32px) scale(0.92);
      color: var(--ink-2, #454545);
    }
    :host([invalid]) label { color: var(--flag, #c0442f); }

    /* Reserved whenever a hint is declared, so showing or swapping one never
       moves the next field. A field with no hint attribute cannot reach that
       state, so it does not pay for the row. */
    :host(:not([hint])) .foot { height: 0; margin-top: 0; }
    .foot {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      height: 16px;
      margin-top: 6px;
    }
    .hint {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: 400 var(--text-sm, 11.5px)/16px var(--font-ui, inherit);
      color: var(--ink-3, #6e6e6e);
    }
    :host([invalid]) .hint { color: var(--flag, #c0442f); }
    @media (prefers-reduced-motion: reduce) { label { transition: color 0.15s ease; } }
  `;

  class InteriorField extends HTMLElement {
    static get observedAttributes() { return ["label", "hint", "placeholder", "value", "disabled", "invalid"]; }

    constructor() {
      super();
      const id = `if-${++uid}`;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div class="wrap">
          <div class="box"></div>
          <label for="${id}"></label>
        </div>
        <div class="foot"><span class="hint"></span></div>`;
      this.$box = root.querySelector(".box");
      this.$label = root.querySelector("label");
      this.$hint = root.querySelector(".hint");
      this.#id = id;
    }
    #id;

    connectedCallback() { this.#build(); }
    attributeChangedCallback(name, _old, val) {
      if (!this.$box) return;
      if (name === "value") { if (this.$input && this.$input.value !== val) this.$input.value = val ?? ""; this.#raise(); }
      else this.#build();
    }

    get value() { return this.$input ? this.$input.value : this.getAttribute("value") || ""; }
    set value(v) {
      if (this.$input) this.$input.value = v ?? "";
      this.#raise();
    }
    /** The real control, for focus(), selection, or native validation. */
    get control() { return this.$input; }
    focus() { this.$input?.focus(); }

    #build() {
      const multiline = this.hasAttribute("multiline");
      const tag = multiline ? "textarea" : "input";
      if (!this.$input || this.$input.localName !== tag) {
        this.$box.innerHTML = multiline
          ? `<textarea id="${this.#id}" rows="${this.getAttribute("rows") || 2}"></textarea>`
          : `<input id="${this.#id}" type="${this.getAttribute("type") || "text"}">`;
        this.$input = this.$box.firstElementChild;
        this.$input.addEventListener("focus", () => this.#raise());
        this.$input.addEventListener("blur", () => this.#raise());
        this.$input.addEventListener("input", () => {
          this.#raise();
          this.dispatchEvent(new CustomEvent("input", {
            detail: { value: this.$input.value }, bubbles: true, composed: true,
          }));
        });
        this.$input.addEventListener("change", () => {
          this.dispatchEvent(new CustomEvent("change", {
            detail: { value: this.$input.value }, bubbles: true, composed: true,
          }));
        });
      }
      this.$input.value = this.getAttribute("value") ?? this.$input.value ?? "";
      this.$input.placeholder = this.getAttribute("placeholder") || "";
      this.$input.disabled = this.hasAttribute("disabled");
      if (this.hasAttribute("inputmode")) this.$input.inputMode = this.getAttribute("inputmode");
      this.$input.setAttribute("aria-invalid", this.hasAttribute("invalid") ? "true" : "false");

      this.$label.textContent = this.getAttribute("label") || "";
      this.$hint.textContent = this.getAttribute("hint") || "";
      this.#raise();
    }

    #raise() {
      const active = this.shadowRoot.activeElement === this.$input;
      const filled = !!this.$input?.value;
      this.toggleAttribute("data-raised", active || filled);
      // A placeholder is only legible once the label has moved out of its slot.
      this.toggleAttribute("placeholder-visible", active || filled);
    }
  }

  customElements.define("interior-field", InteriorField);
})();
