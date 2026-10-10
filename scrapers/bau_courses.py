# /// script
# dependencies = ["beautifulsoup4", "pdfplumber"]
# ///
"""BAU's undergraduate course codes. The "Curricula & Syllabi" page of bau.edu.bd is
rendered from app.bau.edu.bd/api with the public X-API-KEY the site's own JavaScript
ships to every browser (read from the live /_nuxt bundles at run time, never kept in this
repo); it links one curriculum PDF per faculty. The PDFs mix three layouts: a "Course
number / Course title" block per syllabus, "CODE Title Credit" syllabus headings and
"CODE Title credits hours" layout tables. Each course goes to the department that owns
its code prefix (collateral courses taught by another department included).
Run: uv run scrapers/bau_courses.py"""
import io
import json
import re
import sys
import time
import urllib.request

import pdfplumber
from bs4 import BeautifulSoup

from common import UA, clean, get, write_courses

SITE = "https://ag.bau.edu.bd"
PAGE = "https://app.bau.edu.bd/api/pages/view_1/11057"  # "Curricula & Syllabi"

D = "Department of "
DEPT = {  # code prefix -> department (as named in data/bau.json)
    "AGRON": "Agronomy", "SS": "Soil Science", "ENTOM": "Entomology", "HORT": "Horticulture",
    "PPATH": "Plant Pathology", "CBOT": "Crop Botany", "GPB": "Genetics and Plant Breeding",
    "AGEXT": "Agricultural Extension Education", "ACHEM": "Agricultural Chemistry",
    "ACH": "Agricultural Chemistry", "BMB": "Biochemistry & Molecular Biology",
    "BCHEM": "Biochemistry & Molecular Biology", "BIOCH": "Biochemistry & Molecular Biology",
    "LAN": "Languages", "AGROF": "Agroforestry", "VAH": "Anatomy & Histology",
    "VMH": "Microbiology & Hygiene", "VHM": "Microbiology & Hygiene", "VPHY": "Physiology",
    "VPHA": "Pharmacology", "VPAR": "Parasitology", "VPATH": "Pathology", "VMED": "Medicine", "VM": "Medicine",
    "VSO": "Surgery & Obstetrics", "ABG": "Animal Breeding & Genetics", "AS": "Animal Science",
    "AN": "Animal Nutrition", "DS": "Dairy Science", "PS": "Poultry Science",
    "AE": "Agricultural Economics", "AEC": "Agricultural Economics",
    "AF": "Agricultural Finance and Banking", "STAT": "Agricultural and Applied Statistics",
    "AM": "Agribusiness and Marketing", "RS": "Rural Sociology",
    "FS": "Farm Structure & Environmental Engineering", "FPM": "Farm Power & Machinery",
    "IWM": "Irrigation & Water Management", "FTRI": "Food Engineering and Technology",
    "CSM": "Computer Science & Mathematics", "PHY": "Physics",
    "FBG": "Fisheries Biology and Genetics", "AQ": "Aquaculture", "FM": "Fisheries Management",
    "FT": "Fisheries Technology",
}
# Prefixes the PDFs use that belong to no department of this site (institutes, commerce,
# chemistry/maths service courses...) are dropped, and reported.


def api_key():
    for path in dict.fromkeys(re.findall(r'/_nuxt/[^"\'\s]+\.js', get(SITE + "/"))):
        m = re.search(r'"X-API-KEY"\s*:\s*"([^"]+)"', get(SITE + path))
        if m:
            return m[1]
    raise SystemExit(f"X-API-KEY not found in the /_nuxt bundles of {SITE}")


def fetch(url, key=None):
    headers = {"User-Agent": UA, **({"X-API-KEY": key} if key else {})}
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                return r.read()
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


CODE = r"([A-Za-z]{1,8})[\s\-–—]*(\d{3,4})"
TAIL = re.compile(r"(?:\s+[\d.,+/\-–]+)+(?:\s+Total)?\s*$")           # "3+1 5 2", "2 2", "2 - 2"
STOP = re.compile(r"^\s*(Credit|Number of|Total|Level|Rationale|Department|Course|Contact|Objectives|"
                  r"Prerequisite|Pre-?req|\d+\.\s)", re.I)
OTHER_CODE = re.compile(r"\b[A-Z]{2,}\s?\d{3,4}\b")


def rows(text):
    """Yield (code, title) from one PDF's text; the first reading of a code wins later."""
    lines = text.split("\n")
    for i, l in enumerate(lines):
        # block: "Course number : AGRON 1101" + "Course title : ..." (title may wrap)
        m = re.match(rf"^\s*Course\s*(?:No\.?|number|code)\s*[:.]?\s*{CODE}[\s,;]*$", l, re.I)
        if m:
            for j in range(i + 1, min(i + 3, len(lines))):
                t = re.match(r"^\s*Course\s*title\s*[:.]?\s*(.*)$", lines[j], re.I)
                if t:
                    title, k = t[1], j + 1
                    while k < len(lines) and lines[k].strip() and not STOP.match(lines[k]) and len(title) < 150:
                        title += " " + lines[k].strip()
                        k += 1
                    yield m[1] + m[2], title
                    break
            continue
        m = re.match(rf"^\s*Course\s*No\.?\s*&\s*Title\s*[:.]?\s*{CODE}\s+(.+)$", l, re.I)
        if m:
            yield m[1] + m[2], m[3]
            continue
        # syllabus heading: "PHY 111  Physics  Credit- 3"
        m = re.match(rf"^\s*{CODE}\s+(.+?)\s+Credit\s*-?\s*[\d.]+\s*$", l)
        if m:
            yield m[1] + m[2], m[3]


def table_rows(text):
    """Layout tables: "VAH 111, 112 Anatomy 3+1 5 2", "AGRON 1101: Weed Science (T) 2"."""
    lines = text.split("\n")
    for i, l in enumerate(lines):
        m = re.match(rf"^\s*(?:\d{{1,2}}\s+)?{CODE}((?:\s*[,&]\s*\d{{3,4}})*)\s*:?\s+([A-Z].*)$", l)
        if not m or re.match(r"\s*Total", m[4]):
            continue
        title = TAIL.sub("", m[4]).strip()
        if title == m[4].strip() and i + 1 < len(lines):      # no numbers: the title wraps
            nxt = lines[i + 1]
            if not re.match(rf"^\s*(?:\d{{1,2}}\s+)?{CODE}|^\s*Total|^\s*$", nxt):
                title = TAIL.sub("", f"{title} {nxt.strip()}").strip()
        for n in [m[2]] + re.findall(r"\d{3,4}", m[3]):
            yield m[1] + n, title


def tidy(title):
    title = clean(title.replace("–", "-"))
    title = re.sub(r"\s*[-,]?\s*\(?(?:Compulsory|Elective|Optional)\)\s*$", "", title, flags=re.I)
    title = re.sub(r"\s*[-,]?\s*\(?\b(?:Theory|Practical)\b\)?$", "", title, flags=re.I)
    title = re.sub(r"\s*\((?:T|P|T\+P)\)\*?\s*$", "", title)
    title = re.sub(r"\s+Credit.*$|\s+[\d.]+\s+Total$", "", title, flags=re.I)
    return title.strip(" -:,")


key = api_key()
page = BeautifulSoup(json.loads(fetch(PAGE, key))["subMenuDetails"], "html.parser")
pdfs = list(dict.fromkeys(a["href"] for a in page.select("a[href$='.pdf']")))
assert pdfs, "no curriculum PDFs on the Curricula & Syllabi page"

best, skipped = {}, {}
for url in pdfs:
    time.sleep(0.5)
    with pdfplumber.open(io.BytesIO(fetch(url))) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    # a syllabus block beats a layout-table row for the same code, wherever it appears
    for rank, found in enumerate((rows(text), table_rows(text))):
        for code, title in found:
            m = re.match(r"([A-Za-z]+)[\s\-–—]*(\d+)", code)
            prefix, num = m[1].upper(), m[2]
            title = tidy(title)
            if len(title) < 4 or OTHER_CODE.search(title) or not title[0].isupper():
                continue
            if prefix not in DEPT:
                skipped[prefix] = skipped.get(prefix, 0) + 1
                continue
            key_ = f"{prefix}-{num}"
            if key_ not in best or rank < best[key_][0]:
                best[key_] = (rank, title, D + DEPT[prefix])

print("skipped prefixes with no department of their own:", skipped, file=sys.stderr)
write_courses("bau", source="https://bau.edu.bd/main/curricula-syllabi",
              courses=((c, t, d) for c, (_, t, d) in best.items()))
