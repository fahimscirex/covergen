# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Khulna University. Run: uv run scrapers/ku.py"""
import re
import time

from common import clean, soup, write


def who(s):
    """Drop "(Chairman)", "(Study Leave)", nicknames and Bangla renderings after the name."""
    s = re.sub(r"\([^)]*\)?|[\u0980-\u09FF]+", " ", s)
    return clean(s).replace(" .", ".")


BASE = "https://ku.ac.bd"
SHORT = {"Science, Engineering and Technology": "SET", "Management and Business Administration": "MBA",
         "Life Science": "LS", "Social Science": "SS", "Arts and Humanities": "AH",
         "Fine Arts": "FA", "Law": "LAW", "Education": "EDU"}

faculties, links = [], {}
schools = soup(BASE).find("a", string=lambda s: s and clean(s) == "Schools").find_next_sibling("ul")
for li in schools.find_all("li", recursive=False):
    name = clean(li.a.get_text())
    depts = []
    for a in li.select('ul a[href*="/discipline/"]'):
        d = clean(a.get_text())
        depts.append(d)
        links[d] = a["href"].rstrip("/")
    faculties.append({"name": name, "short": SHORT[name.removesuffix(" School")], "departments": depts})

teachers = []
for d, url in links.items():
    time.sleep(0.5)
    for row in soup(url + "/faculty/inservice").select("table tr"):
        spans = row.select("td span[style*='font-size:20px']")
        pos = row.select_one("b[style*='left:-12px']")
        if spans and pos:
            teachers.append((who(spans[0].get_text()), pos.get_text(), d))

write("ku",
      name="Khulna University",
      tagline="",
      address="Khulna-9208, Bangladesh",
      logo="data/logos/ku.png",
      source=f"{BASE}/",
      faculties=faculties, teachers=teachers)
