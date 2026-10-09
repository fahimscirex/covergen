# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""United International University. Run: uv run scrapers/uiu.py"""
import re

from common import clean, soup, write

SOURCE = "https://www.uiu.ac.bd/academics/faculty-members/"

# The faculty-members page has one table per department, headed
# "Faculty Member List: <name>"; the school grouping is from /academics/schools-institutes/.
FACULTIES = [
    ("School of Business and Economics", "SoBE", {
        "Business Administration": "Department of Business Administration",
        "Department of Economics": "Department of Economics"}),
    ("School of Science and Engineering", "SoSE", {
        "Department of Civil Engineering": "Department of Civil Engineering",
        "Department of Computer Science and Engineering": "Department of Computer Science and Engineering",
        "Department of Electrical and Electronic Engineering": "Department of Electrical and Electronic Engineering"}),
    ("School of Humanities and Social Sciences", "SoHS", {
        "Department of Environment & Development Studies": "Department of Environment and Development Studies",
        "Department of Media Studies & Journalism": "Department of Media Studies and Journalism",
        "Department of English": "Department of English"}),
    ("School of Life Sciences", "SoLS", {
        "Department of Pharmacy": "Department of Pharmacy",
        "Department of Biotechnology and Genetic Engineering": "Department of Biotechnology and Genetic Engineering"}),
    ("Institute of Natural Sciences", "INS", {
        "Institute of Natural Sciences": "Institute of Natural Sciences"}),
]
DEPT = {k: v for _, _, m in FACULTIES for k, v in m.items()}
RANK = re.compile(r"Associate Professor|Assistant Professor|Senior Lecturer|Professor|Lecturer")

teachers = []
for table in soup(SOURCE).select("table"):
    key = clean(table.find_previous(["h2", "h3", "h4"]).get_text()).removeprefix("Faculty Member List: ")
    for tr in table.select("tr"):
        td = [clean(x.get_text(" ")) for x in tr.find_all("td")]
        # "Part-time/Adjunct/Guest Faculty" and the Vice Chancellor have no teaching rank.
        if len(td) >= 3 and (rank := RANK.search(td[2])):
            teachers.append((td[1].split(",")[0], rank[0], DEPT[key]))

write("uiu",
      name="United International University",
      tagline="",
      address="United City, Madani Avenue, Badda, Dhaka-1212, Bangladesh",
      logo="data/logos/uiu.png",
      source=SOURCE,
      faculties=[{"name": n, "short": s, "departments": list(dict.fromkeys(m.values()))}
                 for n, s, m in FACULTIES],
      teachers=teachers)
