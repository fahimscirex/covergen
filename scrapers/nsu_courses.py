# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""North South University's course codes. NSU publishes no single catalogue:
the SBE departments share a BBA course-handbook PDF, and every other
department has its own HTML curriculum / course-description pages or PDFs,
so each source below is mapped to its department by hand.
Run: uv run scrapers/nsu_courses.py"""
import io
import logging
import re
import time
import unicodedata
import urllib.request

from bs4 import BeautifulSoup
from pypdf import PdfReader

from common import UA, clean, write_courses

logging.disable(logging.CRITICAL)  # pypdf nags about fonts it can read fine
BASE = "https://www.northsouth.edu"
ECE = "https://ece.northsouth.edu/"
D = "Department of "
CODE = r"[A-Z]{2,4}\s?\d{3}[A-Z]?"
SBE = ["Accounting and Finance", "Economics", "Management", "Marketing and International Business"]
BY_PREFIX = {"ACT": SBE[0], "FIN": SBE[0], "ECO": SBE[1], "MGT": SBE[2], "HRM": SBE[2], "MIS": SBE[2],
             "SCM": SBE[2], "MKT": SBE[3], "INB": SBE[3]}

# (page, department): HTML pages, read by the generic extractor below
PAGES = [
    (f"{BASE}/academic/seps/architecture.html", "Architecture"),
    (f"{BASE}/academic/seps/cee/bs-in-cee/course-descriptions-for-spring-2019-onword.html", "Civil and Environmental Engineering"),
    (f"{BASE}/academic/seps/cee/bs-in-cee/course-descriptions.html", "Civil and Environmental Engineering"),
    (f"{BASE}/academic/seps/math-physics/", "Mathematics and Physics"),
    (f"{ECE}undergraduate/academics/programs/bachelor-of-science-in-computer-science-and-engineering-bscse-134-credit-hours/", "Electrical and Computer Engineering"),
    (f"{ECE}undergraduate/academics/programs/bachelor-of-science-in-electrical-and-electronic-engineering-bseee-135-credit-hours/", "Electrical and Computer Engineering"),
    (f"{ECE}undergraduate/academics/programs/bs-eee/", "Electrical and Computer Engineering"),
    (f"{ECE}graduate/academics/programs/ms-cse/", "Electrical and Computer Engineering"),
    (f"{BASE}/academic/programs-18022021/bachelor/ba-english.html", "English and Modern Languages"),
    (f"{BASE}/academic/programs-18022021/master/ma-in-english.html", "English and Modern Languages"),
    (f"{BASE}/academic/programs-18022021/bachelor/llb.html", "Law"),
    (f"{BASE}/academic/programs-18022021/master/master-of-laws-ll.m.html", "Law"),
    (f"{BASE}/academic/shss/dhp.html", "History and Philosophy"),
    (f"{BASE}/academic/programs-18022021/master/mbt.html", "Biochemistry and Biotechnology"),
    (f"{BASE}/academic/shls/esm/", "Environmental Science and Management"),
    (f"{BASE}/academic/shls/pharmacy/bpharm-professional-original.html", "Pharmaceutical Sciences"),
    (f"{BASE}/academic/programs-18022021/master/mph.html", "Public Health"),
    (f"{BASE}/academic/programs-18022021/master/emph.html", "Public Health"),
    (f"{BASE}/academic/programs-18022021/bachelor/bs-in-public-health.html", "Public Health"),
    (f"{BASE}/academic/programs-18022021/master/ms.html", "Economics"),
    (f"{BASE}/academic/programs-18022021/master/mds-program.html", "Economics"),
    (f"{BASE}/academic/programs-18022021/bachelor/bs-eco-old.html", "Economics"),
]
# PDFs whose lines read "CODE  Title  credits"
PDFS = [
    (f"{BASE}/newassets/images/SHSS/2.-course-syllabus-(detailed).pdf", "Biochemistry and Biotechnology"),
    (f"{BASE}/newassets/images/bio/bs-mic-fn-approved-by-ugc-on-04092019-(1).pdf", "Microbiology"),
    (f"{BASE}/newassets/images/pss/bss-in-soc-curriculum-compressed.pdf", "Political Science and Sociology"),
    (f"{BASE}/newassets/images/pss/updated-bachelor-of-social-science-in-anthropology-curriculum-05-feb-2026-compressed.pdf", "Political Science and Sociology"),
]
HANDBOOK = f"{BASE}/newassets/images/BBA/bba-course-handbook.pdf"
JUNK = re.compile(r"^(Course (Short )?(Description|Content|outline)|Objectives|Curriculum|pdf\b|Pre-?requisites?|Credit)", re.I)


def fetch(url):
    for i in range(4):
        try:
            time.sleep(0.5)
            with urllib.request.urlopen(urllib.request.Request(url.replace(" ", "%20"), headers={"User-Agent": UA}), timeout=120) as r:
                return r.read()
        except Exception:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


def pdf_text(url):
    return unicodedata.normalize("NFKC", "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(fetch(url))).pages))


def title_ok(t):
    return (bool(re.match(r"^[A-Za-z(][^\n]{2,110}$", t)) and not JUNK.match(t)
            and not re.match(r"^(\d+(\.\d+)?\s*(credits?|cr)?|pre-?req\w*|credits?|none|nil)\b", t, re.I)
            and not re.search(r"\bcredits?\)?\.?$", t, re.I) and not re.fullmatch(CODE, t))


def tidy(t):
    t = re.sub(r"\s*\((?:pre-?req\w*|co-?req\w*)[^)]*\)?", "", clean(t), flags=re.I)
    t = re.sub(r"\s*\((?:Elective|GE|Core)\)$", "", t)
    return t.strip(" :-;,").rstrip(".") if not re.search(r"\bLab\.$", t) else t.strip(" :-;,")


def extract(html):
    """(code, title, kind) from table rows, 'CODE - Title' lines and 'CODE' / 'Title' line pairs.
    Tables are the most reliable, so callers rank kinds in that order."""
    page = BeautifulSoup(html, "html.parser")
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
        elif l == "Code" and i and i + 1 < len(lines) and re.fullmatch(CODE, lines[i + 1]) and title_ok(lines[i - 1]):
            out.append((lines[i + 1], lines[i - 1], 1))  # Mathematics & Physics: "Title / Code / MAT116"
    return out


courses = []

# 1. SBE: BBA course handbook. Sections 4-6 (school core, BBA core, GED) are
# shared by every department; sections 7+ are one discipline each.
section = 0
for line in pdf_text(HANDBOOK).split("\n"):
    if m := re.match(r"^(\d{1,2})\. [A-Z][A-Z &()]+$", line.strip()):
        section = int(m[1])
    m = re.match(r"^\s*([A-Z]{3}\d{3}[A-Z]?(?:\s*/\s*[A-Z]{3}\d{3}[A-Z]?)*)\s+-\s+(.+?)\s*\(\d+ Credits?\)", line)
    if m and section >= 4:
        for code in re.split(r"\s*/\s*", m[1]):
            depts = [BY_PREFIX[code[:3]]] if section >= 7 and code[:3] in BY_PREFIX else SBE
            courses += [(code, tidy(m[2]), D + d) for d in depts]

# 2. Departments with their own pages
found = []
for n, (url, dept) in enumerate(PAGES):
    html = fetch(url).decode("utf-8", "replace")
    found += [(kind, n, code, tidy(title), D + dept) for code, title, kind in extract(html)]
for kind, _, code, title, dept in sorted(found, key=lambda f: f[:2]):
    if title:
        courses.append((code, title, dept))

# 3. PDFs: "CODE  Title  credits" lines (one course each; "A/B" alternatives and prose are skipped)
for url, dept in PDFS:
    for line in pdf_text(url).split("\n"):
        m = re.match(rf"^\s*({CODE})\s{{1,}}([A-Za-z][^\n]*?)\s+(?:\d/?\d?|0\d)\s*$", line)
        if m and title_ok(m[2]) and "/" not in m[1]:
            courses.append((m[1], tidy(m[2]), D + dept))

write_courses("nsu", source=f"{BASE}/academic", courses=courses)
