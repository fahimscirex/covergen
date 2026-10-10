# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Jagannath University's course codes, from the "Course Information" tables in each
department portal's Programs section (jnu.ac.bd/department/portal/<dept>).
Run: uv run scrapers/jnu_courses.py"""
import re
import time

from common import clean, soup, write_courses

BASE = "https://jnu.ac.bd"
CODE = r"[A-Za-z]{2,6}\.?\s?-?\d{3,4}[A-Za-z]{0,2}"


def tidy(code):
    """"Bot. 601" -> "Bot-601", so that common.course_code() settles the rest."""
    return re.sub(r"^([A-Za-z]+)[\s.-]*(\d)", r"\1-\2", clean(code))


departments = []
for a in soup(BASE).select('a.font-weight-600[href*="/faculty/portal/"]'):
    for d in soup(a["href"]).select('a[href*="/department/portal/"]'):
        departments.append((clean(d.get_text()).replace("&", "and"), d["href"]))
    time.sleep(0.5)

courses = []
for dept, url in dict.fromkeys(departments):
    time.sleep(0.5)
    n = len(courses)
    for panel in soup(url).select('[id^="program_toggle_course"]'):
        # some departments type the list as plain lines: "PHY 1101: Mechanics", "BMB 1101 (Basic Biochemistry-I)"
        for line in panel.get_text("\n").splitlines():
            m = re.fullmatch(rf"\s*({CODE})\s*(?:[:\-\u2013.]\s*([A-Za-z].+?)\s*(?:\(.*\))?|\(\s*([A-Za-z].+?)\s*\))\s*", line)
            if m:
                courses.append((tidy(m[1]), m[2] or m[3], dept))
        for tr in panel.select("tr"):
            cells = [clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
            cells = [c for c in cells if c]
            for i, c in enumerate(cells):
                m = re.fullmatch(rf"({CODE})(?:\s*[:\-]\s*(.+))?", c)
                if not m:
                    continue
                # the title is the rest of this cell or the next cell with letters in it
                title = m[2] or next((t for t in cells[i + 1:] if re.search(r"[A-Za-z]{3}", t)
                                      and not re.fullmatch(rf"{CODE}|[\d.\s]*(?:credits?|marks?)?", t, re.I)), "")
                if title:
                    courses.append((tidy(m[1]), title, dept))
                break
    print(dept, len(courses) - n, flush=True)

write_courses("jnu", source=f"{BASE}/department/portal/", courses=courses)
