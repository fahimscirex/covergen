# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""University of Dhaka. Run: uv run scrapers/du.py"""
import re
import time
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

from bs4 import BeautifulSoup

from common import UA, clean, soup, write

BASE = "https://www.du.ac.bd"

# The department list is POSTed per faculty and needs a CSRF token + cookie.
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
opener.addheaders = [("User-Agent", UA)]
home = BeautifulSoup(opener.open(f"{BASE}/departments", timeout=60).read(), "html.parser")
token = home.find("meta", {"name": "csrf-token"})["content"]


def departments(code):
    req = urllib.request.Request(f"{BASE}/showAllDeptByFaculty", method="POST",
                                 data=urllib.parse.urlencode({"parent_id": code}).encode(),
                                 headers={"X-CSRF-TOKEN": token})
    page = BeautifulSoup(opener.open(req, timeout=60).read(), "html.parser")
    return [(re.search(r"/body/(\w+)", a["href"])[1], clean(a.get_text()).replace("&", "and"))
            for a in page.select("h4 a[href*='/body/']")]


SHORT = {"Faculty of Arts": "FA", "Faculty of Science": "FS", "Faculty of Law": "FL",
         "Faculty of Business Studies": "FBS", "Faculty of Social Sciences": "FSS",
         "Faculty of Biological Sciences": "FBioS", "Faculty of Pharmacy": "FP",
         "Faculty of Earth and Environmental Sciences": "FEES",
         "Faculty of Engineering and Technology": "FET", "Faculty of Fine Art": "FFA",
         "Institutes": "INST"}
RANKS = {"Professor", "Associate Professor", "Assistant Professor", "Lecturer"}


def rank(s):
    # "Professor & Chairman" -> "Professor"; Emeritus/Supernumerary professors still
    # teach. Part-time, on-leave, former and rank-less entries are skipped.
    s = re.split(r"\s*(?:&|,|\()", clean(s))[0]
    s = re.sub(r"^(Supernumerary|Emeritus) Professor$|^Professor Emeritus$", "Professor", s)
    return s if s in RANKS else None


def person(s):
    s = re.sub(r"\(.*?\)", "", s.split(",")[0])
    return clean(re.sub(r"^(?:Professor Dr\.|Prof\. Dr\.|Prof\.|Professor|Mr\.|Mrs\.|Ms\.)\s+", "", clean(s)))


faculties, bodies = [], []
for opt in home.select("#facultyName option[value]"):
    name = clean(opt.get_text())
    if opt["value"] == "INST":  # not served by the department endpoint
        deps = list(dict.fromkeys((re.search(r"/body/(\w+)", a["href"])[1], clean(a.get_text()))
                                  for a in soup(f"{BASE}/institutes").select("a[href*='/body/']")
                                  if not clean(a.get_text()).startswith("View")))
    else:
        deps = departments(opt["value"]) if opt["value"] else []
    faculties.append({"name": name, "short": SHORT.get(name, name), "departments": [d for _, d in deps]})
    bodies += deps
    time.sleep(0.5)

teachers = []
for code, dept in bodies:
    time.sleep(0.5)
    for card in soup(f"{BASE}/body/FacultyMembers/{code}").select(".single-item .info"):
        if r := rank(card.select_one("span").get_text()):
            teachers.append((person(card.select_one("h4").get_text()), r, dept))

# Drop bodies the site lists without any teaching staff (Medicine, Education, ...).
staffed = {d for _, _, d in teachers}
for f in faculties:
    f["departments"] = [d for d in f["departments"] if d in staffed]
faculties = [f for f in faculties if f["departments"]]

write("du",
      name="University of Dhaka",
      tagline="",
      address="Dhaka-1000, Bangladesh",
      logo="data/logos/du.png",
      source=f"{BASE}/departments",
      faculties=faculties, teachers=teachers)
