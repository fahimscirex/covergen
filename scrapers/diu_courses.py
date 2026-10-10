# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Daffodil International University's course codes, from each department's program
pages on the main site's backend (term-wise course tables).
Run: uv run scrapers/diu_courses.py  (~100 requests, takes a couple of minutes)"""
import re
import sys
import time

from common import clean, soup, write_courses

FACULTY_SITE = "https://faculty.daffodilvarsity.edu.bd"
BACKEND = "https://webbackend.daffodilvarsity.edu.bd"
# "CSE-115", or the numeric "0413-111" codes the newer curricula use ("0512- 1307" has a stray space).
CODE = re.compile(r"^(?:[A-Z]{2,5}[- ]?\d{3,4}[A-Z]?|\d{4}- ?\d{3,4})$")

# Same department names and url slugs as scrapers/diu.py's faculty directory.
depts = {}
for box in soup(FACULTY_SITE).select(".faculty-title"):
    for a in box.find_next_sibling("ul").select("a"):
        name = re.sub(r"\s*\([A-Z]+\)$", "", clean(a.get_text()))
        depts[a["href"].removesuffix(".html").rsplit("/", 1)[1]] = name

courses = []
for slug, dept in depts.items():
    time.sleep(0.5)
    try:
        page = soup(f"{BACKEND}/department/{slug}")
    except OSError as e:  # the English department's page has been answering 500
        print(f"skipped {dept}: {e}", file=sys.stderr)
        continue
    programs = dict.fromkeys(a["href"] for a in page.select(f'a[href*="/department/{slug}/program/"]'))
    for url in programs:
        time.sleep(0.5)
        for tr in soup(url).select("table tr"):
            td = [clean(x.get_text(" ")) for x in tr.find_all(["td", "th"])]
            for i, cell in enumerate(td[:-1]):
                if CODE.match(cell) and not td[i + 1].startswith("Projected Area"):  # a placeholder row
                    courses.append((cell, td[i + 1], dept))
                    break
    print(slug, len(programs), len(courses), flush=True)

write_courses("diu", source=f"{BACKEND}/departments", courses=courses)
