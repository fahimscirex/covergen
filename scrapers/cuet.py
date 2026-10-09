# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Chittagong University of Engineering & Technology. Run: uv run scrapers/cuet.py

cuet.ac.bd is a Next.js app; the data comes from the JSON API at api.cuet.ac.bd
that its pages call. Institutes are not covered (they have no teachers of their own).
"""
import json
import re
import time

from common import clean, get, write

API = "https://api.cuet.ac.bd/api/v1"
RANKS = ("Professor", "Associate Professor", "Assistant Professor", "Lecturer")


def fetch(path):
    return json.loads(get(API + path))["data"]


def dept_name(title):
    return "Department of " + clean(title).replace(" & ", " and ").replace(" And ", " and ")


faculties, slugs = [], {}
for f in fetch("/administrative-academic-faculties"):
    name = "Faculty of " + clean(f["title"]).replace("Eng.", "Engineering").replace("&", "and")
    faculties.append({"name": name, "short": "F" + "".join(w[0] for w in name.split()[2:] if w[0].isupper()),
                      "departments": []})
    for d in f["departments"]:
        faculties[-1]["departments"].append(dept_name(d["title"]))
        slugs[dept_name(d["title"])] = d["slug"]

teachers = []
for dept, slug in slugs.items():
    for status in ("running", "on_leave"):
        for p in fetch(f"/app-admins?admin_type=faculty_member&administrative_department_slug={slug}&employee_status={status}"):
            rank = next((x["title"] for x in p["admin_positions"] if x["title"] in RANKS), None)
            if rank:
                teachers.append((re.sub(r"\b(Prof|Engr|Mr|Mrs|Ms)\.\s*", "", clean(p["name"])), rank, dept))
        time.sleep(0.5)

write("cuet",
      name="Chittagong University of Engineering & Technology",
      tagline="",
      address="Pahartoli, Raozan, Chattogram-4349, Bangladesh",
      logo="data/logos/cuet.png",
      source="https://cuet.ac.bd/faculty",
      faculties=faculties, teachers=teachers)
