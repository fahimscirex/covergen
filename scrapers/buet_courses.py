# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""BUET's course codes and titles, from each department's own site.

Run: uv run scrapers/buet_courses.py

Every department runs its own site, so each gets a small parser: HTML course
lists for CSE, EEE, IPE, NAME, ChE, MME, NCE and Physics, a Next.js payload for
Architecture, and booklet PDFs for ME, BME, CE, URP and Mathematics. Not
covered: Chemistry, Humanities and WRE (nothing readable), PMRE (no
undergraduate programme) and the institutes.
"""
import html
import json
import re
import io
import time
import urllib.request
from urllib.parse import urljoin

from pypdf import PdfReader

from common import UA, clean, get, soup, write_courses

D = "Department of "
courses = []


def pdf_pages(url):
    """The text of each page of a PDF."""
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url.replace(" ", "%20"), headers={"User-Agent": UA}),
                                        timeout=120) as r:
                data = r.read()
            break
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))
    return [p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages]


def add(dept, rows):
    n = 0
    for code, name in rows:
        code, name = clean(code), clean(name).strip(": -")
        if re.fullmatch(r"[A-Za-z]{2,5} ?\d{3,4}[A-Z]?", code) and name:
            courses.append((code, name, dept))
            n += 1
    print(f"{dept}: {n}")
    time.sleep(0.5)


# CSE: one table of every UG course; the code sits in the first cell.
rows = []
for tr in soup("https://cse.buet.ac.bd/academics/ug_courses").select("tbody tr"):
    tds = tr.find_all("td")
    if len(tds) >= 2:
        rows.append((tds[0].get_text(), tds[1].find(string=True)))
add(D + "Computer Science and Engineering", rows)

# EEE: the course index links read "EEE 101 - Electrical Circuit 1".
rows = []
for a in soup("https://eee.buet.ac.bd/academics/undergraduate/courses").select('a[href*="/undergraduate/courses/"]'):
    code, _, name = clean(a.get_text()).partition(" - ")
    rows.append((code, name))
add(D + "Electrical and Electronic Engineering", rows)

# IPE and NAME: "IPE 105 || Principles of Cost and Management Accounting".
for dept, url in ((D + "Industrial and Production Engineering", "https://ipe.buet.ac.bd/undergraduate-courses"),
                  (D + "Naval Architecture and Marine Engineering", "https://name.buet.ac.bd/undergraduate-courses")):
    text = soup(url).get_text("\n")
    add(dept, [m.groups() for m in re.finditer(r"^\s*([A-Za-z]{2,5} ?\d{3})\s*\|\|\s*(.+?)\s*$", text, re.M)])

# ChE: the curriculum is JSON inside an HTML attribute.
text = html.unescape(get("https://che.buet.ac.bd/academics/undergraduate"))
add(D + "Chemical Engineering",
    re.findall(r'"code":"([^"]+)","type":"[^"]*","title":"([^"]+)"', text))

# MME: term-by-term tables, code and title in consecutive cells.
cells = [clean(x.get_text()) for x in soup("https://mme.buet.ac.bd/academics/undergraduate-programme/course-list/")
         .select("table td")]
add(D + "Materials and Metallurgical Engineering",
    [(c, cells[i + 1]) for i, c in enumerate(cells[:-1]) if re.fullmatch(r"[A-Z]{2,5} \d{3}", c)])

# NCE: the curriculum page prints each code on one line and its title on the next.
lines = [x for x in map(clean, soup("https://nce.buet.ac.bd/undergraduate/curriculum/").get_text("\n").split("\n")) if x]
add(D + "Nanomaterials and Ceramic Engineering",
    [(c, re.sub(r"\s*\((?:Optional|Compulsory)\)\s*$", "", lines[i + 1]))
     for i, c in enumerate(lines[:-1]) if re.fullmatch(r"[A-Z]{2,5} \d{3}", c)])

# Architecture: a Next.js page that embeds its course records in the flight data.
page = get("https://arch.buet.ac.bd/undergraduate/barch")
flight = "".join(json.loads(p) for p in re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', page))
add(D + "Architecture",
    [(c, t) for t, c in re.findall(r'"c_CourseTitle":"([^"]*)","c_CourseID":"([^"]*)"', flight)])

# ME and BME: booklet tables of "ME 101 Introduction to Mechanical Engineering 1-I 3.0 3.00"
# (BME: "... Theory 3 3"); long titles wrap onto the next line.
def booklet(dept, pages, marker):
    text = re.sub(r"Sessiona\s*\nl", "Sessional", "\n".join(pages))
    add(dept, [(c, " ".join(n.split())) for c, n in
               re.findall(r"^([A-Z][A-Za-z]{1,4} ?\d{3})[ \t]+(.+?)\s+" + marker, text, re.M | re.S)])


me = soup("https://me.buet.ac.bd/undergraduate").find("a", string=re.compile("New Syllabus"))
booklet(D + "Mechanical Engineering",
        [p for p in pdf_pages(urljoin("https://me.buet.ac.bd/undergraduate", me["href"]))
         if re.search(r"Courses Offered by ME Department", p)],
        r"(?:\d-(?:I|II)(?: or 4-II)?)\s+[\d/.]")
booklet(D + "Biomedical Engineering",
        pdf_pages("https://bme.buet.ac.bd/wp-content/uploads/2022/08/Undergraduate-Curriculum.pdf"),
        r"(?:Theory|Sessional|Training|Project)\b\s*[\d/.]")

# CE: the OBE curriculum booklet. Section 4.6 lists "CE 101 Analytic Mechanics 3 credits";
# the term tables after it end each row in "3 C" (compulsory) or "3 O" (optional).
text = "\n".join(pdf_pages("https://ce.buet.ac.bd/wp-content/uploads/2026/06/Course-Curriculum-for-Undergraduate-Studies-Ebook.pdf"))
text = text[text.index("4.6 Course Requirements"):]
head, _, tables = text.partition("Level Term Course No.")
add(D + "Civil Engineering",
    [(c, " ".join(n.split())) for c, n in
     re.findall(r"^[* ]*([A-Z]{2,5} \d{3})[ \t]+\*?\s*([A-Z].{2,120}?)\s+\d(?:\.\d+)?\s+credits?", head, re.M | re.S)
     + re.findall(r"^[* ]*([A-Z]{2,5} \d{3})[ \t]+\*?\s*([A-Z].{2,120}?)\s+\d(?:\.\d+)?\s+[CO]\b", tables, re.M | re.S)])

# URP: "Plan 111 Human Settlements Development 3 0 3.0" (theory, sessional, credit). The booklet
# repeats the whole list for the previous curriculum; only the first is current.
text = "\n".join(pdf_pages("https://urp.buet.ac.bd/UploadedPDFs/Pdf638286381691011390.pdf"))
first = text.index("Level: 01, Term: 01")
text = text[first:text.find("Level: 01, Term: 01", first + 1)]
add(D + "Urban and Regional Planning",
    [(c, re.sub(r"\s*\(Optional\)$", "", n)) for c, n in
     re.findall(r"^([A-Za-z]{2,5} \d{3})[ \t]+(.+?)[ \t]+\d+[ \t]+\d+[ \t]+\d(?:\.\d+)?[ \t]*$", text, re.M)])

# Mathematics: the information booklet describes each MATH service course as "MATH 105 (Mathematics I)".
text = "\n".join(pdf_pages("https://math.buet.ac.bd/UploadedPDFs/Pdf638233147610645292.pdf"))
add(D + "Mathematics",
    [(c, " ".join(n.split())) for c, n in re.findall(r"^(MATH \d{3}) \(([^)]+)\)", text, re.M)])

# Physics: "PHY 101:" then the title and the department it serves, "(CE).".
rows = []
for page in ("theory-courses", "sessional-courses"):
    lines = [x for x in map(clean, soup(f"https://phy.buet.ac.bd/page/{page}").get_text("\n").split("\n")) if x]
    rows += [(c.rstrip(":"), re.sub(r"\s*\([A-Za-z]{2,5}\)\s*\.?$", "", lines[i + 1]))
             for i, c in enumerate(lines[:-1]) if re.fullmatch(r"PHY \d{3}:", c)]
add(D + "Physics", rows)

write_courses("buet", source="https://www.buet.ac.bd/web/", courses=courses)
