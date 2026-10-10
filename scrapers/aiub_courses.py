# /// script
# dependencies = ["beautifulsoup4", "pypdf", "pdfplumber"]
# ///
"""AIUB's course codes, from the curriculum tables on each program page (HTML)
plus the FBA course-description PDFs (BBA/MBA/EMBA) and the CoE curriculum PDF.
Run: uv run scrapers/aiub_courses.py"""
import io
import logging
import re
import time
import urllib.request

import pdfplumber
from bs4 import BeautifulSoup, Comment
from pypdf import PdfReader

from common import UA, clean, get, write_courses

logging.disable(logging.CRITICAL)  # pypdf nags about fonts it can read fine
BASE = "https://www.aiub.edu"
D = "Department of "
CODE = re.compile(r"^[A-Z]{2,5}\s?-?\d{3,4}[A-Z]?$")
EL = re.compile(r"^(?:\w+ ){0,2}Elective(?: Course)?(?: ?[IVX\d]+)?$", re.I)  # "Elective 1", "Tech Elective 2"

# Program page -> department it belongs to
PROGRAMS = {
    "engg/programs/b-arch": "Architecture",
    "engg/programs/bsc-in-eee": "Electrical and Electronic Engineering",
    "engg/programs/meee": "Electrical and Electronic Engineering",
    "engg/programs/met": "Electrical and Electronic Engineering",
    "engg/programs/bsc-in-ipe": "Industrial and Production Engineering",
    "fass/dept-of-english/programs/master-of-arts-in-english-program/ma-in-english-courses-curriculumns": "English",
    "fass/programs/under-graduate/ba-in-english": "English",
    "fass/programs/graduate/llm-curriculum": "Law",
    "fass/programs/under-graduate/ba-in-laws": "Law",
    "fass/programs/under-graduate/ba-in-media-and-mass-communication": "Journalism and Mass Communication",
    "fass/programs/under-graduate/bss-in-economics": "Economics",
    "fass/programs/graduate/masters-in-development-studies-mds/masters-in-development-studies-curriculum": "Social Science",
    "fhls/programs/graduate-program/masters-in-public-health": "Public Health",
    "fhls/programs/under-graduate/b-pharm": "Pharmacy",
    "fhls/programs/under-graduate/bsc-in-biochemistry-and-molecular-biology": "Biochemistry and Molecular Biology",
    "fhls/programs/under-graduate/bsc-in-microbiology-curriculum": "Microbiology",
    "fst/programs/graduate/master-of-science-in-computer-science-msc-in-cs": "Computer Science",
    "fst/programs/under-graduate/bachelor-of-science-in-computer-science--engineering": "Computer Science",
    "fst/programs/under-graduate/bachelor-of-science-in-data-science": "Computer Science",
    "fst/programs/under-graduate/bsc-in-computer-network--cyber-security": "Computer Science",
}
FBA = ["Accounting", "Finance", "Management", "Management Information System", "Marketing",
       "Operations and Supply Chain Management", "Tourism and Hospitality Management"]
# FBA description PDFs -> departments (the core PDFs belong to every FBA department).
# AIUB has no department for Business Analytics, HR, IB, IED or Investment
# Management, so those specializations go to the nearest one.
FBA_PDFS = {
    "01-course-descriptions---bba-core-courses": FBA,
    "02-course-descriptions---bba---accounting": ["Accounting"],
    "03-course-descriptions---bba---business-analytics": ["Management Information System"],
    "04-course-descriptions---bba---business-economics": ["Economics"],
    "05-course-descriptions---bba---finance": ["Finance"],
    "06-course-descriptions---bba---human-resource-management": ["Management"],
    "07-course-descriptions---bba---innovation-and-entrepreneurship-development": ["Management"],
    "08-course-descriptions---bba---international-business": ["Management"],
    "09-course-descriptions---bba---investment-management": ["Finance"],
    "10-course-descriptions---bba---management": ["Management"],
    "11-course-descriptions---bba---management-information-systems": ["Management Information System"],
    "12-course-descriptions---bba---marketing": ["Marketing"],
    "13-course-descriptions---bba---operations-and-supply-chain-management": ["Operations and Supply Chain Management"],
    "14-course-descriptions---bba---tourism-and-hospitality-management": ["Tourism and Hospitality Management"],
    "01-course-descriptions---mba-core-courses": FBA,
    "02-course-descriptions---mba---accounting": ["Accounting"],
    "03-course-descriptions---mba---agri-business": ["Management"],
    "04-course-descriptions---mba---business-analytics": ["Management Information System"],
    "05-course-descriptions---mba---business-economics": ["Economics"],
    "06-course-descriptions---mba---entrepreneurship-development": ["Management"],
    "07-course-descriptions---mba---finance": ["Finance"],
    "08-course-descriptions---mba---general-management": ["Management"],
    "09-course-descriptions---mba---human-resource-management": ["Management"],
    "10-course-descriptions---mba---management-information-systems": ["Management Information System"],
    "11-course-descriptions---mba---marketing": ["Marketing"],
    "12-course-descriptions---mba---operations-and-supply-chain-management": ["Operations and Supply Chain Management"],
    "13-course-descriptions---mba---tourism-and-hospitality-management": ["Tourism and Hospitality Management"],
    "course-descriptions---emba-program": ["Management"],
}
SMALL = {"and", "of", "for", "in", "to", "the", "a", "an", "on", "with", "at", "or", "by", "from", "as"}
KEEP = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IT", "ICT", "CAD", "VLSI", "FPGA", "FPGAS", "VHDL", "AC", "DC",
        "CPU", "MS", "SQL", "HTML", "CSS", "IOT", "AI", "ML", "UI", "UX", "LAN", "WAN", "PLC", "RF", "DSP", "EMC", "CMOS",
        "TCP", "IP", "OOP", "GIS", "SPSS", "STATA", "MATLAB", "CSR", "NGO", "NGOS", "BNQF", "HIV", "AIDS", "DNA", "RNA",
        "PCR", "MPH", "MBA", "BBA", "LLM", "ERP", "HRIS", "MICE", "SAP", "BIM", "3D", "2D", "VR", "AR", "LTE", "GSM", "SDN",
        "VOIP", "MIS", "SCM", "HR", "HRM", "ACCA", "US", "UK", "UN", "ICT", "ETL", "API", "APIS", "PHP"}


def nice(s):
    """Tag-free title; ALL CAPS titles are title-cased (acronyms kept)."""
    s = re.sub(r"\s*\[[^\]]*\]", "", clean(s)).strip(" :;,-")
    if not s.isupper():
        return s
    words = []
    for i, w in enumerate(s.split(" ")):
        core = re.sub(r"[^A-Z0-9]", "", w)
        if core in KEEP or re.fullmatch(r"[A-Z]{0,3}\d+[A-Z]{0,2}", core) and not core.isdigit():
            words.append(w)
        elif w.lower() in SMALL and i:
            words.append(w.lower())
        else:
            words.append(re.sub(r"([A-Za-z])([A-Za-z']*)", lambda m: m[1].upper() + m[2].lower(), w))
    return " ".join(words)


def fetch(url):
    for i in range(4):
        try:
            time.sleep(0.5)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))  # the site resets connections now and then


def pdf_text(url):
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(fetch(url))).pages)


courses = []

# 1. FBA course descriptions (first, so BBA core titles win over older CSE-page ones): "BBA 1101: Foundation Course"
for name, depts in FBA_PDFS.items():
    text = pdf_text(f"{BASE}/Files/Uploads/{name}.pdf")
    for code, title in re.findall(r"^\s*((?:[A-Z]{1,5}) ?-? ?\d{4}) ?: ?(.+?)\s*$", text, re.M):
        for d in depts:
            courses.append((code, nice(title), D + d))

# 2. HTML curriculum tables (the live ones; commented-out copies are old)
for path, dept in PROGRAMS.items():
    page = BeautifulSoup(fetch(f"{BASE}/faculties/{path}"), "html.parser")
    for c in page.find_all(string=lambda x: isinstance(x, Comment)):
        c.extract()
    for tr in page.select("table tr"):
        cells = [clean(td.get_text(" ")) for td in tr.select("td")]
        if len(cells) >= 2 and CODE.match(cells[0]) and re.search(r"[A-Za-z]{3}", cells[1]) and not EL.match(nice(cells[1])):
            courses.append((cells[0], nice(cells[1]), D + dept))

# 3. Computer Engineering has no tables, only a curriculum PDF with two semesters per row.
COE_PREFIX = {"MAT", "CHEM", "PHY", "COE", "EEE", "CSC", "ENG", "BBA", "MGT", "BAE", "BAS"}
with pdfplumber.open(io.BytesIO(fetch(f"{BASE}/Files/Uploads/coe-course-outline_july-2023_approved-1.pdf"))) as pdf:
    page = pdf.pages[0]  # the semester grid; page 2 is the elective list
    words = page.extract_words()
    for cx, tx0, tx1 in ((25, 68, 224), (320, 360, 524)):  # left and right semester columns
        found = []
        for w in sorted(words, key=lambda w: w["top"]):
            if not cx <= w["x0"] < cx + 8:
                continue
            nxt = [v for v in words if abs(v["top"] - w["top"]) < 2 and 0 < v["x0"] - w["x1"] < 8]
            if re.fullmatch(r"[A-Z]{3,4}\d{4}", w["text"]):
                found.append((w["top"], w["text"]))
            elif re.fullmatch(r"[A-Z]{3,4}", w["text"]) and nxt and re.fullmatch(r"\d{4}", nxt[0]["text"]):
                found.append((w["top"], f"{w['text']} {nxt[0]['text']}"))
        stops = [w["top"] for w in words if w["text"] in ("Total", "Code") and w["x0"] < tx1 + 80]
        for i, (top, code) in enumerate(found):
            end = min([s for s in stops if s > top + 2] + [found[i + 1][0] - 3 if i + 1 < len(found) else 9999])
            toks = [w["text"] for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"]))
                    if tx0 <= w["x0"] <= tx1 and top - 3 <= w["top"] < end]
            while toks and toks[0] in COE_PREFIX:  # prerequisite text spilling into the title column
                toks.pop(0)
            while toks and toks[-1] in COE_PREFIX:
                toks.pop()
            title = re.sub(r"(?<=[a-z])[A-Z]{3,4}$", "", " ".join(toks))
            if title and not EL.match(title):
                courses.append((code, nice(title), D + "Computer Engineering"))

write_courses("aiub", source=f"{BASE}/faculties", courses=courses)
