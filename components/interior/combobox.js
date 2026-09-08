/* <interior-combobox>: Overlay / Command Palette, inline
 * The filtering, roving highlight, keyboard contract and empty state of
 * https://www.interior.dev/docs/command-palette, bound to an inline field
 * rather than a full-screen overlay.
 *
 *   const el = document.querySelector("interior-combobox");
 *   el.items = [{ value, label, sub }];          // set as a property, not JSON
 *   el.addEventListener("pick", e => e.detail.item);
 *
 *  1. No shift: the results float in a layer above the form; opening one never
 *     moves the fields beneath it. The footer row is fixed height.
 *  2. Interruptible: the highlight slides between rows and retargets; typing
 *     during the open transition does not restart it.
 *  3. Motion is not the only channel: combobox/listbox roles, aria-expanded,
 *     aria-activedescendant and a live count carry the same information.
 */
(() => {
  if (customElements.get("interior-combobox")) return;

  let uid = 0;
  const CSS = `
    /* A shadow root does not inherit the page's box-sizing reset, so widths
       set from JS would otherwise gain their padding and border on top. */
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: block; position: relative; }
    .field {
      position: relative;
      display: flex;
      align-items: center;
      height: var(--field-h, 40px);
      border-radius: var(--r-md, 10px);
      border: 1.5px solid var(--hairline);
      background: var(--sub, #fafafa);
      box-shadow: var(--shadow-well);
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .field:has(input:focus) {
      border-color: var(--accent, #4568ff);
      background: var(--well, #fff);
      box-shadow: none;
    }
    .glass { position: absolute; left: 11px; width: 14px; height: 14px; color: var(--ink-3, #6e6e6e); pointer-events: none; }
    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 34px 0 33px;
      border: 0;
      background: transparent;
      color: var(--ink, #131313);
      font: 400 var(--text, 13px)/1 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      outline: none;
    }
    input::placeholder { color: var(--ink-3, #6e6e6e); }
    .clear {
      position: absolute;
      right: 5px;
      display: grid;
      place-items: center;
      width: 26px; height: 26px;
      border: 0;
      border-radius: var(--r-xs, 7px);
      background: none;
      color: var(--ink-3, #6e6e6e);
      cursor: pointer;
      outline: none;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s ease, color 0.12s ease, background-color 0.12s ease;
    }
    .clear[data-on] { opacity: 1; pointer-events: auto; }
    .clear:hover { color: var(--flag, #c0442f); background: var(--sub, #fafafa); }
    .clear:focus-visible { outline: 2px solid var(--accent, #4568ff); outline-offset: 1px; }

    .panel {
      /* Fixed and placed in JS so a scroll container or an accordion between
         the field and the viewport cannot clip the results. */
      position: fixed;
      left: 0;
      top: 0;
      z-index: 60;
      padding: 5px;
      border-radius: var(--r-lg, 11px);
      border: 1px solid var(--hairline);
      background: var(--panel, #fff);
      box-shadow: var(--shadow-float);
      /* display, not visibility: a closed popover must occupy no layout. */
      display: none;
      opacity: 0;
      transform: scale(0.98) translateY(-4px);
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
      :host([data-open]) .panel { opacity: 0; transform: scale(0.98) translateY(-4px); }
    }
    .list { position: relative; max-height: 244px; overflow-y: auto; scrollbar-gutter: stable; }
    .marker {
      position: absolute; left: 0; right: 0;
      border-radius: var(--r-xs, 7px);
      background: var(--accent-soft, #edf1ff);
      pointer-events: none;
      opacity: 0;
      transition: transform var(--t-lift, 0.18s) var(--ease-cell, ease),
                  height var(--t-lift, 0.18s) var(--ease-cell, ease), opacity 0.1s ease;
    }
    .marker[data-on] { opacity: 1; }
    .row {
      position: relative;
      padding: 6px 10px;
      border-radius: var(--r-xs, 7px);
      cursor: default;
      user-select: none;
    }
    .row-label {
      font: 500 var(--text, 13px)/1.35 var(--font-ui, inherit);
      letter-spacing: var(--track, -0.01em);
      color: var(--ink, #131313);
    }
    .row-sub {
      font: 400 var(--text-sm, 11.5px)/1.35 var(--font-ui, inherit);
      color: var(--ink-3, #6e6e6e);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    mark { background: none; color: var(--accent, #4568ff); font-weight: 600; }
    .empty {
      padding: 10px;
      font: 400 var(--text, 13px)/1.3 var(--font-ui, inherit);
      color: var(--ink-3, #6e6e6e);
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 24px;
      padding: 0 6px;
      margin-top: 4px;
      border-top: 1px solid var(--hairline);
      font: 400 var(--text-sm, 11.5px)/1 var(--font-ui, inherit);
      color: var(--ink-3, #6e6e6e);
    }
    kbd {
      font: 500 10.5px/1 var(--font-mono, monospace);
      padding: 3px 5px;
      border-radius: 5px;
      background: var(--sub, #fafafa);
      box-shadow: var(--shadow-cap);
      color: var(--ink-2, #454545);
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    @media (prefers-reduced-motion: reduce) { .panel, .marker { transition-duration: 0s; } }
  `;

  const GLASS = `<svg class="glass" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" stroke-width="1.4"/>
      <path d="m9.4 9.4 2.6 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

  class InteriorCombobox extends HTMLElement {
    #items = [];
    #shown = [];
    #active = -1;
    #limit = 8;

    constructor() {
      super();
      const id = `cb-${++uid}`;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div class="field">
          ${GLASS}
          <input type="text" name="${id}" role="combobox" autocomplete="off" spellcheck="false"
            aria-expanded="false" aria-controls="${id}" aria-autocomplete="list">
          <button class="clear" type="button" aria-label="Clear search">
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="panel">
          <div class="list" id="${id}" role="listbox"><div class="marker"></div></div>
          <div class="foot"><span class="count"></span><span><kbd>↑↓</kbd> <kbd>↵</kbd></span></div>
        </div>
        <span class="sr-only" role="status" aria-live="polite"></span>`;
      this.$input = root.querySelector("input");
      this.$clear = root.querySelector(".clear");
      this.$panel = root.querySelector(".panel");
      this.$list = root.querySelector(".list");
      this.$marker = root.querySelector(".marker");
      this.$count = root.querySelector(".count");
      this.$live = root.querySelector(".sr-only");
      this.#listen();
    }

    connectedCallback() {
      this.$input.placeholder = this.getAttribute("placeholder") || "Search";
      if (this.hasAttribute("label")) this.$input.setAttribute("aria-label", this.getAttribute("label"));
      this.#limit = Number(this.getAttribute("limit") ?? 8);
    }
    disconnectedCallback() {
      document.removeEventListener("pointerdown", this.#outside, true);
      removeEventListener("scroll", this.#place, true);
      removeEventListener("resize", this.#place);
    }

    get items() { return this.#items; }
    set items(list) { this.#items = list || []; }
    get value() { return this.$input.value; }
    set value(v) { this.$input.value = v ?? ""; this.#syncClear(); }
    focus() { this.$input.focus(); }

    #esc(t) {
      return String(t ?? "").replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    }
    #mark(text, q) {
      const s = this.#esc(text);
      if (!q) return s;
      const i = s.toLowerCase().indexOf(q.toLowerCase());
      return i < 0 ? s : `${s.slice(0, i)}<mark>${s.slice(i, i + q.length)}</mark>${s.slice(i + q.length)}`;
    }

    #filter(q) {
      const needle = q.trim().toLowerCase();
      if (!needle) return [];
      const hits = [];
      for (const it of this.#items) {
        const hay = `${it.label} ${it.sub || ""}`.toLowerCase();
        if (hay.includes(needle)) hits.push(it);
        if (hits.length >= this.#limit) break;
      }
      return hits;
    }

    #render(q) {
      const rows = this.#shown;
      this.$list.innerHTML = `<div class="marker"></div>` + (rows.length
        ? rows.map((it, i) => `<div class="row" role="option" id="row-${i}" data-index="${i}" aria-selected="false">
             <div class="row-label">${this.#mark(it.label, q)}</div>
             ${it.sub ? `<div class="row-sub">${this.#mark(it.sub, q)}</div>` : ""}
           </div>`).join("")
        : `<div class="empty">No match for “${this.#esc(q)}”. Type the name manually below.</div>`);
      this.$marker = this.$list.querySelector(".marker");
      this.$count.textContent = rows.length
        ? `${rows.length}${rows.length >= this.#limit ? "+" : ""} match${rows.length === 1 ? "" : "es"}`
        : "No matches";
      this.$live.textContent = this.$count.textContent;
      if (this.hasAttribute("data-open")) this.#place();
      this.#highlight(rows.length ? 0 : -1);
    }

    #highlight(i) {
      this.#active = i;
      this.$list.querySelectorAll(".row").forEach((r, n) =>
        r.setAttribute("aria-selected", String(n === i)));
      const row = this.$list.querySelector(`[data-index="${i}"]`);
      if (!row) { this.$marker.removeAttribute("data-on"); this.$input.removeAttribute("aria-activedescendant"); return; }
      this.$marker.setAttribute("data-on", "");
      this.$marker.style.transform = `translateY(${row.offsetTop}px)`;
      this.$marker.style.height = `${row.offsetHeight}px`;
      this.$input.setAttribute("aria-activedescendant", row.id);
      row.scrollIntoView({ block: "nearest" });
    }

    #place = () => {
      const r = this.shadowRoot.querySelector(".field").getBoundingClientRect();
      const p = this.$panel;
      p.style.width = `${r.width}px`;
      const h = p.offsetHeight;
      const room = { below: innerHeight - r.bottom - 8, above: r.top - 8 };
      const up = h > room.below && room.above > room.below;
      p.style.top = up ? `${Math.max(8, r.top - 6 - h)}px` : `${r.bottom + 6}px`;
      p.style.left = `${r.left}px`;
      p.style.transformOrigin = up ? "bottom center" : "top center";
    };

    #open(on) {
      this.toggleAttribute("data-open", on);
      this.$input.setAttribute("aria-expanded", String(on));
      if (on) {
        this.#place();
        document.addEventListener("pointerdown", this.#outside, true);
        addEventListener("scroll", this.#place, true);
        addEventListener("resize", this.#place);
      } else {
        document.removeEventListener("pointerdown", this.#outside, true);
        removeEventListener("scroll", this.#place, true);
        removeEventListener("resize", this.#place);
      }
    }

    #outside = (e) => { if (!e.composedPath().includes(this)) this.#open(false); };

    #syncClear() { this.$clear.toggleAttribute("data-on", !!this.$input.value); }

    #pick(i) {
      const item = this.#shown[i];
      if (!item) return;
      this.$input.value = item.label;
      this.#syncClear();
      this.#open(false);
      this.dispatchEvent(new CustomEvent("pick", { detail: { item }, bubbles: true }));
    }

    #listen() {
      this.$input.addEventListener("input", () => {
        const q = this.$input.value;
        this.#syncClear();
        this.#shown = this.#filter(q);
        this.#open(q.trim().length > 0);
        this.#render(q);
      });
      this.$input.addEventListener("focus", () => {
        if (this.$input.value.trim()) {
          this.#shown = this.#filter(this.$input.value);
          this.#open(true);
          this.#render(this.$input.value);
        }
      });
      this.$input.addEventListener("keydown", (e) => {
        const n = this.#shown.length;
        if (e.key === "ArrowDown" && n) { e.preventDefault(); this.#highlight((this.#active + 1) % n); }
        else if (e.key === "ArrowUp" && n) { e.preventDefault(); this.#highlight((this.#active - 1 + n) % n); }
        else if (e.key === "Enter" && this.hasAttribute("data-open")) { e.preventDefault(); this.#pick(this.#active); }
        else if (e.key === "Escape") { this.#open(false); }
      });
      this.$list.addEventListener("click", (e) => {
        const row = e.target.closest(".row");
        if (row) this.#pick(Number(row.dataset.index));
      });
      this.$list.addEventListener("pointermove", (e) => {
        const row = e.target.closest(".row");
        if (row && Number(row.dataset.index) !== this.#active) this.#highlight(Number(row.dataset.index));
      });
      this.$clear.addEventListener("click", () => {
        this.$input.value = "";
        this.#syncClear();
        this.#open(false);
        this.$input.focus();
        this.dispatchEvent(new CustomEvent("clear", { bubbles: true }));
      });
    }
  }

  customElements.define("interior-combobox", InteriorCombobox);
})();
