# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Islamic University of Technology. Run: uv run scrapers/iut.py"""
import re
import time

from common import clean, soup, write

FACULTIES = [
    ("Faculty of Engineering and Technology", "FET", [
        ("mpe", "Department of Mechanical and Production Engineering"),
        ("eee", "Department of Electrical and Electronic Engineering"),
        ("cse", "Department of Computer Science and Engineering"),
        ("cee", "Department of Civil and Environmental Engineering")]),
    ("Faculty of Science and Technical Education", "FSTE", [
        ("tve", "Department of Technical and Vocational Education"),
        ("btm", "Department of Business and Technology Management"),
        ("nsc", "Department of Natural Sciences")]),
]
RANK = re.compile(r"(Associate Professor|Assistant Professor|Professor|Junior Lecturer|Lecturer)"
                  r"( and Head.*)?", re.I)

teachers = []
for _, _, depts in FACULTIES:
    for sub, dept in depts:
        for p in soup(f"https://{sub}.iutoic-dhaka.edu/people/faculty").select(".ppl-item"):
            name = clean(p.h3.get_text()).split(",")[0]
            rank = clean(p.h4.get_text())
            if rank == "Head of the Department":
                rank = "Professor"
            # Visiting/adjunct entries carry their home institution after a
            # comma ("Professor, Department of ... DU"); skip those and non-teaching roles.
            if RANK.fullmatch(rank):
                teachers.append((name, RANK.fullmatch(rank)[1].title(), dept))
        time.sleep(0.5)

write("iut",
      name="Islamic University of Technology",
      tagline="",
      address="Board Bazar, Gazipur-1704, Bangladesh",
      logo="data/logos/iut.png",
      source="https://iutoic-dhaka.edu/academics/faculties_&_departments",
      faculties=[{"name": n, "short": s, "departments": [d for _, d in ds]} for n, s, ds in FACULTIES],
      teachers=teachers)
