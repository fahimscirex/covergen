# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Rajshahi University of Engineering & Technology. Run: uv run scrapers/ruet.py"""
import re

from common import clean, soup, write

BASE = "https://ruet.ac.bd"


def full(name):
    return "Department of " + clean(name).replace(" & ", " and ")


shorts = {clean(m.select_one(".position").get_text()).replace(" & ", " and "): m.a["href"].rsplit("/", 1)[1]
          for m in soup(f"{BASE}/faculty").select(".team-member .header")}
faculties, acronym = [], {}
for a in soup(BASE).select("li.dropdown > a.dropdown-toggle"):  # menu: "Faculty of X" > "Name (ACRONYM)" links
    text = clean(a.get_text()).replace(" & ", " and ")
    if not text.startswith("Faculty of ") or any(f["name"] == text for f in faculties):
        continue
    faculties.append({"name": text, "short": shorts[text.removeprefix("Faculty of ")], "departments": []})
    for li in a.find_next_sibling("ul").select("a"):
        m = re.match(r"(.+) \((\w+)\)$", clean(li.get_text()))
        faculties[-1]["departments"].append(full(m[1]))
        acronym[m[2]] = full(m[1])

teachers = []
for card in soup(f"{BASE}/teacher").select(".our-team"):
    dept = card.select_one(".dept")
    if dept and (key := clean(dept.get_text()).removeprefix("Dept. of ")) in acronym:
        teachers.append((re.sub(r"\b(Prof|Engr|Mr|Mrs|Ms)\.\s*", "", clean(card.select_one(".title").get_text())), card.select_one(".post").get_text(), acronym[key]))

write("ruet",
      name="Rajshahi University of Engineering & Technology",
      tagline="Heaven's Light is Our Guide",
      address="Kazla, Rajshahi-6204, Bangladesh",
      logo="data/logos/ruet.png",
      source=f"{BASE}/teacher",
      faculties=faculties, teachers=teachers)
