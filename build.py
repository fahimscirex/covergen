#!/usr/bin/env python3
"""Generate the crawlable half of the site from data/.

The app itself is one page, which gives search engines and AI assistants
nothing to rank or cite for "BUET assignment cover page". This writes a real
page per university from the directory data already in data/<id>.json, plus
robots.txt, sitemap.xml and llms.txt, and refreshes the university list inside
index.html.

Everything it writes is committed, so GitHub Pages still serves plain static
files and the app keeps its zero-build promise. Run it after changing data/:

    uv run python build.py
"""

import json
import pathlib
import re
import sys
from datetime import date
from html import escape

ROOT = pathlib.Path(__file__).parent
SITE = "https://covergen.scirex.me"
TODAY = date.today().isoformat()

# Mirrors UNIVERSITIES in app.js. The "other" entry has no data file and no page.
UNIVERSITIES = [
    ("bup", "BUP"), ("aiub", "AIUB"), ("aust", "AUST"), ("brac", "BRACU"),
    ("bau", "BAU"), ("buet", "BUET"), ("butex", "BUTEX"), ("cu", "CU"),
    ("cuet", "CUET"), ("diu", "DIU"), ("du", "DU"), ("ewu", "EWU"),
    ("iub", "IUB"), ("iut", "IUT"), ("jnu", "JnU"), ("ju", "JU"),
    ("ku", "KU"), ("kuet", "KUET"), ("nsu", "NSU"), ("ru", "RU"),
    ("ruet", "RUET"), ("sust", "SUST"), ("uiu", "UIU"), ("ulab", "ULAB"),
]

FORMATS = [
    ("Bangladeshi", "crest, masthead, Submitted To and Submitted By blocks"),
    ("APA 7", "a plain centred title page, double spaced"),
    ("MLA 9", "no cover page, a heading on your first page"),
    ("Chicago / Turabian", "the title a third of the way down, your details below"),
    ("UK / Australian", "a details table and a signed declaration"),
]


def load(uid):
    return json.loads((ROOT / "data" / f"{uid}.json").read_text(encoding="utf-8"))


def counts(d):
    """Faculties, departments and named teachers in a university's file."""
    facs = d.get("faculties") or []
    depts = {dep for f in facs for dep in (f.get("departments") or [])}
    teachers = d.get("teachers")
    n_teachers = len(teachers) if isinstance(teachers, list) else sum(
        len(v) for v in teachers.values()) if isinstance(teachers, dict) else 0
    return len(facs), len(depts), n_teachers


def faq(short, name, n_fac, n_dep, n_teach):
    """Questions a student actually types, answered in 40-60 words so the
    answer survives being lifted out of the page on its own."""
    q = [(
        f"Is the {short} assignment cover page generator free?",
        f"Yes. covergen is free for every {short} student, with no account and no "
        f"limit on how many covers you make. It runs entirely in your browser, so "
        f"your name, student ID and teacher's name never leave your device.",
    ), (
        f"What goes on a {short} assignment cover page?",
        f"A {name} cover page carries the university name and crest, the assignment "
        f"title, the course title and code, your teacher's name and department under "
        f"Submitted To, and your name, ID, section and session under Submitted By.",
    )]
    if n_dep:
        q.append((
            f"Does it have {short} departments and teachers?",
            f"Yes. {short} ships with {n_dep} departments"
            + (f" across {n_fac} faculties" if n_fac else "")
            + (f" and {n_teach} teachers" if n_teach else "")
            + ". Search a teacher's name and their designation and department fill in "
              "automatically. Anything missing can be typed by hand.",
        ))
    q += [(
        f"How do I save the {short} cover page as a PDF?",
        "Press Print and choose Save as PDF as the destination. The cover prints as "
        "vector at exactly 210 by 297 millimetres, so the text stays selectable and "
        "sharp instead of coming out as a blurry screenshot.",
    ), (
        f"Can I join the cover to my finished {short} assignment?",
        "Yes. Choose Merge assignment and pick your assignment PDF. You get back a "
        "single file with the cover as page one and your own pages after it, ready "
        "to upload or print.",
    ), (
        "Is this an official university tool?",
        f"No. covergen is made by a student and is not affiliated with or endorsed by "
        f"{name}. The crest belongs to the university and is included only so your "
        f"printed cover matches what your department expects.",
    )]
    return q


def page(uid, short, d, others):
    name = d["name"]
    n_fac, n_dep, n_teach = counts(d)
    url = f"{SITE}/u/{uid}/"
    title = f"{short} Assignment Cover Page Generator | Free A4 PDF"
    desc = (f"Make a {name} ({short}) assignment cover page free. Live A4 preview, "
            f"real department and teacher lists, one-click vector PDF. Also APA 7, "
            f"MLA 9 and Chicago.")[:300]

    qa = faq(short, name, n_fac, n_dep, n_teach)
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": f"covergen for {short}",
                "applicationCategory": "UtilitiesApplication",
                "operatingSystem": "Any browser",
                "url": url,
                "description": desc,
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "BDT"},
                "isAccessibleForFree": True,
                "inLanguage": "en",
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": q,
                     "acceptedAnswer": {"@type": "Answer", "text": a}}
                    for q, a in qa
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "covergen", "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": short, "item": url},
                ],
            },
        ],
    }

    stat_bits = []
    if n_fac:
        stat_bits.append(f"{n_fac} faculties")
    if n_dep:
        stat_bits.append(f"{n_dep} departments")
    if n_teach:
        stat_bits.append(f"{n_teach} teachers")
    stats = ", ".join(stat_bits) if stat_bits else "the fields filled in by hand"

    src = d.get("source", "")
    updated = d.get("updated", TODAY)

    links = "\n".join(
        f'            <li><a href="/u/{o}/">{os_}</a></li>'
        for o, os_ in others
    )
    fmt_rows = "\n".join(
        f"            <tr><td>{escape(f)}</td><td>{escape(w)}</td></tr>"
        for f, w in FORMATS
    )
    faq_html = "\n".join(
        f"          <h3>{escape(q)}</h3>\n          <p>{escape(a)}</p>"
        for q, a in qa
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(title)}</title>
<meta name="description" content="{escape(desc)}">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="apple-touch-icon" href="/assets/favicon-180.png">
<meta name="theme-color" content="#4568ff">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="covergen">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(desc)}">
<meta property="og:image" content="{SITE}/assets/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(title)}">
<meta name="twitter:description" content="{escape(desc)}">
<meta name="twitter:image" content="{SITE}/assets/og-cover.png">
<link rel="stylesheet" href="/components/interior/tokens.css">
<link rel="stylesheet" href="/landing.css">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
</head>
<body>
  <header class="bar">
    <a class="home" href="/">covergen</a>
    <a class="cta" href="/?u={uid}">Open the generator</a>
  </header>

  <main>
    <article>
      <h1>{escape(name)} assignment cover page</h1>
      <p class="lede">
        Make a {escape(short)} cover page in your browser, see it on an exact A4 sheet as
        you type, and print it as a vector PDF. It is free, needs no account, and
        {escape(stats)} come built in.
      </p>
      <p><a class="cta big" href="/?u={uid}">Open the generator for {escape(short)}</a></p>

      <h2>What a {escape(short)} cover page needs</h2>
      <p>
        {escape(name)} assignments are handed in behind a cover sheet carrying the
        university name and crest, the assignment title, the course title and code, the
        teacher's name, designation and department, and the student's own name, ID,
        section and session. covergen lays all of that out for you and keeps every field
        editable.
      </p>

      <h2>Formats you can print</h2>
      <table>
        <thead><tr><th>Format</th><th>What it looks like</th></tr></thead>
        <tbody>
{fmt_rows}
        </tbody>
      </table>

      <h2>Frequently asked questions</h2>
{faq_html}

      <h2>Other universities</h2>
      <ul class="others">
{links}
      </ul>

      <p class="meta">
        {escape(short)} directory last updated {escape(updated)}{
        f' from <a href="{escape(src)}" rel="nofollow noopener">the university site</a>' if src else ''}.
        covergen is a student project, not affiliated with or endorsed by {escape(name)}.
      </p>
    </article>
  </main>

  <footer class="bar">
    <a href="/">All universities</a>
    <a href="https://scirex.me" rel="noopener">by SC1R3X</a>
  </footer>
</body>
</html>
"""


def main():
    pages = []
    for uid, short in UNIVERSITIES:
        if not (ROOT / "data" / f"{uid}.json").exists():
            print(f"  skip {uid}: no data file", file=sys.stderr)
            continue
        d = load(uid)
        others = [(o, s) for o, s in UNIVERSITIES if o != uid]
        out = ROOT / "u" / uid
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(page(uid, short, d, others), encoding="utf-8")
        pages.append((uid, short, d["name"]))
    print(f"  {len(pages)} university pages")

    # index.html keeps the same list, so the app links to every page too.
    idx = ROOT / "index.html"
    html = idx.read_text(encoding="utf-8")
    items = "\n".join(
        f'                <li><a href="/u/{u}/">{escape(s)} <span>{escape(n)}</span></a></li>'
        for u, s, n in pages
    )
    html = re.sub(
        r"(<!-- UNIVERSITY-LINKS:START -->).*?(<!-- UNIVERSITY-LINKS:END -->)",
        lambda m: f"{m.group(1)}\n{items}\n                {m.group(2)}",
        html, flags=re.S,
    )
    idx.write_text(html, encoding="utf-8")
    print("  index.html university list")

    urls = [(SITE + "/", "1.0")] + [(f"{SITE}/u/{u}/", "0.8") for u, _, _ in pages]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(
            f"  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod>"
            f"<changefreq>monthly</changefreq><priority>{p}</priority></url>\n"
            for u, p in urls)
        + "</urlset>\n", encoding="utf-8")
    print(f"  sitemap.xml ({len(urls)} urls)")

    (ROOT / "robots.txt").write_text(
        "# Everything here is public and free to read, including by AI assistants:\n"
        "# GPTBot, ClaudeBot, PerplexityBot and Google-Extended are all welcome.\n"
        "# A shared cover lives in the URL fragment (#s=), which never reaches a\n"
        "# server and so needs no crawl rule.\n"
        "User-agent: *\n"
        "Allow: /\n\n"
        f"Sitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    print("  robots.txt")

    uni_lines = "\n".join(f"- [{s}]({SITE}/u/{u}/): {n}" for u, s, n in pages)
    (ROOT / "llms.txt").write_text(f"""# covergen

> A free browser tool that lays out and prints the assignment cover page that
> Bangladeshi university students hand in. It covers {len(pages)} universities with their
> real faculty, department and teacher lists, and also prints APA 7, MLA 9,
> Chicago (Turabian) and UK/Australian coursework sheets.

covergen runs entirely in the browser. Nothing is uploaded: a student's name,
ID and teacher are kept in local storage on their own device. There is no
account, no payment and no usage limit, and the app keeps working offline once
loaded. Output is a vector PDF at exactly 210 by 297 mm, with selectable text.
It can also merge the cover with a student's own assignment PDF into one file.

covergen is a student project by SC1R3X ({SITE}). It is not affiliated with or
endorsed by any university. Each crest belongs to its university and appears
only so the printed cover matches what departments expect.

## Universities
{uni_lines}

## Formats
{chr(10).join(f"- {f}: {w}" for f, w in FORMATS)}

## Pages
- [Generator]({SITE}/): the app itself
- [Source](https://github.com/fahimscirex/covergen): open source on GitHub
""", encoding="utf-8")
    print("  llms.txt")

    (ROOT / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    print("building:")
    main()
    print("done")
