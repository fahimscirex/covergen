# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Jahangirnagar University. Run: uv run scrapers/ju.py"""
import json
import re
import time

from common import clean, get, soup, write

BASE = "https://juniv.edu"


def name(s):
    return clean(s).replace("&", "and")


def person(s):
    """The directory's name field carries degrees, nicknames and Bangla after the name."""
    s = re.sub(r"\(.*", "", s.split(",")[0])
    s = re.split(r"\s+(?:B\.?\s?Sc|M\.?\s?Sc|PhD|Ph\.D|MS|MA|BA|BBA|MBA|MSS|BSS)\b|\.\s+M\.?Sc", s)[0]
    return clean(re.sub(r"^(?:Prof\.|Professor)\s+", "", clean(s)))


def short(s):
    return "".join(w[0] for w in s.replace("Faculty of ", "").replace("&", "").split() if w[0].isupper())


home = soup(BASE)
faculties = []
for card in home.select("#departments .card"):
    n = name(card.select_one("h4").get_text())
    faculties.append({"name": n, "short": short(n),
                      "departments": [name(li.get_text()) for li in card.select("li")]})

# Institutes teach students too; the teacher directory lists them as departments.
by_id = {o["value"]: name(o.get_text())
         for o in soup(f"{BASE}/teachers").select("select option") if o["value"].isdigit() and clean(o.get_text()).startswith(("Department of", "Institute of"))}
placed = {d for f in faculties for d in f["departments"]}
inst = [d for d in by_id.values() if d.startswith("Institute of ") and d not in placed]
faculties.append({"name": "Institutes", "short": "INST", "departments": inst})

teachers, page = [], 1
while True:
    q = "status[]=1&status[]=2&status[]=4&relation[]=designationInfo&department_id=&page=%d" % page
    data = json.loads(get(f"{BASE}/teachers/search?{q}"))
    for t in data["data"]:
        if t["department_id"] and str(t["department_id"]) in by_id:
            teachers.append((person(t["name"]), (t["designation_info"] or {}).get("name", ""), by_id[str(t["department_id"])]))
    if page >= data["last_page"]:
        break
    page += 1
    time.sleep(0.5)

write("ju",
      name="Jahangirnagar University",
      tagline="",
      address="Savar, Dhaka-1342, Bangladesh",
      logo="data/logos/ju.png",
      source=f"{BASE}/teachers",
      faculties=faculties, teachers=teachers)
