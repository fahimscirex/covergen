# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""University of Rajshahi's course codes, from each department's own site
(www.ru.ac.bd/<dept>/): course tables on its academic/program pages, and the newest
text-based syllabus/curriculum PDFs those pages link. Scanned PDFs are skipped.
Run: uv run scrapers/ru_courses.py"""
import io
import json
import re
import sys
import time
import urllib.request
from urllib.parse import urljoin

from pypdf import PdfReader

from common import ROOT, UA, clean, soup, write_courses

SITE = "https://www.ru.ac.bd"
CODE = r"[A-Za-z]{2,6}\.?\s?-?\d{3,4}[A-Za-z]{0,2}"
PAGE = re.compile(r"syllabus|curricul|course|academic|program|outline|study|detail", re.I)
SKIP_PAGE = re.compile(r"notice|news|event|calendar|calender|routine|gallery|research|publication|admission|result", re.I)
PDF_OK = re.compile(r"syllabus|curricul|course|outline|honou?rs|b\.?sc|m\.?sc|bss|mss|b\.?a\b|m\.?a\b|bba|mba|program", re.I)
PDF_SKIP = re.compile(r"calend[ae]r|routine|notice|result|admission|schedule|exam|seminar|phd|ph\.d|m\.?phil", re.I)
PDFS_PER_DEPT = 4

def tidy(code):
    """"Bot. 601" -> "Bot-601", so that common.course_code() settles the rest."""
    return re.sub(r"^([A-Za-z]+)[\s.-]*(\d)", r"\1-\2", clean(code))


known = {d for f in json.loads((ROOT / "data" / "ru.json").read_text(encoding="utf-8"))["faculties"]
         for d in f["departments"]}


def fetch(url, limit=15_000_000):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read(limit)
        except OSError as e:
            if i == 3 or getattr(e, "code", 500) < 500:
                raise
            time.sleep(2 ** (i + 1))


def junk(title):
    # also what bibliographies and mark breakdowns leave behind ("Press, 1977", "LA (20), Mapping (18)")
    return (len(title) < 4 or len(title) > 100 or not re.search(r"[A-Za-z]{3}", title)
            or not title[0].isupper() or re.search(r"https?:|www\.|Publish|\bPress\b|\bInc\b|\(\d+\)", title)
            or re.match(r"(credits?|marks?|total|hours?|course (no|title|code)|type)\b", title, re.I))


# where the numeric columns (credits, marks, "70+20+10", CLO ticks) start after a title
COLUMNS = re.compile(r"(?<!\S)\d+(?:\.\d+)?(?!\S)|\s\(\s*\d|\s\d+\+\d|\sCLO\d")
HEADING = re.compile(r"(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|year|semester|total|part|group|course|credit|marks?|paper|theory|practical|summer)\b", re.I)


def split_columns(s):
    """"Digital Signal Processing 3 100" -> ("Digital Signal Processing", True): the
    flag says the numeric columns were reached, i.e. the title is complete."""
    s = re.sub(r"[^\w)\].!?+#]+$", "", s)  # tick marks and other symbols the PDF font maps oddly
    m = COLUMNS.search(s)
    return (s[:m.start()], True) if m else (s, False)


def clean_title(t):
    t = re.split(rf"\s+(?:{CODE})\b", clean(t))[0]  # a second code: the next column of the table
    t = re.sub(r"\s+(?:CORE|GED|MAT|LAB|VIVA|Core|Compulsory|Major|Minor|Optional)$", "", t)
    return clean(t).strip(" :-–|")


def from_text(text):
    """Typed or PDF-extracted lines: "PHY 1101: Mechanics", "Chem. 110F Physical Chemistry I  4.0 100",
    and titles wrapped over several lines until the credit column ("ICE3121 Digital Signal / Processing 3")."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        m = re.fullmatch(rf"\s*(?:\d{{1,2}}[.)]\s+|\d{{4}}\s+\d{{2}}\s+)?({CODE})\s*[:\-–.|]?(?:\s+([A-Za-z].*))?", line)
        if not m:
            continue
        title, done = split_columns(m[2] or "")  # no title yet: it is on the next line
        for nxt in map(clean, lines[i + 1:i + 4]):
            part, ended = split_columns(nxt)
            if done or not nxt or len(part) > 50 or HEADING.match(nxt) or re.match(rf"(?:{CODE})\b", nxt):
                break
            title, done = f"{title} {part}", ended
        if not junk(title := clean_title(title)):
            yield tidy(m[1]), title


def from_page(page):
    for tr in page.select("tr"):
        cells = [c for c in (clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])) if c]
        for i, c in enumerate(cells):
            m = re.fullmatch(rf"({CODE})(?:\s*[:\-]\s*(.+))?", c)
            if not m:
                continue
            t = m[2] or next((t for t in cells[i + 1:] if re.search(r"[A-Za-z]{3}", t)
                              and not re.fullmatch(rf"{CODE}|[\d.\s]*(?:credits?|marks?)?", t, re.I)), "")
            if t and not junk(t := clean_title(t)):
                yield tidy(m[1]), t
            break
    yield from from_text(page.get_text("\n"))


def newest_first(urls):
    # uploads live under .../uploads[/sites/N]/YYYY/MM/, so the path sorts by date
    return sorted(urls, key=lambda u: tuple(re.findall(r"/(20\d\d)/(\d\d)/", u)[-1:] or [("0", "0")]), reverse=True)


departments = []
for a in soup(f"{SITE}/academic/department/").find_all("a", href=True):
    t = clean(a.get_text())
    if t.startswith("Department of ") and t in known and a["href"] not in dict(departments).values():
        departments.append((t, a["href"]))

courses = []
for dept, home in departments:
    n = len(courses)
    try:
        time.sleep(0.5)
        base = home.rstrip("/")
        pages, pdfs = {home: soup(home)}, []
        links = {urljoin(home, a["href"]).split("#")[0]
                 for a in pages[home].find_all("a", href=True)
                 if urljoin(home, a["href"]).startswith(base + "/")
                 and (PAGE.search(clean(a.get_text())) or PAGE.search(a["href"]))
                 and not SKIP_PAGE.search(a["href"]) and not a["href"].lower().endswith((".pdf", ".jpg", ".png"))}
        for url in sorted(links)[:10]:
            time.sleep(0.5)
            try:
                pages[url] = soup(url)
            except OSError as e:
                print("skipped", url, e, file=sys.stderr)
        for url, page in pages.items():
            courses += [(c, t, dept) for c, t in from_page(page)]
            for a in page.find_all("a", href=True):
                h = urljoin(url, a["href"])
                label = clean(a.get_text()) + " " + h.rsplit("/", 1)[-1]
                if h.lower().endswith(".pdf") and PDF_OK.search(label) and not PDF_SKIP.search(label) and h not in pdfs:
                    pdfs.append(h)
        for h in newest_first(pdfs)[:PDFS_PER_DEPT]:
            time.sleep(0.5)
            try:
                reader = PdfReader(io.BytesIO(fetch(h)))
                text = "\n".join(p.extract_text() or "" for p in reader.pages)
            except Exception as e:  # unreadable or scanned files: nothing to take from them
                print("skipped", h, type(e).__name__, file=sys.stderr)
                continue
            courses += [(c, t, dept) for c, t in from_text(text)]
    except OSError as e:
        print("skipped", dept, e, file=sys.stderr)
    # bibliographies cite years ("... Publishers, 1977"); a prefix seen only with a year is not a course
    mine = courses[n:]
    prefixes = {c.split("-")[0] for c, _, _ in mine if not re.search(r"-(19|20)\d\d$", c)}
    courses[n:] = [r for r in mine if r[0].split("-")[0] in prefixes]
    print(dept, len(courses) - n, flush=True)

write_courses("ru", source=f"{SITE}/academic/department/", courses=courses)
