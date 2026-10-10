# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""UIU's course codes, from the department sites' curriculum pages (HTML course
cards and tables, plus the Civil and EEE curriculum PDFs).
Run: uv run scrapers/uiu_courses.py"""
import io
import re
import time
import urllib.request

from pypdf import PdfReader

from common import UA, clean, soup, write_courses

D = "Department of {}".format
CSE, CE, EEE = D("Computer Science and Engineering"), D("Civil Engineering"), D("Electrical and Electronic Engineering")
BBA, ECO, ENG = D("Business Administration"), D("Economics"), D("English")
EDS, MSJ = D("Environment and Development Studies"), D("Media Studies and Journalism")
PHARM, BGE, INS = D("Pharmacy"), D("Biotechnology and Genetic Engineering"), "Institute of Natural Sciences"

CODE = r"[A-Z]{2,5} ?\d{4}[A-Z]?"
# Course cards: "<title>", "Course Code:", "<code>", "Credit Hour:" ...
CARDS = [
    (CSE, "https://cse.uiu.ac.bd/ug-program/course-description/"),
    (CSE, "https://cse.uiu.ac.bd/graduate-program/course-description/"),
    (BGE, "https://bge.uiu.ac.bd/ug-program/course-plan/"),
    (PHARM, "https://pharmacy.uiu.ac.bd/ug-program/course-curriculum/"),
    (EDS, "https://eds.uiu.ac.bd/ug-program/course-curriculum/"),
    (ENG, "https://english.uiu.ac.bd/ug-program/course-curriculum/"),
    (MSJ, "https://msj.uiu.ac.bd/ug-program/course-curriculum/"),
] + [(INS, f"https://ins.uiu.ac.bd/courses/{s}/") for s in ("physics", "chemistry", "mathematics", "biology-for-engineers")]
# Course tables ("Course Code | Course Title | Credit Hr."): SoBE's programs, one page per batch.
TABLES = [
    (BBA, "https://sobe.uiu.ac.bd/bba/course-summary/", "course-summary"),
    (BBA, "https://sobe.uiu.ac.bd/bba-in-ais/list-of-courses/", "list-of-courses"),
    (BBA, "https://sobe.uiu.ac.bd/mba/course-summary/", "course-summary"),
    (BBA, "https://sobe.uiu.ac.bd/emba/course-summary/", "course-summary"),
    (ECO, "https://sobe.uiu.ac.bd/economics/course-summary/", "course-summary"),
]
PDFS = [
    (CE, "https://ce.uiu.ac.bd/wp-content/uploads/sites/7/2026/05/Curriculum-BSCE-2025.pdf"),
    (EEE, "https://eee.uiu.ac.bd/wp-content/uploads/sites/6/2025/03/Curriculum_BSc_EEE_231_Onwards.pdf"),
]
NUM = re.compile(r"^\d+(?:[.\-/]\d+)*$")
ROW = re.compile(rf"^({CODE})\s*:?\s+(.*)$")

courses = []


def tidy(title):
    """Drop the notes the pages append: "(Prerequisite CE 2111)", "[Compulsory ...]", "Credits 1.0",
    a "CSE 4811/DS 4213:" cross-listing prefix, and a title printed twice."""
    title = re.sub(rf"^{CODE}(?:\s*/\s*{CODE})*\s*:\s*", "", clean(title))
    title = re.sub(r"\s*[(\[]\s*(?:Prerequisite|This will not|Mandatory|Compulsory)[^)\]]*[)\]]", "", title)
    title = re.sub(r"\s+Credits?\b.*$", "", title).strip(" ,")
    half = len(title) // 2
    return title[:half].strip() if len(title) % 2 and title[:half] == title[half + 1:] else title


def cards(dept, url):
    lines = soup(url).get_text("\n", strip=True).split("\n")
    for i, line in enumerate(lines):
        if line.startswith("Course Code") and i:
            code = lines[i + 1].split("/")[0].strip() if line.rstrip().endswith(":") else line.partition(":")[2]
            title = re.sub(rf"^{CODE}\s*[-:–]?\s+", "", clean(lines[i - 1]))
            title = re.sub(rf"\s*\({CODE}\)$", "", title)  # "Physics I (PHY 1101)"
            if re.fullmatch(CODE, clean(code)):
                courses.append((code, tidy(title), dept))


def tables(dept, url, key):
    pages = [url] + [a["href"].strip() for a in soup(url).select(f'a[href*="/{key}/"]')
                     if a["href"].strip().rstrip("/") != url.rstrip("/")]
    for page in dict.fromkeys(pages):
        time.sleep(0.5)
        for tr in soup(page).select("table tr"):
            td = [clean(x.get_text(" ")) for x in tr.find_all("td")]
            if len(td) >= 2 and re.fullmatch(CODE, td[0]):
                courses.append((td[0], tidy(td[1]), dept))


def pdf(dept, url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        reader = PdfReader(io.BytesIO(r.read()))
    lines = [clean(l) for p in reader.pages for l in (p.extract_text() or "").split("\n")]
    for i, line in enumerate(lines):
        m = ROW.match(line)
        if not m:
            continue
        rest = m[2]
        for nxt in lines[i + 1:i + 3]:  # titles wrap onto the next line
            if any(NUM.match(w) for w in rest.split()) or not nxt or ROW.match(nxt):
                break
            rest += " " + nxt
        words = []
        for w in rest.split():
            if NUM.match(w) or ROW.match(w):
                break
            words.append(w)
        title = " ".join(words)
        if title[:1].isupper() and len(title) > 2:
            courses.append((m[1], tidy(title), dept))


for dept, url in CARDS:
    cards(dept, url)
    time.sleep(0.5)
for dept, url, key in TABLES:
    tables(dept, url, key)
for dept, url in PDFS:
    pdf(dept, url)
    time.sleep(0.5)

write_courses("uiu", source="https://www.uiu.ac.bd/academics/schools-institutes/", courses=courses)
