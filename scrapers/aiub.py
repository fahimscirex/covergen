# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""American International University-Bangladesh. Run: uv run scrapers/aiub.py"""
import json
import re

from common import clean, get, write

BASE = "https://www.aiub.edu"
DATA = f"{BASE}/Files/Uploads/public-employee-profiles/employeeProfiles.json"  # feeds /faculty-list
RANK = re.compile(r"(Senior Associate Professor|Associate Professor|Senior Assistant Professor|"
                  r"Assistant Professor|Senior Lecturer|Lecturer|Professor)", re.I)
SHORT = {"FACULTY OF ARTS AND SOCIAL SCIENCES": "FASS", "FACULTY OF BUSINESS ADMINISTRATION": "FBA",
         "FACULTY OF ENGINEERING": "FE", "FACULTY OF HEALTH AND LIFE SCIENCES": "FHLS",
         "FACULTY OF SCIENCE & TECHNOLOGY": "FST"}


def nice(s):
    s = clean(s).replace("&", "and")
    s = re.sub(r"\s*\[.*\]", "", s)  # "NATURAL SCIENCE [PHYSICS]" -> one Natural Science department
    return re.sub(r"\b(Of|And)\b", lambda m: m[1].lower(), s.title())


def person_name(s):
    s = re.split(r",|\s+PH\.?D", clean(s), flags=re.I)[0]
    return re.sub(r"^(PROFESSOR|PROF\.)\s+", "", s, flags=re.I)


rows = json.loads(get(DATA))["EmployeeProfileLightList"]
faculties = {}
teachers = []
for e in sorted(rows, key=lambda e: (e["Faculty"], e["HrDepartment"])):
    f, d = e["Faculty"], nice(e["HrDepartment"])
    m = RANK.search(e["Position"])
    if not m or not d.startswith("Department of"):
        continue  # advisors, deans and directors carry the faculty itself as department
    fac = faculties.setdefault(f, {"name": nice(f),
                                   "short": SHORT[f], "departments": []})
    if d not in fac["departments"]:
        fac["departments"].append(d)
    teachers.append((person_name(e["CvPersonal"]["Name"]), m[1].title(), d))

write("aiub",
      name="American International University-Bangladesh",
      tagline="Where Leaders Are Created",
      address="408/1 Kuratoli, Khilkhet, Dhaka-1229, Bangladesh",
      logo="data/logos/aiub.svg",
      source=f"{BASE}/Faculty-List",
      faculties=list(faculties.values()), teachers=teachers)
