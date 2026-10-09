# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Independent University, Bangladesh. Run: uv run scrapers/iub.py

The site (iub.edu.bd redirects to iub.ac.bd) is a Next.js app; the faculty
directory is rendered from a JSON API that we call directly.
"""
import json
import re

from common import clean, get, write

BASE = "https://iub.ac.bd"
data = json.loads(get(f"{BASE}/api/faculties-academic-staffs?school=&department=&page=1&size=1000"))

faculties, owner = [], {}
for s in data["schools"]:
    depts = []
    for d in data["schoolAndDepartmentMap"][s["slug"]]:
        name = "Department of " + clean(d["department"])
        if "Program Office" not in name:  # administrative offices, no teachers
            depts.append(name)
            owner[clean(d["department"])] = name
    faculties.append({"name": s["school"], "short": s["schoolShortName"].upper(), "departments": depts})

teachers = []
for f in data["faculties"]:
    name = clean(re.sub(r"\(.*?\)", "", f["name"].split(",")[0]))  # drop ", PhD" and "(Danny)"
    rank = re.sub(r" and Head.*| [AB]$", "", f["position"])  # "Lecturer A", "Professor and Head"
    teachers.append((name, rank, owner[clean(f["department"])]))

write("iub",
      name="Independent University, Bangladesh",
      tagline="Teacheth Man That Which He Knew Not",
      address="Plot 16, Block B, Aftabuddin Ahmed Road, Bashundhara, Dhaka-1229, Bangladesh",
      logo="data/logos/iub.png",
      source=BASE,
      faculties=faculties, teachers=teachers)
