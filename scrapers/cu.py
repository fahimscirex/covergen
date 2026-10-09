# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""University of Chittagong, via the JSON endpoints behind its faculty-profile page.
Run: uv run scrapers/cu.py"""
import json
import re
import time
import urllib.parse
import urllib.request

from common import UA, clean, write


def who(s):
    """Drop "(Chairman)", "(Study Leave)", nicknames and Bangla renderings after the name."""
    s = re.sub(r"\([^)]*\)?|[\u0980-\u09FF]+", " ", s)
    return clean(s).replace(" .", ".")


BASE = "https://cu.ac.bd/peopleresources/php/ui/facultyprofile/"
TEACHING = ("professor", "lecturer")


def post(endpoint, **data):
    req = urllib.request.Request(BASE + endpoint, urllib.parse.urlencode(data).encode(),
                                 {"User-Agent": UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r).get("data")
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


def dept_name(d):
    n = clean(d["sec_title"])
    if d["leveltitle"] == "Department":
        return "Department of " + n
    if d["leveltitle"] == "Institute":  # the API drops the "Institute of" prefix
        return "Institute of " + n.replace(" And ", " and ")
    return n


faculties, ids = [], {}
for f in post("get_all_faculty_departments.php"):
    depts = []
    for d in f["deptlist"]:
        if d["leveltitle"] not in ("Department", "Institute", "Academic Center"):
            continue  # research centers and the English-teachers pools
        name = dept_name(d)
        depts.append(name)
        ids[d["secno"]] = name
    faculties.append({"name": "Faculty of " + clean(f["sec_title"]), "short": f["short_title"],
                      "departments": depts})

teachers = []
for secno, dept in ids.items():
    time.sleep(0.5)
    people = post("get_filtered_facultyprofile.php", deptid=secno) or []
    for p in people:
        if p["statusno"] == 1 and any(t in p["desigtitle"].lower() for t in TEACHING):
            teachers.append((who(f"{p['firstname']} {p['lastname']}"), p["desigtitle"], dept))

write("cu",
      name="University of Chittagong",
      tagline="",
      address="Chattogram-4331, Bangladesh",
      logo="data/logos/cu.png",
      source="https://cu.ac.bd/faculty-dept-inst/",
      faculties=faculties, teachers=teachers)
