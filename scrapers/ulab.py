# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""University of Liberal Arts Bangladesh. Run: uv run scrapers/ulab.py"""
import re
import time

from common import clean, soup, write

BASE = "https://ulab.edu.bd"

FACULTIES = [
    {"name": "School of Arts and Humanities", "short": "SAH",
     "departments": ["Department of English and Humanities",
                     "Department of Bangla Language and Literature"]},
    {"name": "School of Business", "short": "USB",
     "departments": ["Department of Business Administration"]},
    {"name": "School of Science and Engineering", "short": "SSE",
     "departments": ["Department of Computer Science and Engineering",
                     "Department of Electrical and Electronic Engineering"]},
    {"name": "School of Social Science", "short": "SSS",
     "departments": ["Department of Media Studies and Journalism"]},
    {"name": "School of Environmental and Life Sciences", "short": "SELS",
     "departments": ["Department of Environmental Science and Sustainability"]},
    {"name": "General Education Department", "short": "GED",
     "departments": ["General Education Department"]},
]

# The directory's free-text "department" field -> department above.
# Research centres (CLS, CSD, CAS) and the unassigned (VC, deans) are skipped.
DEPT = [
    ("English", "Department of English and Humanities"),
    ("Bangla", "Department of Bangla Language and Literature"),
    ("School of Business", "Department of Business Administration"),
    ("Computer Science", "Department of Computer Science and Engineering"),
    ("Electrical", "Department of Electrical and Electronic Engineering"),
    ("School of Social Science", "Department of Media Studies and Journalism"),
    ("Environmental", "Department of Environmental Science and Sustainability"),
    ("General Education", "General Education Department"),
]
RANK = re.compile(r"Associate Professor|Assistant Professor|Senior Lecturer|Professor|Lecturer")

teachers, page = [], 0
while True:
    rows = soup(f"{BASE}/academics/faculty-list?page={page}").select(".views-row")
    if not rows:
        break
    for r in rows:
        field = lambda c: clean(r.select_one(f".views-field-{c}").get_text(" "))
        dept = next((d for key, d in DEPT if key in field("field-dept")), None)
        rank = RANK.search(field("field-designation"))
        if dept and rank:
            teachers.append((field("title").split(",")[0], rank[0], dept))
    page += 1
    time.sleep(0.5)

write("ulab",
      name="University of Liberal Arts Bangladesh",
      tagline="University of the Future",
      address="688 Beribadh Road, Mohammadpur, Dhaka-1207, Bangladesh",
      logo="data/logos/ulab.svg",
      source=f"{BASE}/academics/faculty-list",
      faculties=FACULTIES, teachers=teachers)
