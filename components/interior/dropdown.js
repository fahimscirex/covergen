/* <interior-dropdown>: Overlay / Dropdown
 * Ported from https://www.interior.dev/docs/dropdown to a custom element.
 * Replaces a native <select> where the collapsed label and the expanded label
 * differ (an acronym collapsed, the full name open).
 *
 *   <interior-dropdown label="Faculty" value="FBS"
 *     items='[{"value":"FBS","label":"FBS","full":"Faculty of Business Studies"}]'>
 *   </interior-dropdown>
 *
 *   el.value; el.addEventListener("change", e => e.detail.value)
 *
 *  1. No shift: the trigger is sized by its longest collapsed label at build
 *     time, so choosing a different option never resizes the row.
 *  2. Interruptible: the highlight is one element that slides between rows,
 *     retargeting mid-flight; reopening mid-close reuses the same panel.
 *  3. Motion is not the only channel: aria-expanded/-activedescendant and the
 *     check mark carry state; reduced motion drops the slide and the scale.
 */
(() => {
  if (customElements.get("interior-dropdown")) return;

  let uid = 0;
  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: inline-block; position: relative; text-align: left; }
    :host([block]) { display: block; }
    /* Sits where a floating label rests once raised, so a dropdown and a field
       side by side share one baseline. */
    .cap {
      display: block;
      margin-bottom: 4px;
      font: 400 12px/16px var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink-2, #454545);
    }
    .cap:empty { display: none; }
    .trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: var(--control-h, 36px);
      padding: 0 12px;
      white-space: nowrap;
      border-radius: var(--r-sm, 9px);
      border: 1px solid transparent;
      background: var(--well, #fff);
      box-shadow: var(--shadow-cap);
      color: var(--ink, #131313);
      font: 500 var(--text, 13px)/1 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      cursor: pointer;
      user-select: none;
      outline: none;
      transition: box-shadow 0.15s ease, background-color 0.15s ease;
    }
    .trigger:hover { background: var(--sub, #fafafa); }
    .trigger:focus-visible {
      box-shadow: var(--shadow-cap), 0 0 0 2px var(--accent, #4568ff);
    }
    .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .chev {
      width: 12px; height: 12px; flex: none;
      color: var(--ink-3, #6e6e6e);
      transition: transform var(--t-open, 0.2s) var(--ease-out, ease);
    }
    :host([data-open]) .chev { transform: rotate(180deg); }

    .panel {
      /* Fixed, and placed in JS: an accordion or any scroll container between
         the trigger and the viewport would otherwise clip the menu. */
      position: fixed;
      left: 0;
      top: 0;
      z-index: 50;
      min-width: 224px;
      max-width: min(360px, 92vw);
      white-space: nowrap;
      padding: 5px;
      border-radius: var(--r-lg, 11px);
      border: 1px solid var(--hairline);
      background: var(--panel, #fff);
      box-shadow: var(--shadow-float);
      /* display, not visibility: a closed popover must occupy no layout at
         all, or every collapsed menu still lengthens the page it sits on. */
      display: none;
      opacity: 0;
      transform: scale(0.97) translateY(-4px);
      transition: opacity var(--t-exit, 0.12s) var(--ease-in, ease),
                  transform var(--t-exit, 0.12s) var(--ease-in, ease),
                  display var(--t-exit, 0.12s) allow-discrete;
    }
    :host([data-open]) .panel {
      display: block;
      opacity: 1;
      transform: none;
      transition: opacity var(--t-open, 0.2s) var(--ease-out, ease),
                  transform var(--t-open, 0.2s) var(--ease-out, ease),
                  display var(--t-open, 0.2s) allow-discrete;
    }
    @starting-style {
      :host([data-open]) .panel { opacity: 0; transform: scale(0.97) translateY(-4px); }
    }
    .list {
      position: relative;
      max-height: 216px;
      overflow-y: auto;
      outline: none;
      scrollbar-gutter: stable;
    }
    .marker {
      position: absolute;
      left: 0; right: 0;
      height: var(--row-h, 32px);
      border-radius: var(--r-xs, 7px);
      background: var(--accent-soft, #edf1ff);
      pointer-events: none;
      opacity: 0;
      transform: translateY(0);
      transition: transform var(--t-lift, 0.18s) var(--ease-cell, ease), opacity 0.1s ease;
    }
    .marker[data-on] { opacity: 1; }
    .item {
      position: relative;
      display: flex;
      align-items: center;
      height: var(--row-h, 32px);
      padding: 0 10px;
      border-radius: var(--r-xs, 7px);
      font: 400 var(--text, 13px)/1 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink-2, #454545);
      cursor: default;
      user-select: none;
    }
    .item[aria-selected="true"] { color: var(--ink, #131313); font-weight: 500; }
    .item-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tick { width: 14px; height: 14px; margin-left: 8px; flex: none; opacity: 0; color: var(--accent, #4568ff); }
    .item[aria-selected="true"] .tick { opacity: 1; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .panel, .marker, .chev { transition-duration: 0s; }
    }
  `;

  const CHEV = `<svg class="chev" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const TICK = `<svg class="tick" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7.4 5.6 10 11 4.2" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  class InteriorDropdown extends HTMLElement {
    static get observedAttributes() { return ["items", "value", "label"]; }

    #items = [];
    #value = "";
    #active = -1;
    #wasOpen = false;

    constructor() {
      super();
      const id = `id-${++uid}`;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <span class="cap" id="${id}-cap"></span>
        <button class="trigger" type="button" part="trigger"
          aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}">
          <span class="value"></span>${CHEV}
        </button>
        <div class="panel">
          <div class="list" id="${id}" role="listbox" tabindex="-1">
            <div class="marker"></div>
          </div>
        </div>`;
      this.$cap = root.querySelector(".cap");
      this.$trigger = root.querySelector(".trigger");
      this.$value = root.querySelector(".value");
      this.$panel = root.querySelector(".panel");
      this.$list = root.querySelector(".list");
      this.$marker = root.querySelector(".marker");
      this.#listen();
    }

    connectedCallback() { this.#parse(); this.#render(); }
    attributeChangedCallback(name, _o, v) {
      if (!this.$list) return;
      if (name === "value") { this.#value = v ?? ""; this.#paint(); }
      else { this.#parse(); this.#render(); }
    }
    disconnectedCallback() {
      document.removeEventListener("pointerdown", this.#outside, true);
      removeEventListener("scroll", this.#place, true);
      removeEventListener("resize", this.#place);
    }

    get value() { return this.#value; }
    set value(v) { this.#value = v; this.setAttribute("value", v); this.#paint(); }
    get items() { return this.#items; }
    set items(list) { this.#items = list || []; this.#render(); }

    #parse() {
      const raw = this.getAttribute("items");
      if (raw) { try { this.#items = JSON.parse(raw); } catch { this.#items = []; } }
      this.#value = this.getAttribute("value") ?? this.#items[0]?.value ?? "";
    }

    #esc(t) {
      return String(t ?? "").replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    }

    #render() {
      const label = this.getAttribute("label") || "";
      this.$cap.textContent = label;
      this.$list.setAttribute("aria-label", label);
      this.$list.innerHTML = `<div class="marker"></div>` + this.#items.map((it, i) =>
        `<div class="item" role="option" id="opt-${i}" data-index="${i}"
           aria-selected="false"><span class="item-label">${this.#esc(it.full || it.label)}</span>${TICK}</div>`).join("");
      this.$marker = this.$list.querySelector(".marker");
      this.#paint();
    }

    #paint() {
      const item = this.#items.find((i) => i.value === this.#value) || this.#items[0];
      this.$value.textContent = item ? item.label : "";
      this.$trigger.setAttribute("aria-label",
        `${this.getAttribute("label") || ""}${item ? `, ${item.full || item.label}` : ""}`);
      this.$list.querySelectorAll(".item").forEach((el, i) =>
        el.setAttribute("aria-selected", String(this.#items[i]?.value === this.#value)));
    }

    #highlight(index) {
      this.#active = index;
      const row = this.$list.querySelector(`[data-index="${index}"]`);
      if (!row) { this.$marker.removeAttribute("data-on"); return; }
      this.$marker.setAttribute("data-on", "");
      this.$marker.style.transform = `translateY(${row.offsetTop}px)`;
      this.$list.setAttribute("aria-activedescendant", row.id);
      row.scrollIntoView({ block: "nearest" });
    }

    #place = () => {
      const r = this.$trigger.getBoundingClientRect();
      const p = this.$panel;
      p.style.minWidth = `${Math.max(224, r.width)}px`;
      const h = p.offsetHeight;
      const room = { below: innerHeight - r.bottom - 8, above: r.top - 8 };
      const up = h > room.below && room.above > room.below;
      p.style.top = up ? `${Math.max(8, r.top - 6 - h)}px` : `${r.bottom + 6}px`;
      p.style.left = `${Math.min(Math.max(8, r.left), innerWidth - p.offsetWidth - 8)}px`;
      p.style.transformOrigin = up ? "bottom left" : "top left";
    };

    #open() {
      this.toggleAttribute("data-open", true);
      this.$trigger.setAttribute("aria-expanded", "true");
      this.#place();
      const i = Math.max(0, this.#items.findIndex((x) => x.value === this.#value));
      this.$list.focus();
      requestAnimationFrame(() => this.#highlight(i));
      document.addEventListener("pointerdown", this.#outside, true);
      addEventListener("scroll", this.#place, true);
      addEventListener("resize", this.#place);
    }

    #close(refocus = true) {
      if (!this.hasAttribute("data-open")) return;
      this.removeAttribute("data-open");
      this.$trigger.setAttribute("aria-expanded", "false");
      this.$list.removeAttribute("aria-activedescendant");
      document.removeEventListener("pointerdown", this.#outside, true);
      removeEventListener("scroll", this.#place, true);
      removeEventListener("resize", this.#place);
      if (refocus) this.$trigger.focus();
    }

    #outside = (e) => { if (!e.composedPath().includes(this)) this.#close(false); };

    #commit(index) {
      const item = this.#items[index];
      if (!item || item.disabled) return;
      const changed = item.value !== this.#value;
      this.#value = item.value;
      this.setAttribute("value", item.value);
      this.#paint();
      this.#close();
      if (changed) this.dispatchEvent(new CustomEvent("change", {
        detail: { value: item.value }, bubbles: true,
      }));
    }

    #step(dir) {
      const n = this.#items.length;
      if (!n) return;
      let i = this.#active < 0 ? this.#items.findIndex((x) => x.value === this.#value) : this.#active;
      for (let k = 0; k < n; k++) {
        i = (i + dir + n) % n;
        if (!this.#items[i]?.disabled) break;
      }
      this.#highlight(i);
    }

    #listen() {
      // Focus leaving the list closes the panel, and that blur lands before the
      // trigger's click. Sample the state at pointerdown so a second click on
      // the trigger closes instead of closing-then-reopening.
      this.$trigger.addEventListener("pointerdown", () => {
        this.#wasOpen = this.hasAttribute("data-open");
      });
      this.$trigger.addEventListener("click", () => {
        if (this.#wasOpen) this.#close();
        else this.#open();
        this.#wasOpen = false;
      });
      this.$trigger.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.#open();
        }
      });
      this.$list.addEventListener("click", (e) => {
        const row = e.target.closest(".item");
        if (row) this.#commit(Number(row.dataset.index));
      });
      this.$list.addEventListener("pointermove", (e) => {
        const row = e.target.closest(".item");
        if (row && Number(row.dataset.index) !== this.#active) this.#highlight(Number(row.dataset.index));
      });
      this.$list.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); this.#step(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); this.#step(-1); }
        else if (e.key === "Home") { e.preventDefault(); this.#highlight(0); }
        else if (e.key === "End") { e.preventDefault(); this.#highlight(this.#items.length - 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.#commit(this.#active); }
        else if (e.key === "Escape" || e.key === "Tab") { this.#close(); }
      });
      this.$list.addEventListener("blur", () => this.#close(false));
    }
  }

  customElements.define("interior-dropdown", InteriorDropdown);
})();
