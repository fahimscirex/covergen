# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""BRAC University. bracu.ac.bd sits behind a Cloudflare challenge, so the school and
department names come from the English Wikipedia article (departments only, no teacher
list). Wikipedia lists schools and departments separately; which department belongs to
which school is taken from the departments' own sites (e.g. cse.bracu.ac.bd names "School
of Data & Sciences") and the university's structure. A new, unmapped department stops the
run rather than being filed under a guess. Run: uv run scrapers/brac.py"""
import re
import time

from common import clean, get, write

PAGE = "BRAC_University"
SCHOOL_OF = {
    "Department of Architecture": "School of Architecture and Design",
    "Department of Biotechnology": "School of Life Sciences",
    "Department of Microbiology": "School of Life Sciences",
    "Department of Computer Science and Engineering": "School of Data and Sciences",
    "Department of Mathematics and Natural Sciences": "School of Data and Sciences",
    "Department of Economics and Social Sciences": "School of Humanities and Social Sciences",
    "Department of English and Humanities": "School of Humanities and Social Sciences",
    "Department of Electrical and Electronic Engineering": "BSRM School of Engineering",
}
SHORT = {
    "BRAC Business School": "BBS", "BSRM School of Engineering": "BSE",
    "James P Grant School of Public Health": "JPGSPH", "School of Architecture and Design": "SADes",
    "School of Data and Sciences": "SDS", "School of General Education": "SGE",
    "School of Humanities and Social Sciences": "SHSS", "School of Law": "SoL",
    "School of Life Sciences": "SLS", "School of Pharmacy": "SoP",
}


def wikitext(page):
    url = f"https://en.wikipedia.org/w/index.php?title={page}&action=raw"
    for i in range(6):
        try:
            return get(url)
        except Exception as e:
            if getattr(e, "code", 0) != 429 or i == 5:  # rate limited: wait and retry slowly
                raise
            time.sleep(30)


def bullets(text, heading):
    body = re.search(rf"===\s*{heading}\s*===(.*?)\n===", text, re.S)[1]
    return [clean(re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]|<ref.*?(?:/>|</ref>)|\{{.*?\}}", r"\1", m))
            for m in re.findall(r"^\*\s*(.+)$", body, re.M)]


text = wikitext(PAGE)
schools, depts = bullets(text, "Schools"), bullets(text, "Departments")
unmapped = [d for d in depts if d not in SCHOOL_OF]
assert schools and depts and not unmapped, f"unmapped departments: {unmapped}"
assert set(SHORT) == set(schools) and set(SCHOOL_OF.values()) <= set(schools), schools

faculties = []
for s in schools:
    mine = [d for d in depts if SCHOOL_OF[d] == s]
    # A school with no departments of its own is its single "department".
    faculties.append({"name": s, "short": SHORT[s], "departments": mine or [s]})

motto = re.search(r"\|\s*motto\s*=\s*([^\n|{<]+)", text)

write("brac",
      name="BRAC University",
      tagline=clean(motto[1]) if motto else "",
      address="Merul Badda, Dhaka-1212, Bangladesh",
      logo="data/logos/brac.svg",
      source=f"https://en.wikipedia.org/wiki/{PAGE}",
      faculties=faculties, teachers=None)
