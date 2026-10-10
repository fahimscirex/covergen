# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""Jahangirnagar University's course codes. Only some departments publish their
syllabus on the program pages (juniv.edu/department/<d>/program/<id>), as tables,
typed lists or linked PDFs (department/<n>/file/<id>); the rest say "Contents are
coming soon". Run: uv run scrapers/ju_courses.py"""
import io
import json
import re
import sys
import time
import urllib.request
from urllib.parse import urljoin

from pypdf import PdfReader

from common import ROOT, UA, clean, soup, write_courses

BASE = "https://juniv.edu"
# "PHY 1101", "Chem. 110F", "Chem. 115LH", and the numeric "0542-1101" of Statistics and Data Science
CODE = r"[A-Za-z]{2,6}\.?\s?-?\d{3,4}[A-Za-z]{0,2}|\d{4}-\d{4}"
PDFS_PER_DEPT = 4

def tidy(code):
    """"Bot. 601" -> "Bot-601", so that common.course_code() settles the rest."""
    return re.sub(r"^([A-Za-z]+)[\s.-]*(\d)", r"\1-\2", clean(code))


known = {d for f in json.loads((ROOT / "data" / "ju.json").read_text(encoding="utf-8"))["faculties"]
         for d in f["departments"]}
home = soup(BASE)
units = [(clean(a.get_text()).replace("&", "and"), a["href"])
         for a in home.select('#departments .card li a, a[href*="/institute/"]')]


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
    t = re.sub(r"\s+(?:CORE|GED|MAT|LAB|VIVA|ICT|Elective|Core|Compulsory|Major|Minor|Optional)$", "", t)
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
    """(code, title) from table rows, then from typed lines."""
    for tr in page.select("tr"):
        cells = [c for c in (clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])) if c]
        for i, c in enumerate(cells):
            m = re.fullmatch(rf"({CODE})(?:\s*(?:\(Lab\))?\s*[:\-]\s*(.+))?", c)
            if not m:
                continue
            t = m[2] or next((t for t in cells[i + 1:] if re.search(r"[A-Za-z]{3}", t)
                              and not re.fullmatch(rf"{CODE}|[\d.\s]*(?:credits?|marks?)?", t, re.I)), "")
            if t and not junk(t := clean_title(t)):
                yield tidy(m[1]), t
            break
    yield from from_text(page.get_text("\n"))


def fetch(url, limit=25_000_000):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read(limit)
        except OSError as e:
            if i == 3 or getattr(e, "code", 500) < 500:
                raise
            time.sleep(2 ** (i + 1))


courses = []
for dept, url in dict.fromkeys(units):
    if dept not in known:
        print("not in data/ju.json:", dept)
        continue
    time.sleep(0.5)
    n = len(courses)
    files = {}
    for program in dict.fromkeys(a["href"] for a in soup(url).select('a[href*="/program/"]')):
        time.sleep(0.5)
        try:
            page = soup(program)
        except OSError as e:
            print("skipped", program, e, file=sys.stderr)
            continue
        courses += [(c, t, dept) for c, t in from_page(page)]
        for a in page.select('a[href*="/file/"]'):
            files[urljoin(program, a["href"])] = None
    # the newest files carry the highest ids
    for f in sorted(files, key=lambda u: int(re.search(r"/file/(\d+)", u)[1]), reverse=True)[:PDFS_PER_DEPT]:
        time.sleep(0.5)
        try:
            text = "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(fetch(f))).pages)
        except Exception as e:  # not a readable PDF (scans, other formats): nothing to take
            print("skipped", f, type(e).__name__, file=sys.stderr)
            continue
        courses += [(c, t, dept) for c, t in from_text(text)]
    print(dept, len(courses) - n, flush=True)

write_courses("ju", source=f"{BASE}/teachers", courses=courses)
