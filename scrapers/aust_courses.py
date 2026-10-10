# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""AUST's course codes, from each department's syllabus page. The pages embed the
curriculum PDFs from Google Drive; their course lists are read with pypdf.
Run: uv run scrapers/aust_courses.py"""
import io
import re
import time
import urllib.request

from pypdf import PdfReader

from common import UA, clean, get, soup, write_courses

BASE = "https://www.aust.edu"
DRIVE = "https://drive.usercontent.google.com/download?id={}&export=download"
ENG = "Department of {}"

# department -> [(pdf, page url, which embedded syllabus)]. Only the newest curriculum of each
# department is read; older ones list retired courses. A numbered entry picks the n-th <iframe>.
DEPTS = [
    (ENG.format("Civil Engineering"), "ce/syllabus", 0),
    (ENG.format("Computer Science and Engineering"), "cse/syllabus", 0),
    (ENG.format("Electrical and Electronic Engineering"), "eee/syllabus", 0),
    (ENG.format("Mechanical and Production Engineering"), "mpe/syllabus/me", 0),
    (ENG.format("Textile Engineering"), "te/undergraduate_syllabus", 0),
    (ENG.format("Architecture"), "arch/undergraduate_syllabus", 0),
    ("School of Business", "sob/syllabus", 0),
]

CODE = re.compile(r"^(?:\d{1,2}\.?\s+)?((?:[A-Za-z]{2,5}\s?\d{4}[A-Za-z]?)|(?:0\d{7}))\s*:?\s+(.*)$")
NUM = re.compile(r"^\d+(?:[.\-/]\d+)*$")


def title_of(text):
    """Cut a printed table row's title off before the hours/credits columns."""
    words = []
    for w in text.split():
        if NUM.match(w) or w in ("Page", "-") and words:
            break
        words.append(w)
    return " ".join(words)


def parse(pdf):
    lines = [clean(l) for p in PdfReader(io.BytesIO(pdf)).pages for l in (p.extract_text() or "").split("\n")]
    for i, line in enumerate(lines):
        m = CODE.match(line)
        if not m:
            continue
        code, rest = m[1], m[2]
        # Titles wrap onto the next line(s) ("... Programming" / "Lab. 1.5").
        joined = rest
        for nxt in lines[i + 1:i + 3]:
            if any(NUM.match(w) for w in joined.split()) or not nxt or CODE.match(nxt):
                break
            joined += " " + nxt
        name = title_of(joined).strip(" :,")
        # Prose that merely starts with a code ("CSE3103 where the first digit...").
        if name[:1].isupper() and len(name) > 2 and not re.search(r"\b(?:Page|Total|Prerequisite)\b", name):
            yield code, name


def drive_pdf(page, n):
    ids = re.findall(r'<iframe[^>]+src="https://drive\.google\.com/file/d/([\w-]+)/preview', get(f"{BASE}/{page}"))
    if len(ids) <= n:  # the Architecture page links its PDF differently
        raise SystemExit(f"{page}: no embedded syllabus {n}")
    req = urllib.request.Request(DRIVE.format(ids[n]), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


courses = []
for dept, page, n in DEPTS:
    courses += [(c, t, dept) for c, t in parse(drive_pdf(page, n))]
    time.sleep(0.5)

# Arts and Sciences publishes its M.S. in Mathematics list as an HTML table.
for tr in soup(f"{BASE}/as/syllabus").select("table tr"):
    td = [clean(x.get_text(" ")) for x in tr.find_all("td")]
    if len(td) >= 2 and re.fullmatch(r"[A-Z]{2,5} ?\d{4}", td[0]):
        courses.append((td[0], td[1], ENG.format("Arts and Sciences")))

write_courses("aust", source=f"{BASE}/academics/faculties_&_departments", courses=courses)
