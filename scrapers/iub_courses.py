# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Independent University, Bangladesh. The Next.js site's course catalogue
comes from a JSON API: /api/course-cards lists every course (code + title),
and /api/course-details/<slug> names the department that owns each one.
Run: uv run scrapers/iub_courses.py   (about 2,000 requests, so ~20 minutes)"""
import json
import re
import sys
import time
import urllib.parse

from common import ROOT, clean, get, write_courses

BASE = "https://iub.ac.bd"
known = {d for f in json.loads((ROOT / "data" / "iub.json").read_text(encoding="utf-8"))["faculties"]
         for d in f["departments"]}

cards = json.loads(get(f"{BASE}/api/course-cards"))
unique = {}  # the same course is often listed several times (once per program)
for c in cards:
    code = clean(c["courseCode"])
    if re.fullmatch(r"[A-Z]{2,4}\s?\d{3}[A-Z]?", code):  # drops placeholders like "Elective II"
        unique.setdefault(re.sub(r"\s", "", code), c)

courses, skipped = [], 0
for code, c in unique.items():
    time.sleep(0.5)
    try:
        dept = "Department of " + clean(json.loads(get(f"{BASE}/api/course-details/{urllib.parse.quote(c['courseSlug'])}"))["departmentName"])
    except Exception as e:
        print(f"skip {code}: {e}", file=sys.stderr)
        dept = None
    if dept in known:
        courses.append((code, c["courseName"], dept))
    else:
        skipped += 1
print(f"{len(unique)} distinct courses, {skipped} without a known department")

write_courses("iub", source=f"{BASE}/academics/undergraduate-programs", courses=courses)
