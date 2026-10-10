# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""University of Dhaka's course codes, from the "Curriculum & Courses" tab of each
program page (www.du.ac.bd/programDetails/<dept>/<id>), which lists every course of
every year and semester. Run: uv run scrapers/du_courses.py"""
import json
import re
import time
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

from bs4 import BeautifulSoup

from common import ROOT, UA, clean, soup, write_courses

BASE = "https://www.du.ac.bd"

# Same department discovery as du.py: the list is POSTed per faculty and needs a CSRF token.
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


known = {d for f in json.loads((ROOT / "data" / "du.json").read_text(encoding="utf-8"))["faculties"]
         for d in f["departments"]}
bodies = []
for opt in home.select("#facultyName option[value]"):
    if opt["value"] == "INST":
        bodies += list(dict.fromkeys((re.search(r"/body/(\w+)", a["href"])[1], clean(a.get_text()))
                                     for a in soup(f"{BASE}/institutes").select("a[href*='/body/']")
                                     if not clean(a.get_text()).startswith("View")))
    elif opt["value"]:
        bodies += departments(opt["value"])
    time.sleep(0.5)

# Each row reads "<prerequisite or N/A><CODE> | Title | 3 Cr."; the prerequisite runs straight
# into the code (and some departments prefix a 4-digit ISCED number), so the code is the
# last letters+digits group before the first bar.
def code_of(head):
    head = re.sub(r"^\d{4}-", "", head.replace("N/A", " ").strip())
    head = re.sub(r"(?<=\d)(?=[A-Za-z]{2,6}[.:\s-]*\d)", "\n", head)  # "CSE 1103CSE 1201"
    for piece in reversed(head.split("\n")):
        found = list(re.finditer(r"([A-Za-z]+)[.\s-]*(\d{2,4})\s?([A-Za-z]{0,2})", piece))
        if found:
            # "UrduUrdu 502", "PrefixJLC 512": a word glued on in front of the real code
            letters = re.split(r"(?<=[a-z])(?=[A-Z])", found[-1][1])[-1]
            if len(letters) >= 2 and letters.lower() != "course":  # Fine Art numbers its "Course 111"
                return f"{letters}-{found[-1][2]}{found[-1][3]}"
    return None


courses = []
for code, dept in dict.fromkeys(bodies):
    if dept not in known:
        continue
    time.sleep(0.5)
    programs = dict.fromkeys(a["href"] for a in soup(f"{BASE}/body/{code}").select('a[href*="/programDetails/"]'))
    for url in programs:
        time.sleep(0.5)
        try:
            rows = soup(url).select("#tab2 .panel-body .title")
        except OSError as e:  # a few program pages answer 500 for good
            print("skipped", url, e)
            continue
        for row in rows:
            head, _, rest = clean(row.get_text()).partition("|")
            if (c := code_of(head)) and rest:
                courses.append((c, rest.split("|")[0], dept))
    print(code, dept, len(courses), flush=True)

write_courses("du", source=f"{BASE}/departments", courses=courses)
