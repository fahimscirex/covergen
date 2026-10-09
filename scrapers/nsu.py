# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""North South University. Run: uv run scrapers/nsu.py"""
import re
import time

from common import clean, soup, write

BASE = "https://www.northsouth.edu"
ECE = "https://ece.northsouth.edu/people/type/faculty/"  # ECE keeps its own WordPress site

SCHOOLS = {
    "sbe": ("School of Business and Economics", "SBE"),
    "seps": ("School of Engineering and Physical Sciences", "SEPS"),
    "shss": ("School of Humanities and Social Sciences", "SHSS"),
    "shls": ("School of Health and Life Sciences", "SHLS"),
}
RANK = re.compile(r"(Associate Professor|Assistant Professor|Senior Lecturer|Lecturer|Professor|Adjunct[A-Za-z ]*)", re.I)


def person_name(s):
    s = re.sub(r"\[[^\]]*\]|&lbrack;.*|\(.*?\)", "", s)
    s = re.split(r",|\s+Ph\.?D", s)[0]
    return re.sub(r"^(Prof\.|Professor|Mr\.|Mrs\.|Ms\.)\s*", "", clean(s))


def rank(s):
    m = RANK.search(clean(s).replace("Asst.", "Assistant").replace("Assoc.", "Associate"))
    return "Adjunct Faculty" if m and m[1].lower().startswith("adjunct") else m and m[1]


def pages(url):
    """Yield every page of a paginated listing until one repeats or is empty."""
    seen = set()
    for n in range(1, 30):
        page = soup(url if n == 1 else f"{url}?page={n}")
        key = [clean(a.get_text()) for a in page.select(".team-item h5, .faculty-excerpt h4")]
        if not key or set(key) <= seen:
            return
        seen |= set(key)
        yield page
        time.sleep(0.5)


home = soup(BASE)
links = list(dict.fromkeys(a["href"] for a in home.select('a[href*="/faculty-members/"]')
                           if re.search(r"/faculty-members/\w+/[\w-]+/$", a["href"])))
faculties = {k: {"name": v[0], "short": v[1], "departments": []} for k, v in SCHOOLS.items()}
teachers = []
for url in links:
    code = url.split("/faculty-members/")[1].split("/")[0]
    first = soup(url)
    dname = clean(re.sub(r" - Faculty Members.*", "", first.title.get_text()).replace("&", "and"))
    faculties[code]["departments"].append(dname)
    for page in pages(url):
        for el in page.select(".team-item, .faculty-excerpt"):
            h = el.select_one("h5, h4")
            info = el.select_one("b, h6")
            r = rank(info.get_text(" ")) if info else None
            if r:
                teachers.append((person_name(h.get_text()), r, dname))

ece = "Department of Electrical and Computer Engineering"
faculties["seps"]["departments"].insert(2, ece)
last = 1
n = 1
while n <= last:
    page = soup(f"{ECE}?page={n}")
    last = max([last] + [int(a.get_text()) for a in page.select("a.page") if a.get_text().isdigit()])
    for td in page.select("td.faculty-name"):
        strong = td.find_all("strong")
        r = rank(strong[1].get_text()) if len(strong) > 1 else None
        if r:
            teachers.append((person_name(strong[0].get_text()), r, ece))
    n += 1
    time.sleep(0.5)

write("nsu",
      name="North South University",
      tagline="Center of Excellence in Higher Education",
      address="Plot 15, Block B, Bashundhara, Dhaka-1229, Bangladesh",
      logo="data/logos/nsu.png",
      source=BASE,
      faculties=list(faculties.values()), teachers=teachers)
