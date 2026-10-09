# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Jagannath University. Run: uv run scrapers/jnu.py"""
import re
import time

from common import clean, soup, write

BASE = "https://jnu.ac.bd"
RANKS = {"Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Senior Lecturer"}


def short(name):
    return "F" + "".join(w[0] for w in re.sub(r"^Faculty of ", "", name).split() if w[0].isupper() and w != "AND")


faculties, portals = [], []
for a in soup(BASE).select('a.font-weight-600[href*="/faculty/portal/"]'):
    # the home page spells them properly ("Faculty of Life and Earth Sciences")
    name = clean(a.get_text())
    page = soup(a["href"])
    deps = [(clean(d.get_text()).replace("&", "and"), d["href"]) for d in page.select('a[href*="/department/portal/"]')]
    faculties.append({"name": name, "short": short(name), "departments": [n for n, _ in deps]})
    portals += deps
    time.sleep(0.5)

def person(s):
    s = clean(re.sub(r"\(.*?\)", "", s))
    s = re.sub(r"^(?:Prof\.|Professor)\s+", "", s)
    return re.sub(r"^Dr\.(?=\S)", "Dr. ", s)


teachers = []
for dept, url in portals:
    time.sleep(0.5)
    for box in soup(url).select(".content"):
        n, d = box.select_one("a.name"), box.select_one("h4.name")
        if n and d and clean(d.get_text()) in RANKS:
            teachers.append((person(n.get_text()), d.get_text(), dept))

write("jnu",
      name="Jagannath University",
      tagline="",
      address="9-10 Chittaranjan Avenue, Dhaka-1100, Bangladesh",
      logo="data/logos/jnu.png",
      source=BASE,
      faculties=faculties, teachers=teachers)
