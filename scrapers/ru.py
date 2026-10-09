# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""University of Rajshahi. Departments come from the main site's department page;
teachers from the employee portal (profile.ru.ac.bd), a React app whose API wants an
`api-key` header. The key is the public one the portal's own JavaScript ships to every
browser; it is not kept in this repo, the scraper reads it from the live bundle.
Run: uv run scrapers/ru.py"""
import difflib
import json
import re
import sys
import time
import urllib.request

from common import UA, clean, get, soup, write

SITE = "https://www.ru.ac.bd"
PORTAL = "https://profile.ru.ac.bd"
TEACHING = ("Professor", "Associate Professor", "Assistant Professor", "Lecturer")
SHORT = {"Faculty of Arts": "FA", "Faculty of Law": "FL", "Faculty of Science": "FS",
         "Faculty of Business Studies": "FBS", "Faculty of Social Science": "FSS",
         "Faculty of Agriculture": "FAg", "Faculty of Engineering": "FE",
         "Faculty of Fine Arts": "FFA", "Faculty of Biological Science": "FBioS",
         "Faculty of Geoscience": "FGS", "Faculty of Fisheries": "FF",
         "Faculty of Veterinary and Animal Science": "FVAS"}


def api_key():
    html = get(PORTAL + "/public")
    for src in re.findall(r'src="(/assets/[^"]+\.js)"|href="(/assets/[^"]+\.js)"', html):
        for path in dict.fromkeys(p for p in src if p):
            m = re.search(r"apiKey\s*:\s*[`'\"]([^`'\"]+)[`'\"]", get(PORTAL + path))
            if m:
                return m[1]
    sys.exit("could not find apiKey in the JS bundles of " + PORTAL)


KEY = api_key()


def api(path):
    req = urllib.request.Request(f"{PORTAL}/api/{path}",
                                 headers={"User-Agent": UA, "Accept": "application/json", "api-key": KEY})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


def rank(s):
    # "Professor (Grade-1)", "PROFESSOR" ... -> one of TEACHING, else None (officers, staff)
    s = clean(re.sub(r"\(.*?\)", "", s)).title()
    return s if s in TEACHING else None


def norm(s):
    s = re.sub(r"^department of\s+", "", clean(s).lower())
    s = s.replace("&", " and ").replace("bengali", "bangla").replace("print making", "printmaking")
    s = re.sub(r"^statistics$", "statistics and data science", s)
    s = re.sub(r"\bsciences?\b", "science", s)
    return re.sub(r"[^a-z]+", " ", s).strip()


# Department page: every faculty heading in the menu is followed by its "Department of ..." links.
faculties = []
for a in soup(f"{SITE}/academic/department/").find_all("a", href=True):
    t = clean(a.get_text())
    if t.startswith("Faculty of "):
        cur = next((f for f in faculties if f["name"] == t), None)
        if not cur:
            cur = {"name": t, "short": "", "departments": []}
            faculties.append(cur)
    elif t.startswith("Department of ") and faculties and t not in cur["departments"]:
        cur["departments"].append(t)
for f in faculties:
    f["short"] = SHORT.get(f["name"]) or "".join(w[0] for w in f["name"].split()[2:]).upper()
assert len(faculties) == 12, f"expected 12 faculties, got {len(faculties)}"

depts = [d for f in faculties for d in f["departments"]]
offices = [o for o in api("offices")["offices"] if o["office_type"] == "department"]
by_norm = {norm(d): d for d in depts}
mapping, unmatched = {}, []
for o in offices:
    n = norm(o["office_name"])
    d = by_norm.get(n)
    if not d:
        close = difflib.get_close_matches(n, by_norm, n=1, cutoff=0.8)
        d = by_norm[close[0]] if close else None
    if d:
        mapping[o["id"]] = d
    else:
        unmatched.append(o["office_name"])
print("offices without a department:", unmatched or "none", file=sys.stderr)
print("departments without an office:",
      [d for d in depts if d not in mapping.values()] or "none", file=sys.stderr)

teachers = []
for oid, d in mapping.items():
    time.sleep(0.5)
    for p in api(f"teachers/{oid}")["teachers"]:
        r = rank(p["designation"])
        if r:
            teachers.append((p["name"], r, d))

write("ru",
      name="University of Rajshahi",
      tagline="Heaven's Light Is Our Guide",
      address="Rajshahi-6205, Bangladesh",
      logo="data/logos/ru.png",
      source=f"{PORTAL}/public",
      faculties=faculties, teachers=teachers)
