# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Daffodil International University. Run: uv run scrapers/diu.py  (~100 requests, takes a minute)"""
import re
import time

from common import clean, soup, write

BASE = "https://faculty.daffodilvarsity.edu.bd"
RANK = re.compile(r"Associate Professor|Assistant Professor|Senior Lecturer|Professor|Lecturer")

faculties, pages = [], []
for box in soup(BASE).select(".faculty-title"):
    depts = []
    for a in box.find_next_sibling("ul").select("a"):
        # "Department of Multimedia & Creative Technology (MCT)" -> drop the acronym.
        name = re.sub(r"\s*\([A-Z]+\)$", "", clean(a.get_text()))
        depts.append(name)
        pages.append((name, a["href"].removesuffix(".html").rsplit("/", 1)[1]))
    name = clean(box.get_text())
    faculties.append({"name": name, "short": "".join(w[0] for w in re.findall(r"[A-Z]\w*", name)),
                      "departments": depts})

teachers = []
for dept, slug in pages:
    offset = 0
    while True:
        page = soup(f"{BASE}/teachers/{slug}.html" if offset == 0 else f"{BASE}/teachers/{slug}/{offset}")
        time.sleep(0.5)
        for a in page.select("h3 a.fox"):
            # The dean/associate dean of the faculty head every department page; the rank
            # filter drops them ("Dean"), as it does adjuncts and staff.
            rank = RANK.search(clean(a.find_parent("div").h4.get_text()))
            if rank:
                teachers.append((a.get_text(), rank[0], dept))
        if not page.find("a", string=re.compile("Next")):
            break
        offset += 20

write("diu",
      name="Daffodil International University",
      tagline="",
      address="Daffodil Smart City, Birulia, Savar, Dhaka-1216, Bangladesh",
      logo="data/logos/diu.png",
      source=f"{BASE}/",
      faculties=faculties, teachers=teachers)
