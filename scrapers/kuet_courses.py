# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""KUET's course codes and titles, from each department's website.

Run: uv run scrapers/kuet_courses.py

Civil, URP, BECM, Architecture, EEE and IEM publish their curriculum as HTML
tables under /<dept>/ugcurriculum (IEM also under /pgcurriculum). CSE and ECE
link an OBE curriculum PDF, and ME one syllabus PDF per term. The other
departments publish nothing readable (empty pages or Google Drive links).
"""
import io
import re
import time
import urllib.request
from urllib.parse import quote, urljoin

from pypdf import PdfReader

from common import UA, clean, get, soup, write_courses

BASE = "https://kuet.ac.bd"
D = "Department of "
courses = []
GREEK = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΧΥ", "ABEZHIKMNOPTXY")


def add(dept, rows):
    n = 0
    for code, name in rows:
        # IEM's tables use Greek capitals that look like Latin ones ("ΜΕ 2111").
        code, name = clean(code).translate(GREEK), re.sub(r"\s*\((?:Optional|Elective)\)$", "", clean(name))
        if re.fullmatch(r"[A-Za-z]{1,5}[ -]?\d{4}", code) and 2 < len(name) < 100 and not re.search(r"\d ?\.\d", name):
            courses.append((code, name, D + dept))
            n += 1
    print(f"{dept}: {n}")
    time.sleep(0.5)


def pdf_text(url):
    url = urljoin(BASE + "/", quote(url, safe="/:%"))
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                data = r.read()
            break
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages)


def pdf_links(slug, page):
    html = get(f"{BASE}/{slug}/{page}")
    return re.findall(r'(?:src|href)="(/storage/webfile/[^"]+\.pdf)"', html)


def table(slug, page):
    """Rows of the curriculum tables: [serial,] course code, title, credit, ..."""
    out = []
    for tr in soup(f"{BASE}/{slug}/{page}").select("table tr"):
        td = [clean(c.get_text(" ")) for c in tr.find_all("td")]
        if len(td) >= 3:
            out.append((td[0], td[1]) if re.fullmatch(r"[A-Za-z]{2,5} ?\d{4}", td[0]) else (td[1], td[2]))
    time.sleep(0.5)
    return out


for slug, dept in (("ce", "Civil Engineering"), ("urp", "Urban and Regional Planning"),
                   ("becm", "Building Engineering and Construction Management"), ("arch", "Architecture"),
                   ("eee", "Electrical and Electronic Engineering"), ("iem", "Industrial Engineering and Management")):
    rows = table(slug, "ugcurriculum")
    if slug == "iem":
        rows += table(slug, "pgcurriculum")
    add(dept, rows)

# CSE: summary tables of "CSE 1101 Structured Programming 3.00", and the course sheets.
for url in pdf_links("cse", "pgcurriculum"):  # the page is mislabelled "OBE Curriculum UG"
    text = pdf_text(url)
    add("Computer Science and Engineering",
        re.findall(r"^([A-Z][A-Za-z]{1,4} \d{4})[ \t]+(.+?)[ \t]+\d\.\d\d(?: credits)?[ \t]*$", text, re.M))

# ECE: term tables, "ECE 1109 Introduction to ... 3 0 3" (theory hours, lab hours, credit); titles wrap.
for url in pdf_links("ece", "ugcurriculum"):
    text = pdf_text(url)
    num = r"\d+(?:\.\d+)?"
    add("Electronics and Communication Engineering",
        [(c, " ".join(n.split())) for c, n in re.findall(
            rf"^([A-Z][A-Za-z]{{1,4}} ?\d{{4}})[ \t]+(.{{3,120}}?)\s+{num}[ \t]+{num}[ \t]+{num}[ \t]*$", text, re.M | re.S)])

# ME: one syllabus PDF per term; each course sheet starts "ME 1105 (Thermal Engineering)".
rows = []
for url in pdf_links("me", "ugcurriculum"):
    rows += re.findall(r"^([A-Z][A-Za-z]{1,4} ?\d{4}) \((.+)\)[ \t]*$", pdf_text(url), re.M)
add("Mechanical Engineering", rows)

# Humanities and Business: a summary of the service courses it teaches, "1. Hum -1201 Accounting CE 2.00 ...".
for url in pdf_links("hum", "ugcurriculum"):
    add("Humanities and Business",
        [(re.sub(r"\s", "", c), " ".join(n.split())) for c, n in re.findall(
            r"^\d+\.[ \t]*(Hum[ \t]*-?[ \t]*\d{4})[ \t]+(.{3,100}?)\s+(?:[A-Z]{2,5}|Arch)\s+\d", pdf_text(url), re.M | re.S)])

write_courses("kuet", source=BASE, courses=courses)
