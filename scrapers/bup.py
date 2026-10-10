# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Bangladesh University of Professionals. Run: uv run scrapers/bup.py"""
import re

from common import clean, soup, write

BASE = "https://bup.edu.bd"


def dept(name):
    # FBS lists its departments as "Business Administration in Marketing";
    # students and covers just say "Department of Marketing".
    name = clean(name)
    name = re.sub(r"^Department of Business Administration in ", "Department of ", name)
    return name.replace("Business Administration - General", "Business Administration")


def faculties():
    """[(faculty, short, {department: department page URL})], from the home page."""
    out = []
    for a in soup(BASE).select('a[href*="/faculty_home/"]'):
        m = re.match(r"(Faculty of .+?) \((\w+)\)$", clean(a.get_text()))
        if not m or m[1] in [f[0] for f in out]:
            continue
        links = {}
        for d in soup(a["href"]).select('a[href*="/department_home/"]'):
            name = dept(d.get_text())
            if name.startswith("Department of"):
                links.setdefault(name, d["href"])
        out.append((m[1], m[2], links))
    return out


if __name__ == "__main__":
    teachers, current = [], None
    for el in soup(f"{BASE}/faculty-members").select("h1.text-secondary, .member-list-card"):
        if el.name == "h1":
            current = dept(el.get_text())
        else:
            teachers.append((el.select_one(".card-title").get_text(),
                             el.select_one(".card-text").get_text(), current))

    write("bup",
          name="Bangladesh University of Professionals",
          tagline="Excellence Through Knowledge",
          address="Mirpur Cantonment, Dhaka-1216, Bangladesh",
          logo="assets/bup_logo.svg",
          source=f"{BASE}/faculty-members",
          faculties=[{"name": f, "short": s, "departments": list(d)} for f, s, d in faculties()],
          teachers=teachers)
