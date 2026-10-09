# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Bangladesh University of Engineering and Technology. Run: uv run scrapers/buet.py

The site is an AngularJS app; faculty groupings come from its department
template and the teachers from the JSON API behind the Faculty Index page.
"""
import json
import re
import time
import urllib.request
import zlib

from common import UA, clean, get, write

WEB = "https://www.buet.ac.bd/web"
API = "https://www.buet.ac.bd/service/api/FacultyProfileFront"


def api(path, body=None):
    req = urllib.request.Request(API + path, json.dumps(body).encode() if body else None,
                                 {"User-Agent": UA, "Content-Type": "application/json"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw, enc = r.read(), r.headers.get("Content-Encoding", "")
            break
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))
    if enc:  # the server compresses even when not asked to
        raw = zlib.decompress(raw, 47 if enc == "gzip" else -15)
    return json.loads(raw)


def full(name):
    """'Computer Science & Engineering (CSE)' -> 'Department of Computer Science and Engineering'."""
    name = clean(re.sub(r"\([^)]*\)", "", name)).replace(" & ", " and ")
    return name if name.startswith(("Department", "Institute")) or "Institute" in name else f"Department of {name}"


# Faculty -> departments, as printed on the departments page.
page = re.sub(r"<!--.*?-->", "", get(f"{WEB}/angular_app/modules/department/department.tpl.html"), flags=re.S)
faculties = []
for m in re.finditer(r"(Faculty of [^<]+)|(Department of [^<\n]+)", page):
    if m[1]:
        faculties.append({"name": clean(m[1]), "short": "".join(w[0] for w in clean(m[1]).split() if w[0].isupper()),
                          "departments": []})
    else:
        faculties[-1]["departments"].append(full(m[2]))
# IPE belongs to the Faculty of Mechanical Engineering but the page omits it.
mech = next(f for f in faculties if f["name"] == "Faculty of Mechanical Engineering")
mech["departments"].append("Department of Industrial and Production Engineering")

units = api("/LoadDeptInst")["Data"]
known = {d for f in faculties for d in f["departments"]}
institutes = [full(u["Name"]) for u in units if u["IsInstitute"]]
faculties.append({"name": "Institutes", "short": "INST", "departments": institutes})
known |= set(institutes)


def designation(s):
    m = re.search(r"Associate Professor|Assistant Professor|Professor|Lecturer", clean(s), re.I)
    prefix = "Research " if re.match(r"Research", clean(s)) else ""
    return prefix + m[0].title() if m else clean(s)


def teacher_name(s):
    s = clean(s)
    m = re.search(r"\(([^()]*[A-Za-z]{3}[^()]*)\)", s)  # '<bengali> (English name)'
    if m and not re.search(r"[A-Za-z]", s.split("(")[0]):
        s = m[1]
    return clean(re.sub(r"^(Mr|Ms|Mrs)\.?\s*|\s*\((AP|[A-Z]{1,4})\)$", "", s))


teachers = []
for u in units:
    dept = full(u["Name"])
    if dept not in known:
        continue
    res = api("/LoadAllPaginated", {
        "DepartmentId": u["DepartmentInstituteId"], "ResearchAreas": "", "AlphabeticalKeyword": "",
        "Keyword": "", "SortByEntryDate": True, "IsAscending": True,
        "PageObj": {"PageNo": 0, "PageSize": 2000}})
    teachers += [(teacher_name(p["Name"]), designation(p["Designation"]), dept) for p in res["Data"]]
    time.sleep(0.5)

write("buet",
      name="Bangladesh University of Engineering and Technology",
      tagline="",
      address="Dhaka-1000, Bangladesh",
      logo="data/logos/buet.png",
      source="https://www.buet.ac.bd/web/#/facultyIndex",
      faculties=faculties, teachers=teachers)
