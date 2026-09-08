# covergen

Lays out the assignment cover sheet BUP students are asked to hand in, with a
live A4 preview and a one-click vector PDF.

Unofficial. A student-made tool, not affiliated with or endorsed by Bangladesh
University of Professionals. The crest belongs to the university and is
included only so the printed sheet matches what departments expect.

## What it does

- True 210x297mm preview that prints to vector PDF with selectable text
- Search across 387 BUP teachers to fill in the Submitted To block
- Individual or group submissions
- Merge the cover with your own assignment PDF into a single file
- Remembers everything in `localStorage`, so next week you only change the topic
- Adjustable document font, title and headline size, crest size, spacing, border
- Light and dark. The sheet itself stays black on white, because it is print

## Running it

Open `index.html` directly, or serve the folder:

```bash
uv run python -m http.server 8089
```

No build step and no runtime dependencies.

## Deploying

Settings > Pages > Deploy from a branch > `main` > `/ (root)`. It is a static
site, so that is the whole setup.

## UI components

Every control in the app chrome is a component from
[interior.dev](https://www.interior.dev/docs), ported from React + `motion` to
a dependency-free custom element. Each file stands alone: copy one into another
project and it works, which is interior.dev's delivery model kept intact.

`components/interior/` holds the design tokens plus a floating-label field,
dropdown, combobox, accordion, segmented control, loading button,
hold-to-confirm, checkbox and stepper.

Each one keeps interior.dev's three rules, and the header of every file says
how it does so: a component reserves the size of every state it can reach
before it gets there, its transitions retarget from where they currently are
instead of restarting, and `prefers-reduced-motion` removes the travel but
never the information.

## Notes on the merge

The browser cannot hand a rendered page back as a PDF, so `assets/cover-pdf.js`
draws the cover a second time in PDF points and prepends it to your pages. Two
things follow from that:

- PDF has only Times and Helvetica built in. Times New Roman and Arial come out
  exactly; EB Garamond, Libre Baskerville and Georgia fall back to Times in the
  merged file. Use Print instead of Merge if the family matters.
- The cover layout now exists twice. The on-screen sheet is the source of truth
  and `cover-pdf.js` mirrors it, so a format change has to be made in both.

`assets/pdf-lib.min.js` is vendored and loaded only when someone merges, so the
first paint downloads none of it.

## Credits

Bitrimus (public domain) and pdf-lib are vendored under `assets/`. Built by
[SC1R3X](https://scirex.me).
