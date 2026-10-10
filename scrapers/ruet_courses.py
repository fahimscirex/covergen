# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""RUET's course codes and titles, from the curriculum PDF each department
links on https://www.<dept>.ruet.ac.bd/page/course-curriculum.

Run: uv run scrapers/ruet_courses.py

Every department typesets its booklet differently, so each gets the patterns
that fit it. ETE, CME, ChE, Chemistry, Mathematics, Physics and Humanities
publish no readable curriculum (empty page or Google Drive links).
"""
import io
import re
import time
import urllib.request
from urllib.parse import urljoin

from pypdf import PdfReader

from common import UA, clean, get, write_courses

D = "Department of "
courses = []
owned = []  # whether each course carries its own department's prefix

CODE = r"[A-Z][A-Za-z]{1,4} ?\d{4}"
# "CE 1201 : Engineering Mechanics", "ECE 1101: Circuits & Systems-I  Credits: 3.00"
COLON = rf"^({CODE})[ \t]*:[ \t]*(.+?)(?:[ \t]+Credits?:.*)?[ \t]*$"
# "MSE 1131 (Physics)", also ME's "ME 2101 (Thermodynamics)"
PAREN = rf"^({CODE})[ \t]+\((.+?)\)[ \t]*$"
# "EEE 2105   Electrical Machine I" above a "Contact hours/week" line
HEADER = rf"^({CODE})[ \t]*\n?[ \t]*(.{{3,90}}?)[ \t]*\n[ \t]*Contact [Hh]ours"
# "MTE 1101 Mechatronic Systems 3.00 3.00" and "3. ME 2101 Thermodynamics 3.00 3.00"
SINGLE = rf"^(?:\d+\.?[ \t]+)?({CODE})[ \t]+(.+?)[ \t]+\d\.\d\d\b"

ENDS_OPEN = re.compile(r"(?:\b(?:and|of|for|in|to|the|with|on)|[&,(-])$", re.I)


def pdf_text(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                data = r.read()
            break
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))
    # Symbol-font glyphs (U+F049 is a Roman numeral "I") come out as private-use characters.
    text = "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages)
    return re.sub(r"[-]", lambda m: chr(ord(m[0]) - 0xF000), text)


def find(pattern, text, flags=re.M):
    """(code, title) pairs; a title cut off by a line break is continued from the next line."""
    lines = text.split("\n")
    if pattern == COLON:
        rows = []
        for i, line in enumerate(lines):
            m = re.match(COLON, line)
            if not m:
                continue
            title = m[2]
            for nxt in lines[i + 1:i + 3]:
                if not ENDS_OPEN.search(title) or re.match(CODE, nxt) or re.search(r"[Cc]redit|\d\.\d\d", nxt):
                    break
                title += " " + nxt.strip()
            rows.append((m[1], title))
        return rows
    return re.findall(pattern, text, flags)


def add(dept, rows, own=""):
    n = 0
    for code, name in rows:
        code, name = clean(code), re.sub(r"\s*\((?:Optional|Elective)\)$", "", clean(name))
        name = re.sub(r"(?:\s+-)+$", "", name).strip(" .:")
        if re.fullmatch(CODE, code) and 2 < len(name) < 100 and not re.search(r"\d ?\.\d", name):
            courses.append((code, name, D + dept))
            owned.append(re.sub(r"[ -]?\d{4}$", "", code).upper() == own.upper())
            n += 1
    print(f"{dept}: {n}")


def curriculum_pdf(slug):
    page = f"https://www.{slug}.ruet.ac.bd/page/course-curriculum"
    links = [urljoin(page, h) for h in re.findall(r'href="([^"]+\.pdf)"', get(page), re.I)]
    keep = [u for u in links if re.search(r"curriculum|syllabus-from", u) and not re.search(r"old|1591597850", u)]
    time.sleep(0.5)
    return keep[0].strip() if keep else None


num = r"\d[\d/.]*"
SPECS = (  # slug, department, patterns (the first title seen for a code wins)
    ("cse", "Computer Science and Engineering", [HEADER]),
    ("eee", "Electrical and Electronic Engineering", [HEADER, SINGLE]),
    ("ece", "Electrical and Computer Engineering", [COLON]),
    ("ce", "Civil Engineering", [COLON]),
    ("arch", "Architecture", [COLON]),
    ("urp", "Urban and Regional Planning", [COLON]),
    ("becm", "Building Engineering and Construction Management", [COLON]),
    ("ipe", "Industrial and Production Engineering", [COLON]),
    ("mte", "Mechatronics Engineering", [SINGLE]),
    ("mse", "Materials Science and Engineering", [PAREN]),
    ("me", "Mechanical Engineering", [PAREN, SINGLE]),
)
for slug, dept, patterns in SPECS:
    url = curriculum_pdf(slug)
    if not url:
        print(f"{dept}: no PDF")
        continue
    text = pdf_text(url)
    add(dept, [row for p in patterns for row in find(p, text)], own=slug)
    time.sleep(0.5)

# Departments reuse each other's codes for different courses (MTE's "ME 2101" is not ME's), and the
# first title wins: let a department's own courses come first.
courses = [c for _, c in sorted(zip((not o for o in owned), courses), key=lambda x: x[0])]
write_courses("ruet", source="https://www.ruet.ac.bd", courses=courses)
