# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""East West University. Run: uv run scrapers/ewu.py"""
import json
import re
import time
import urllib.parse
import urllib.request

from bs4 import BeautifulSoup

from common import UA, clean, soup, write

BASE = "https://www.ewubd.edu"
SHORT = {"Faculty of Sciences and Engineering": "FSE",
         "Faculty of Liberal Arts and Social Sciences": "FLASS",
         "Faculty of Business and Economics": "FBE"}
RANK = re.compile(r"(Associate Professor|Assistant Professor|Senior Lecturer|Lecturer|Professor|Adjunct Faculty)")


def norm(s):
    return clean(s.replace("&", "and"))


def search(dept_id):
    """The faculty search page is an October CMS AJAX handler returning an HTML partial."""
    req = urllib.request.Request(
        f"{BASE}/search-faculty",
        data=urllib.parse.urlencode({"department_id": dept_id, "faculty_designation": "all"}).encode(),
        headers={"User-Agent": UA, "X-OCTOBER-REQUEST-HANDLER": "onFacultySearch",
                 "X-OCTOBER-REQUEST-PARTIALS": "search/facultysearch", "X-Requested-With": "XMLHttpRequest"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return BeautifulSoup(json.load(r)["search/facultysearch"], "html.parser")


page = soup(f"{BASE}/search-faculty")
ids = {norm(o.get_text()): o["value"] for o in page.select("select#department_id option") if o["value"] != "all"}

faculties, teachers = [], []
for a in soup(BASE).select("a.facultyMenuHead"):
    depts = [norm(x.get_text()) for x in a.find_next_sibling("ul").select("a")]
    faculties.append({"name": clean(a.get_text()), "short": SHORT[clean(a.get_text())], "departments": depts})
    for d in depts:
        for box in search(ids[d]).select(".department-chairperson-box-detail"):
            text = re.sub(r"(Honorary|Visiting) Professor", "", box.select("p")[0].get_text(" "))
            m = RANK.search(clean(text))
            if m:
                teachers.append((re.sub(r"^(Mr|Mrs|Ms)\.\s*", "", clean(box.select_one("h4").get_text()).split(",")[0]), m[1], d))
        time.sleep(0.5)

write("ewu",
      name="East West University",
      tagline="Excellence in Education",
      address="A/2 Jahurul Islam Avenue, Jahurul Islam City, Aftabnagar, Dhaka-1212, Bangladesh",
      logo="data/logos/ewu.png",
      source=BASE,
      faculties=faculties, teachers=teachers)
