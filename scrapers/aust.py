# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Ahsanullah University of Science and Technology. Run: uv run scrapers/aust.py"""
import re
import time

from common import clean, soup, write

BASE = "https://www.aust.edu"

# Grouping from /academics/faculties_&_departments; each department's own
# faculty page is used because /list_of_faculty_members is a stale 2020-22 list.
FACULTIES = [
    ("Faculty of Engineering", "FE", [
        ("Department of Civil Engineering", ["ce/faculty_members"]),
        ("Department of Computer Science and Engineering", ["cse/faculty_members"]),
        ("Department of Electrical and Electronic Engineering", ["eee/faculty_members"]),
        ("Department of Mechanical and Production Engineering",
         ["mpe/faculty_members_me", "mpe/faculty_members_ipe"]),
        ("Department of Textile Engineering", ["te/faculty_members"]),
        ("Department of Arts and Sciences", ["as/faculty_members"])]),
    ("Faculty of Architecture and Planning", "FAP", [
        ("Department of Architecture", ["arch/faculty_members"])]),
    ("Faculty of Business and Social Sciences", "FBSS", [
        ("School of Business", ["sob/faculty_members"])]),
    ("Faculty of Education", "FED", [
        ("Faculty of Education", ["ed/faculty_members"])]),
]
RANK = re.compile(r"Associate Professor|Assistant Professor|Professor|Lecturer", re.I)

teachers = []
for _, _, depts in FACULTIES:
    for dept, paths in depts:
        for path in paths:
            for card in soup(f"{BASE}/{path}").select(".card-body"):
                # Cards are name then designation (plus email); the Faculty of
                # Education page uses the same two lines in a different wrapper.
                lines = [clean(p.get_text()) for p in card.select("h5, p") if clean(p.get_text())]
                if len(lines) >= 2 and (rank := RANK.search(lines[1])):
                    # "Lecturer Grade-I/II" is a pay scale, not a different title.
                    teachers.append((lines[0], rank[0].title(), dept))
            time.sleep(0.5)

write("aust",
      name="Ahsanullah University of Science and Technology",
      tagline="",
      address="141 & 142 Love Road, Tejgaon Industrial Area, Dhaka-1208, Bangladesh",
      logo="data/logos/aust.svg",
      source=f"{BASE}/academics/faculties_&_departments",
      faculties=[{"name": n, "short": s, "departments": [d for d, _ in ds]} for n, s, ds in FACULTIES],
      teachers=teachers)
