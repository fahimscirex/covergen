/* Draws the cover sheet as a real PDF page and prepends it to the student's
 * own assignment PDF.
 *
 * The on-screen preview stays the source of truth for the format; this file
 * reproduces that same layout in PDF points. Both must be kept in step, which
 * is the price of a one-click merge: the browser cannot hand us the printed
 * cover as a file, so the cover is drawn a second time here.
 *
 * pdf-lib is loaded lazily, so a student who never merges never downloads it.
 */
window.BUPCoverPDF = (() => {
  const MM = 72 / 25.4;          // millimetres to PDF points
  const PX = 0.75;               // CSS pixels to PDF points
  const IN = 72;
  const PAPER = { a4: { w: 210 * MM, h: 297 * MM }, letter: { w: 8.5 * IN, h: 11 * IN } };
  const PAD = { top: 18 * MM, side: 24 * MM, bottom: 16 * MM };

  let libPromise = null;
  function loadLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!libPromise) {
      libPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "assets/pdf-lib.min.js";
        s.onload = () => resolve(window.PDFLib);
        s.onerror = () => reject(new Error("Could not load the PDF engine"));
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  /* The document font picker offers five serifs and one sans. PDF's built-in
     fonts cover Times and Helvetica only, so the serifs all render as Times.
     Embedding the real families would mean shipping four more font files. */
  function faces(fonts, S, fontClass) {
    const sans = fontClass === "font-arial";
    return {
      regular: fonts[sans ? S.Helvetica : S.TimesRoman],
      bold: fonts[sans ? S.HelveticaBold : S.TimesRomanBold],
      italic: fonts[sans ? S.HelveticaOblique : S.TimesRomanItalic],
      boldItalic: fonts[sans ? S.HelveticaBoldOblique : S.TimesRomanBoldItalic],
      approximated: !sans && fontClass !== "font-times",
    };
  }

  /* pdf-lib has no letter-spacing, but the cover leans on it (the headline is
     tracked at 0.04em, the address at 0.08em). Tracked text is measured and
     drawn a character at a time so the PDF breaks lines where the screen does. */
  function trackedWidth(text, font, size, track) {
    return font.widthOfTextAtSize(text, size) + track * size * Math.max(0, text.length - 1);
  }

  function drawTracked(page, text, { x, y, size, font, color, track }) {
    if (!track) {
      page.drawText(text, { x, y, size, font, color });
      return;
    }
    let cx = x;
    for (const ch of text) {
      page.drawText(ch, { x: cx, y, size, font, color });
      cx += font.widthOfTextAtSize(ch, size) + track * size;
    }
  }

  function wrap(text, font, size, maxWidth, track = 0) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (trackedWidth(next, font, size, track) <= maxWidth) line = next;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
    return lines;
  }

  /* A block is measured before anything is drawn, so the four of them can be
     distributed down the page the way flex space-evenly does on screen. */
  function textBlock(lines, font, size, leading, gapAfter = 0, track = 0) {
    return {
      height: lines.length * size * leading + gapAfter,
      draw(page, ctx, y) {
        for (const line of lines) {
          const w = trackedWidth(line, font, size, track);
          drawTracked(page, line, {
            x: ctx.centerX - w / 2,
            y: y - size * leading + (size * leading - size) / 2 + size * 0.06,
            size, font, color: ctx.ink, track,
          });
          y -= size * leading;
        }
        return y - gapAfter;
      },
    };
  }

  function spacer(height) {
    return { height, draw: (page, ctx, y) => y - height };
  }

  function stack(parts) {
    return {
      height: parts.reduce((n, p) => n + p.height, 0),
      draw(page, ctx, y) {
        for (const p of parts) y = p.draw(page, ctx, y);
        return y;
      },
    };
  }

  // The crest may be SVG or PNG; either way it goes through a canvas.
  async function crest(pdf, src) {
    const url = URL.createObjectURL(await (await fetch(src)).blob());
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      // Rasterised at 4x so the crest still looks clean when printed.
      const scale = 4;
      const w = img.naturalWidth || 300, h = img.naturalHeight || 300;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const g = canvas.getContext("2d");
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const bytes = await (await fetch(canvas.toDataURL("image/png"))).arrayBuffer();
      const png = await pdf.embedPng(bytes);
      return { png, ratio: w / h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const SIZES = {
    topic: { "topic-md": 19, "topic-lg": 22, "topic-xl": 26 },
    gap: { "spacing-compact": 0, "spacing-balanced": 4, "spacing-spacious": 10 },
  };

  async function buildCover(pdf, state, S, fontFor, PAGE) {
    const page = pdf.addPage([PAGE.w, PAGE.h]);
    const contentW = PAGE.w - PAD.side * 2;
    const ctx = { centerX: PAGE.w / 2, ink: fontFor.black };
    const f = fontFor.faces;

    const headSize = state.headerPt || 21;
    const headline = state.headerCase === "header-title"
      ? (state.univName || "")
      : (state.univName || "").toUpperCase();

    const headTrack = state.headerCase === "header-title" ? 0.02 : 0.04;
    const mastParts = [
      textBlock(wrap(headline, f.bold, headSize, contentW, headTrack),
        f.bold, headSize, 1.25, 0, headTrack),
    ];
    if (state.showTagline && (state.univTagline || "").trim()) {
      mastParts.push(spacer(2 * MM));
      mastParts.push(textBlock(
        wrap(state.univTagline.trim(), f.italic, 11, contentW, 0.06),
        f.italic, 11, 1.3, 0, 0.06));
    }
    if (state.showAddress && (state.univAddress || "").trim()) {
      mastParts.push(spacer(1.5 * MM));
      mastParts.push(textBlock(
        wrap(state.univAddress.trim().toUpperCase(), f.bold, 9, contentW, 0.08),
        f.bold, 9, 1.3, 0, 0.08));
    }

    const logoH = (state.logoPx || 112) * PX;
    const logoW = logoH * (fontFor.crest?.ratio || 1);
    // Its own block, matching the preview: space-evenly then centres the crest
    // between the masthead and the assignment.
    const crestBlock = fontFor.crest && {
      height: logoH,
      draw(pg, c, y) {
        pg.drawImage(fontFor.crest.png, {
          x: c.centerX - logoW / 2, y: y - logoH, width: logoW, height: logoH,
        });
        return y - logoH;
      },
    };

    const topicSize = SIZES.topic[state.topicSize] || 22;
    const course = [state.courseTitle, state.courseCode ? `(${state.courseCode})` : ""]
      .filter(Boolean).join(" ").trim();
    const assignment = stack([
      textBlock(wrap(state.prefix || "", f.regular, 13.5, contentW, 0.06),
        f.regular, 13.5, 1.3, 2.5 * MM, 0.06),
      textBlock(wrap(state.topic || "Untitled Topic", f.boldItalic, topicSize, contentW * 0.9),
        f.boldItalic, topicSize, 1.32, 3 * MM),
      textBlock(wrap(course, f.bold, 15.5, contentW, 0.015), f.bold, 15.5, 1.3, 0, 0.015),
    ]);

    const to = stack([
      textBlock(["Submitted To:"], f.bold, 13, 1.3, 2 * MM, 0.05),
      textBlock(wrap(state.teacherName || "", f.bold, 13.5, contentW), f.bold, 13.5, 1.45),
      textBlock(wrap(state.teacherDept || "", f.regular, 12, contentW), f.regular, 12, 1.45),
      textBlock(wrap(state.teacherAffiliation || "", f.regular, 12, contentW), f.regular, 12, 1.45),
    ]);

    const members = (state.submissionMode === "group" ? state.members : state.members.slice(0, 1))
      .filter(m => (m.name || "").trim() || (m.id || "").trim());
    const rows = members.length ? members : [{ name: "", id: "" }];
    const tableW = contentW * 0.86;
    const nameW = tableW * 0.58;
    const rowH = 12 * 1.2 + 7 * PX * 2;

    const table = {
      height: rows.length * rowH + 3.5 * MM,
      draw(pg, c, y) {
        const left = c.centerX - tableW / 2;
        const top = y;
        rows.forEach((m, i) => {
          const ry = top - rowH * (i + 1);
          pg.drawRectangle({
            x: left, y: ry, width: tableW, height: rowH,
            borderColor: fontFor.rule, borderWidth: 1.5 * PX,
          });
          pg.drawLine({
            start: { x: left + nameW, y: ry },
            end: { x: left + nameW, y: ry + rowH },
            thickness: 1.5 * PX, color: fontFor.rule,
          });
          const baseline = ry + (rowH - 12) / 2 + 12 * 0.18;
          pg.drawText(m.name || "", {
            x: left + 16 * PX, y: baseline, size: 12, font: f.bold, color: fontFor.rule,
          });
          pg.drawText(m.id || "", {
            x: left + nameW + 16 * PX, y: baseline, size: 12, font: f.bold, color: fontFor.rule,
          });
        });
        return top - rows.length * rowH - 3.5 * MM;
      },
    };

    const meta = [];
    if ((state.section || "").trim()) meta.push(`Section: ${state.section.trim()}`);
    if ((state.intake || "").trim()) meta.push(state.intake.trim());
    if ((state.session || "").trim()) meta.push(`Session: ${state.session.trim()}`);
    if ((state.studentDept || "").trim()) meta.push(state.studentDept.trim());
    const metaBlock = stack(meta.map(line =>
      textBlock([line], f.regular, 12, 1.55)));

    const byParts = [textBlock(["Submitted By:"], f.bold, 13, 1.3, 2 * MM, 0.05), table, metaBlock];
    if (state.showDate && state.submissionDate) {
      const pretty = new Date(state.submissionDate).toLocaleDateString("en-GB",
        { day: "numeric", month: "long", year: "numeric" });
      byParts.push(spacer(2 * MM));
      byParts.push(textBlock([`Date of Submission: ${pretty}`], f.italic, 11, 1.4));
    }

    // No crest (an unlisted university with none uploaded) drops the block.
    const blocks = [stack(mastParts), crestBlock, assignment, to, stack(byParts)].filter(Boolean);

    // flex `justify-content: space-evenly` plus the sheet's row gap.
    const gap = (SIZES.gap[state.spacing] ?? 4) * MM;
    const inner = PAGE.h - PAD.top - PAD.bottom;
    const used = blocks.reduce((n, b) => n + b.height, 0) + gap * (blocks.length - 1);
    const space = Math.max(0, (inner - used) / (blocks.length + 1));

    let y = PAGE.h - PAD.top;
    blocks.forEach((b, i) => {
      y -= space;
      y = b.draw(page, ctx, y);
      if (i < blocks.length - 1) y -= gap;
    });

    if (state.border !== "border-none") {
      const double = state.border === "border-double";
      page.drawRectangle({
        x: PAD.side, y: PAD.bottom,
        width: contentW, height: inner,
        borderColor: fontFor.rule, borderWidth: (double ? 1.5 : 1.5) * PX,
      });
      if (double) {
        page.drawRectangle({
          x: PAD.side + 3 * PX, y: PAD.bottom + 3 * PX,
          width: contentW - 6 * PX, height: inner - 6 * PX,
          borderColor: fontFor.rule, borderWidth: 1.5 * PX,
        });
      }
    }
  }

  /* ---- International formats. `v` is app.js's coverValues(), the same
     text the on-screen templates print. ---- */

  /* Lines down the page as CSS lays out the templates: one line box of
     `lead` per line, a "\n" in a value starting a new one, and an empty
     value still taking its line. */
  function lines(page, items, { x, w, y, font, ink, size = 12, lead = 24, align = "center" }) {
    for (const item of items) {
      const f = item.font || font;
      for (const part of String(item.text ?? "").split("\n")) {
        const wrapped = wrap(part, f, size, w);
        if (!wrapped.length) { y -= lead; continue; }
        for (const line of wrapped) {
          const lw = f.widthOfTextAtSize(line, size);
          page.drawText(line, {
            x: align === "center" ? x + (w - lw) / 2 : x,
            y: y - lead + (lead - size) / 2 + size * 0.2,
            size, font: f, color: ink,
          });
          y -= lead;
        }
      }
    }
    return y;
  }

  function manuscriptPage(pdf, P) {
    return { page: pdf.addPage([P.w, P.h]), x: IN, w: P.w - 2 * IN };
  }

  function runningHead(page, P, text, font, ink) {
    page.drawText(text, {
      x: P.w - IN - font.widthOfTextAtSize(text, 12), y: P.h - 0.5 * IN - 12 * 0.8,
      size: 12, font, color: ink,
    });
  }

  const BUILDERS = {
    apa(pdf, P, ff, v) {
      const { page, x, w } = manuscriptPage(pdf, P);
      const f = ff.faces;
      runningHead(page, P, "1", f.regular, ff.black);
      lines(page, [
        { text: v.fullTitle, font: f.bold }, { text: "" }, { text: v.authorsInline },
        { text: v.affiliation }, { text: v.courseLine }, { text: v.teacherName }, { text: v.dateLong },
      ], { x, w, y: P.h - IN - 3 * 24, font: f.regular, ink: ff.black });
    },

    mlatp(pdf, P, ff, v) {
      const { page, x, w } = manuscriptPage(pdf, P);
      const f = ff.faces, o = { x, w, font: f.regular, ink: ff.black };
      lines(page, [{ text: v.univTitle }], { ...o, y: P.h - IN });
      lines(page, [{ text: v.fullTitle, font: f.bold }], { ...o, y: P.h * 0.67 });
      lines(page, [{ text: v.authorsLines }, { text: v.teacherName }, { text: v.courseLine }, { text: v.dateDMY }],
        { ...o, y: P.h * 0.38 });
    },

    chicago(pdf, P, ff, v) {
      const { page, x, w } = manuscriptPage(pdf, P);
      const f = ff.faces, o = { x, w, font: f.regular, ink: ff.black };
      const title = [{ text: v.topicColon, font: f.bold }];
      if (v.subtitle) title.push({ text: v.subtitle, font: f.bold });
      lines(page, title, { ...o, y: P.h * 0.67 });
      lines(page, [{ text: v.authorsLines }, { text: v.courseLine }, { text: v.teacherName }, { text: v.dateLong }],
        { ...o, y: P.h * 0.38 });
    },

    uk(pdf, P, ff, v) {
      const page = pdf.addPage([P.w, P.h]);
      const f = ff.faces, ink = ff.black;
      const M = 20 * MM, W = P.w - 2 * M, size = 10.5, lead = size * 1.35;
      let y = P.h - M;

      // University header: crest, name and faculty, then a rule.
      const crestH = 17 * MM;
      const textH = 12 * 1.2 + (v.faculty ? 1 * MM + 9 * 1.35 : 0);
      const headH = Math.max(ff.crest ? crestH : 0, textH);
      let tx = M;
      if (ff.crest) {
        const cw = crestH * ff.crest.ratio;
        page.drawImage(ff.crest.png, { x: M, y: y - (headH + crestH) / 2, width: cw, height: crestH });
        tx = M + cw + 4 * MM;
      }
      let ty = y - (headH - textH) / 2;
      ty = lines(page, [{ text: v.univTitle, font: f.bold }],
        { x: tx, w: P.w - M - tx, y: ty, font: f.bold, ink, size: 12, lead: 12 * 1.2, align: "left" });
      if (v.faculty) lines(page, [{ text: v.faculty }],
        { x: tx, w: P.w - M - tx, y: ty - 1 * MM, font: f.regular, ink, size: 9, lead: 9 * 1.35, align: "left" });
      y -= headH + 4 * MM;
      page.drawLine({ start: { x: M, y }, end: { x: P.w - M, y }, thickness: 1.5, color: ink });

      y -= 7 * MM;
      y = lines(page, [{ text: "Assignment Cover Sheet", font: f.bold }],
        { x: M, w: W, y, font: f.bold, ink, size: 16, lead: 16 * 1.35, align: "left" });
      y -= 5 * MM;

      // The details table: labels on grey, values wrapped in their column.
      const labelW = W * 0.36, padX = 2.6 * MM, padY = 2.2 * MM, rule = 0.75;
      for (const [label, value] of v.ukRows) {
        const count = (text, font, width) => String(text).split("\n")
          .reduce((n, part) => n + Math.max(1, wrap(part, font, size, width).length), 0);
        const rows = Math.max(count(label, f.bold, labelW - 2 * padX), count(value, f.regular, W - labelW - 2 * padX));
        const h = rows * lead + 2 * padY;
        page.drawRectangle({ x: M, y: y - h, width: labelW, height: h, color: ff.grey, borderColor: ink, borderWidth: rule });
        page.drawRectangle({ x: M + labelW, y: y - h, width: W - labelW, height: h, borderColor: ink, borderWidth: rule });
        const o = { y: y - padY, size, lead, align: "left", ink };
        lines(page, [{ text: label }], { ...o, x: M + padX, w: labelW - 2 * padX, font: f.bold });
        lines(page, [{ text: value }], { ...o, x: M + labelW + padX, w: W - labelW - 2 * padX, font: f.regular });
        y -= h;
      }

      // Declaration box with signature and date lines.
      y -= 8 * MM;
      const inner = W - 8 * MM;
      const declLines = wrap(v.declaration, f.regular, size, inner).length;
      const boxH = 3.5 * MM + lead + 2 * MM + declLines * lead + 12 * MM + 1.2 * MM + 9 * 1.35 + 5 * MM;
      page.drawRectangle({ x: M, y: y - boxH, width: W, height: boxH, borderColor: ink, borderWidth: rule });
      let dy = lines(page, [{ text: "Declaration of originality", font: f.bold }],
        { x: M + 4 * MM, w: inner, y: y - 3.5 * MM, font: f.bold, ink, size, lead, align: "left" });
      dy = lines(page, [{ text: v.declaration }],
        { x: M + 4 * MM, w: inner, y: dy - 2 * MM, font: f.regular, ink, size, lead, align: "left" });
      dy -= 12 * MM;
      const gap = 6 * MM, sigW = (inner - gap) * 1.6 / 2.6;
      [[M + 4 * MM, sigW, "Student signature"], [M + 4 * MM + sigW + gap, inner - sigW - gap, "Date"]]
        .forEach(([sx, sw, label]) => {
          page.drawLine({ start: { x: sx, y: dy }, end: { x: sx + sw, y: dy }, thickness: rule, color: ink });
          lines(page, [{ text: label }], { x: sx, w: sw, y: dy - 1.2 * MM, font: f.regular, ink, size: 9, lead: 9 * 1.35, align: "left" });
        });
    },
  };

  /** Cover page followed by every page of `assignmentBytes`. */
  async function merge(state, assignmentBytes, values) {
    const template = state.format === "mla" && state.mlaTitlePage ? "mlatp" : (state.format || "bd");
    if (template === "mla") throw new Error("MLA has no cover page to merge");
    const P = PAPER[state.paper] || PAPER.a4;
    const { PDFDocument, StandardFonts, rgb } = await loadLib();
    const pdf = await PDFDocument.create();

    const names = [
      "TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic",
      "Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique",
    ];
    const fonts = {};
    for (const n of names) fonts[StandardFonts[n]] = await pdf.embedFont(StandardFonts[n]);

    const fontFor = {
      faces: faces(fonts, StandardFonts, state.font),
      black: rgb(0, 0, 0),
      rule: rgb(0.12, 0.16, 0.22),
      grey: rgb(0.925, 0.925, 0.925),
      crest: state.logo && (template === "bd" || template === "uk") ? await crest(pdf, state.logo) : null,
    };

    if (template === "bd") await buildCover(pdf, state, StandardFonts, fontFor, P);
    else BUILDERS[template](pdf, P, fontFor, values);

    if (assignmentBytes) {
      const source = await PDFDocument.load(assignmentBytes, { ignoreEncryption: true });
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach(p => pdf.addPage(p));
    }

    return { bytes: await pdf.save(), approximatedFont: fontFor.faces.approximated };
  }

  return { merge, loadLib };
})();
