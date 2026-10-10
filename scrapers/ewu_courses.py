# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""East West University's course codes, from each department's own course
pages (course catalog / course list / core and elective courses / program
pages), which the faculty sites link under the department's URL.
Run: uv run scrapers/ewu_courses.py"""
import re
import time
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from common import clean, get, soup, write_courses

BASE = "https://www.ewubd.edu"
CODE = r"[A-Z]{2,4}\s?\d{3,4}[A-Z]?"
LINK = re.compile(r"course|curricul|program|catalog|list|categor|core|elective|description|ug-|-ug")
SKIP = re.compile(r"news|notice|event|admission|alumni|faculty-member")
JUNK = re.compile(r"^(Description|Credits?|Pre-?requisites?|Course (Objective|Description)|None|Nil)\b", re.I)
# linked from another department's menu but belongs to Civil Engineering
EXTRA = {"Department of Civil Engineering": ["https://fse.ewubd.edu/civil-engineering/course-table"]}


def title_ok(t):
    return (bool(re.match(r"^[A-Za-z(][^\n]{2,110}$", t)) and not JUNK.match(t)
            and not re.match(rf"^{CODE}\b", t) and not re.fullmatch(CODE, t)
            and not re.match(r"^\d+(\.\d+)?$|^\(\d", t) and not re.search(r"\bmay be\b", t) and not re.search(r"\bcredits?\b", t, re.I))


def tidy(t):
    t = re.sub(r"\s*\([^)]*$", "", clean(t))  # "...Management(ELECTIVE UPPER LEVEL COURSES" cut off mid-bracket
    return t.strip(" :-;,")


def extract(page):
    """(code, title, kind): table rows (0), 'CODE: Title' headings (1), or 'CODE' / 'Title' line pairs (2)."""
    out = []
    for tr in page.select("table tr"):
        c = [clean(x.get_text(" ")) for x in tr.select("td,th")]
        if len(c) >= 2 and re.fullmatch(CODE, c[0]) and title_ok(c[1]):
            out.append((c[0], c[1], 0))
    lines = [clean(l) for l in page.get_text("\n").split("\n") if clean(l)]
    for i, l in enumerate(lines):
        m = re.match(rf"^({CODE})\s*[-–:.]+\s*(.+)$", l) or re.match(rf"^({CODE})\s+([A-Z].{{2,110}})$", l)
        if m and title_ok(m[2]):
            out.append((m[1], m[2], 1))
        elif re.fullmatch(CODE, l) and i + 1 < len(lines) and title_ok(lines[i + 1]):
            out.append((l, lines[i + 1], 2))
    return out


home = soup(BASE)
found = []
n = 0
for head in home.select("a.facultyMenuHead"):
    for a in head.find_next_sibling("ul").select("a"):
        dept, url = clean(a.get_text().replace("&", "and")), a["href"]
        slug = urlparse(url).path
        pages = [url]
        for link in soup(url).select("a[href]"):
            path = urlparse(urljoin(url, link["href"])).path
            full = urljoin(url, link["href"]).split("#")[0]
            if path.startswith(slug + "/") and LINK.search(path[len(slug):]) and not SKIP.search(path) and full not in pages:
                pages.append(full)
        for full in pages[1:] + EXTRA.get(dept, []):
            time.sleep(0.5)
            try:
                html = soup(full)
            except Exception as e:  # a few linked pages are dead (404)
                print(f"skip {full}: {e}")
                continue
            found += [(kind, n, code, tidy(title), dept) for code, title, kind in extract(html)]
            n += 1
        time.sleep(0.5)

courses = [(code, title, dept) for _, _, code, title, dept in sorted(found, key=lambda f: f[:2]) if title]
write_courses("ewu", source=BASE, courses=courses)
