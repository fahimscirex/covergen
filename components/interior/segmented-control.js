/* <interior-segmented>: Navigation / Segmented Control
 * Ported from https://www.interior.dev/docs/segmented-control (React + motion)
 * to a dependency-free custom element.
 *
 *   <interior-segmented label="View" value="day"
 *     options='[{"value":"day","label":"Day"},{"value":"week","label":"Week"}]'>
 *   </interior-segmented>
 *
 *   el.value = "week";                       // reflects, no event
 *   el.addEventListener("change", e => e.detail.value);
 *
 * Theme with --interior-* custom properties; they pierce the shadow root.
 *
 * The three failures, handled:
 *  1. No shift: every label sits in an equal grid track sized on first paint.
 *  2. Interruptible: the thumb is a CSS transition, so a mid-flight click
 *     retargets from wherever it currently is instead of restarting.
 *  3. Motion is not the only channel: aria-checked and the inverted label
 *     carry the state; reduced motion only removes the travel.
 */
(() => {
  if (customElements.get("interior-segmented")) return;

  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: inline-block;
      --_radius: var(--r-sm, 9px);
      --_font: var(--font-ui, inherit);
      --_thumb: var(--accent, #292524);
      --_thumb-fg: var(--on-accent, #fafaf9);
      --_fg: var(--ink-3, #78716c);
      --_fg-hover: var(--ink, #44403c);
      --_ring: var(--accent, #4568FF);
      --seg-index: 0;
      --seg-count: 1;
    }
    .root {
      position: relative;
      border-radius: var(--_radius);
      border: 1px solid var(--hairline, #e7e5e4);
      background: var(--sub, rgba(245, 245, 244, 0.7));
      box-shadow: inset 0 1px 2px rgba(28, 25, 23, 0.07);
      padding: 3px;
      user-select: none;
    }
    .track {
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--seg-count), minmax(0, 1fr));
      touch-action: manipulation;
    }
    .cell {
      padding: 7px 12px;
      text-align: center;
      font: 500 13px/18px var(--_font);
      letter-spacing: -0.01em;
      white-space: nowrap;
      color: var(--_fg);
      pointer-events: none;
      transition: color 0.15s ease;
    }
    .cell[data-disabled] { color: var(--ink-3, #d6d3d1); }
    .track:hover > .cell:not([data-disabled]) { color: var(--_fg-hover); }

    /* Thumb clips a second, counter-translated copy of the label track, so the
       active label inverts through the thumb rather than swapping colour. */
    .thumb {
      position: absolute;
      inset-block: 0;
      left: 0;
      width: calc(100% / var(--seg-count));
      overflow: hidden;
      border-radius: calc(var(--_radius) - 3px);
      background: var(--_thumb);
      box-shadow: 0 1px 2px rgba(28, 25, 23, 0.28);
      pointer-events: none;
      transform: translateX(calc(var(--seg-index) * 100%));
      transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .shift {
      position: absolute;
      inset: 0;
      transform: translateX(calc(var(--seg-index) * -100%));
      transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .thumb-track {
      position: absolute;
      inset-block: 0;
      left: 0;
      display: grid;
      width: calc(var(--seg-count) * 100%);
      grid-template-columns: repeat(var(--seg-count), minmax(0, 1fr));
    }
    .thumb-track .cell { color: var(--_thumb-fg); }

    .hits {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: repeat(var(--seg-count), minmax(0, 1fr));
    }
    .hits button {
      border: 0;
      margin: 0;
      padding: 0;
      background: none;
      cursor: pointer;
      border-radius: calc(var(--_radius) - 3px);
      outline: none;
    }
    .hits button[aria-disabled="true"] { cursor: not-allowed; }
    .hits button:focus-visible {
      background: color-mix(in srgb, var(--_ring) 6%, transparent);
      box-shadow: inset 0 0 0 1px var(--_ring);
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb, .shift { transition: none; }
    }
  `;

  class InteriorSegmented extends HTMLElement {
    static get observedAttributes() { return ["value", "options", "label"]; }

    #options = [];
    #value = "";
    #buttons = [];

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div class="root" part="root"><div class="track" role="radiogroup"></div></div>`;
      this.$group = root.querySelector(".track");
    }

    connectedCallback() {
      this.#parse();
      this.#render();
    }

    attributeChangedCallback(name) {
      if (!this.shadowRoot.isConnected) return;
      if (name === "value") this.value = this.getAttribute("value");
      else { this.#parse(); this.#render(); }
    }

    get value() { return this.#value; }
    set value(next) {
      const i = this.#options.findIndex((o) => o.value === next);
      if (i < 0) return;
      this.#value = next;
      this.#paint(i);
    }

    get options() { return this.#options; }
    set options(list) { this.#options = list || []; this.#render(); }

    #parse() {
      const raw = this.getAttribute("options");
      if (raw) { try { this.#options = JSON.parse(raw); } catch { this.#options = []; } }
      this.#value = this.getAttribute("value") || this.#options[0]?.value || "";
    }

    #render() {
      const opts = this.#options;
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const cell = (o) =>
        `<span class="cell"${o.disabled ? " data-disabled" : ""}>${esc(o.label)}</span>`;

      this.style.setProperty("--seg-count", String(Math.max(1, opts.length)));

      // Rebuilt wholesale, so listeners below never stack up across renders.
      this.$group.innerHTML =
        opts.map(cell).join("") +
        `<span class="thumb"><span class="shift"><span class="thumb-track">
           ${opts.map(cell).join("")}
         </span></span></span>` +
        `<span class="hits">${opts.map((o, i) => `
           <button type="button" role="radio" data-index="${i}"
             aria-checked="false" tabindex="-1"
             ${o.disabled ? 'aria-disabled="true"' : ""}
           ><span class="sr-only">${esc(o.label)}</span></button>`).join("")}</span>`;

      this.$hits = this.$group.querySelector(".hits");
      this.$buttons = [...this.$hits.children];

      const label = this.getAttribute("label");
      if (label) this.$group.setAttribute("aria-label", label);

      this.$hits.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn || btn.getAttribute("aria-disabled")) return;
        this.#select(Number(btn.dataset.index));
      });
      this.$hits.addEventListener("keydown", (e) => this.#onKeyDown(e));

      const i = Math.max(0, opts.findIndex((o) => o.value === this.#value));
      this.#paint(i);
    }

    #paint(index) {
      this.style.setProperty("--seg-index", String(index));
      this.$buttons?.forEach((b, i) => {
        b.setAttribute("aria-checked", String(i === index));
        b.tabIndex = i === index ? 0 : -1;
      });
    }

    #select(index) {
      const option = this.#options[index];
      if (!option || option.disabled) return;
      const changed = option.value !== this.#value;
      this.#value = option.value;
      this.setAttribute("value", option.value);
      this.#paint(index);
      if (changed) {
        this.dispatchEvent(new CustomEvent("change", {
          detail: { value: option.value }, bubbles: true,
        }));
      }
    }

    #seek(from, dir) {
      const n = this.#options.length;
      let i = from;
      for (let k = 0; k < n; k++) {
        i = (i + dir + n) % n;
        if (!this.#options[i]?.disabled) return i;
      }
      return from;
    }

    #onKeyDown(e) {
      const from = Number(e.target.dataset.index || 0);
      const n = this.#options.length;
      let to = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") to = this.#seek(from, 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = this.#seek(from, -1);
      else if (e.key === "Home") to = this.#seek(n - 1, 1);
      else if (e.key === "End") to = this.#seek(0, -1);
      if (to === null) return;
      e.preventDefault();
      this.$buttons[to].focus();
      this.#select(to);
    }
  }

  customElements.define("interior-segmented", InteriorSegmented);
})();
