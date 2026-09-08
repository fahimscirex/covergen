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
  const PAGE = { w: 210 * MM, h: 297 * MM };
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

  async function crest(pdf) {
    const res = await fetch("assets/bup_logo.svg");
    const svg = await res.text();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
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

  async function buildCover(pdf, state, S, fontFor) {
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
    const logoW = logoH * fontFor.crest.ratio;
    // Its own block, matching the preview: space-evenly then centres the crest
    // between the masthead and the assignment.
    const crestBlock = {
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

    const blocks = [stack(mastParts), crestBlock, assignment, to, stack(byParts)];

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

  /** Cover page followed by every page of `assignmentBytes`. */
  async function merge(state, assignmentBytes) {
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
      crest: await crest(pdf),
    };

    await buildCover(pdf, state, StandardFonts, fontFor);

    if (assignmentBytes) {
      const source = await PDFDocument.load(assignmentBytes, { ignoreEncryption: true });
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach(p => pdf.addPage(p));
    }

    return { bytes: await pdf.save(), approximatedFont: fontFor.faces.approximated };
  }

  return { merge, loadLib };
})();
