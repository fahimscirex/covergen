/* <interior-accordion> / <interior-panel>: Navigation / Accordion
 * Ported from https://www.interior.dev/docs/accordion to custom elements.
 *
 *   <interior-accordion multiple>
 *     <interior-panel heading="University" meta="1" open>...content...</interior-panel>
 *   </interior-accordion>
 *
 *  1. No shift: the header row is a fixed height and the chevron rotates in
 *     place; only the panel below it changes size.
 *  2. Interruptible: height is a grid-rows transition, so toggling mid-open
 *     continues from the current height instead of snapping to 0 first.
 *  3. Motion is not the only channel: aria-expanded and the chevron angle both
 *     survive reduced motion; only the travel is dropped.
 *
 * Content is projected through a slot, so panels keep their light-DOM markup
 * and the app's form styling continues to apply to it.
 */
(() => {
  if (customElements.get("interior-panel")) return;

  let uid = 0;
  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: block; border-top: 1px solid var(--hairline); }
    :host(:first-of-type) { border-top: 0; }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border: 0;
      /* Tinted with the ink colour rather than a fixed grey, so the bar reads
         as a bar in both themes instead of vanishing into the panel. */
      background: color-mix(in srgb, var(--ink) 5%, var(--sub));
      box-shadow: inset 0 -1px 0 var(--hairline);
      text-align: left;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease;
      font: inherit;
    }
    .head:hover { background: color-mix(in srgb, var(--ink) 9%, var(--sub)); }
    .head:focus-visible {
      background: var(--accent-soft, #edf1ff);
      box-shadow: inset 0 0 0 1px var(--accent, #4568ff);
    }
    .num {
      flex: none;
      display: grid;
      place-items: center;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--accent-soft, #edf1ff);
      color: var(--accent, #4568ff);
      font: 600 var(--text-sm, 11.5px)/1 var(--font-ui, inherit);
      font-variant-numeric: tabular-nums;
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: 600 var(--text, 13px)/1.3 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink-2, #454545);
      transition: color 0.15s ease;
    }
    :host([open]) .title { color: var(--ink, #131313); }
    .meta {
      flex: none;
      font: 400 var(--text-sm, 11.5px)/1 var(--font-ui, inherit);
      font-variant-numeric: tabular-nums;
      color: var(--ink-3, #6e6e6e);
    }
    .chev {
      flex: none;
      width: 14px; height: 14px;
      color: var(--ink-3, #6e6e6e);
      transition: transform var(--t-lift, 0.18s) var(--ease-cell, ease);
    }
    :host([open]) .chev { transform: rotate(180deg); }

    .clip {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows var(--t-open, 0.2s) var(--ease-out, ease);
    }
    :host([open]) .clip { grid-template-rows: 1fr; }
    .inner {
      overflow: hidden;
      min-height: 0;
    }
    .body {
      background: var(--panel, #fff);
      padding: 14px;
    }
    @media (prefers-reduced-motion: reduce) {
      .clip, .chev { transition: none; }
    }
  `;

  const CHEV = `<svg class="chev" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  class InteriorPanel extends HTMLElement {
    static get observedAttributes() { return ["heading", "meta", "open"]; }

    constructor() {
      super();
      const id = `ip-${++uid}`;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div role="heading" aria-level="2">
          <button class="head" type="button" id="${id}-h"
            aria-expanded="false" aria-controls="${id}-p">
            <span class="num" aria-hidden="true"></span>
            <span class="title"></span>
            <span class="meta"></span>
            ${CHEV}
          </button>
        </div>
        <div class="clip" id="${id}-p" role="region" aria-labelledby="${id}-h">
          <div class="inner"><div class="body"><slot></slot></div></div>
        </div>`;
      this.$head = root.querySelector(".head");
      this.$num = root.querySelector(".num");
      this.$title = root.querySelector(".title");
      this.$meta = root.querySelector(".meta");
      this.$region = root.querySelector(".clip");
      this.$head.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("toggle-request", { bubbles: true }));
      });
      this.$head.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const all = [...(this.parentElement?.children || [])].filter((n) => n.localName === "interior-panel");
          const i = all.indexOf(this);
          const next = all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length];
          if (next) { e.preventDefault(); next.shadowRoot.querySelector(".head").focus(); }
        }
      });
    }

    connectedCallback() { this.#paint(); }
    attributeChangedCallback() { if (this.$head) this.#paint(); }

    #paint() {
      const open = this.hasAttribute("open");
      this.$title.textContent = this.getAttribute("heading") || "";
      this.$num.textContent = this.getAttribute("step") || "";
      this.$num.hidden = !this.hasAttribute("step");
      this.$meta.textContent = this.getAttribute("meta") || "";
      this.$head.setAttribute("aria-expanded", String(open));
      if (open) this.$region.removeAttribute("aria-hidden");
      else this.$region.setAttribute("aria-hidden", "true");
      this.$region.inert = !open;
    }
  }

  class InteriorAccordion extends HTMLElement {
    connectedCallback() {
      this.addEventListener("toggle-request", (e) => {
        const panel = e.target.closest("interior-panel");
        if (!panel) return;
        const multiple = this.hasAttribute("multiple");
        const open = panel.hasAttribute("open");
        if (!multiple) {
          [...this.querySelectorAll("interior-panel")].forEach((p) =>
            p !== panel && p.removeAttribute("open"));
        }
        panel.toggleAttribute("open", !open);
        this.dispatchEvent(new CustomEvent("change", {
          detail: { panel, open: !open }, bubbles: true,
        }));
      });
    }
  }

  customElements.define("interior-panel", InteriorPanel);
  customElements.define("interior-accordion", InteriorAccordion);
})();
