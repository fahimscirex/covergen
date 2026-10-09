# covergen

Lays out the assignment cover sheet Bangladeshi university students are asked
to hand in, with a live A4 preview and a one-click vector PDF. BUP is the
default; other universities are a dropdown away.

Unofficial. A student-made tool, not affiliated with or endorsed by any of the
universities it lists. Each crest belongs to its university and is included
only so the printed sheet matches what departments expect.

## What it does

- Five formats: the Bangladeshi cover, APA 7, MLA 9 (heading, or a title page
  when asked), Chicago/Turabian and a UK/Australian coursework sheet
- A first visit asks only for the university and format; the preview switches
  as you pick, so you can compare
- True-size A4 or US Letter preview that prints to vector PDF with selectable text
- Pick your university and department; type either in if it is not listed, and upload your own crest
- Search the university's teachers to fill in the Submitted To block
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

## Faculty data

`data/<id>.json` holds one university's faculties, departments and teachers,
plus its masthead text and crest path. Teachers are stored as
`[name, titleIndex, departmentIndex]` rows to keep the files small. The app
fetches a file only when its university is picked.

Covered: BUP, AIUB, AUST, BAU, BRACU, BUET, BUTEX, CU, CUET, DIU, DU, EWU, IUB, IUT,
JnU, JU, KU, KUET, NSU, RU, RUET, SUST, UIU and ULAB, about 12,600 teachers.
BRACU and SUST list departments only: their sites sit behind a Cloudflare bot
check, so their departments come from Wikipedia. Any other university can be
picked as "Not listed" and typed in, with an uploaded crest.

Not yet: MIST, whose site could not be reached from the scraping machine.
RU and BAU serve their teachers through an API keyed with a value from their
own public JavaScript; the scrapers read it from there at run time.

Each file is written by `scrapers/<id>.py` from the university's own website:

```bash
uv run scrapers/bup.py
```

`scrapers/common.py` validates every scrape (each teacher's department must be
listed, no empty result) before writing. To add a university, write a scraper,
put its crest in `data/logos/`, and add it to `UNIVERSITIES` in `app.js`.

## Caching

GitHub Pages only lets browsers cache for 10 minutes, so `sw.js` caches every
file on the first visit and serves repeat visits without touching the network.
**Bump `VERSION` in `sw.js` whenever a deploy changes a served file**, or
returning visitors keep the old copy.

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
- Every cover layout exists twice, as a template in `index.html` and a
  builder in `cover-pdf.js`. The on-screen sheet is the source of truth and the PDF mirrors it, so a
  format change has to be made in both. The international formats share
  their text through `coverValues()` in `app.js`.

`assets/pdf-lib.min.js` is vendored and loaded only when someone merges, so the
first paint downloads none of it.

## Credits

Bitrimus (public domain) and pdf-lib are vendored under `assets/`. Built by
[SC1R3X](https://scirex.me).
