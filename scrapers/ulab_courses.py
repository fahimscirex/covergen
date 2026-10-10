# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""ULAB's course codes, from the admissions site's course catalogue (one
filterable list per program, 10 courses a page). Run: uv run scrapers/ulab_courses.py"""
import re
import time

from common import clean, soup, write_courses

URL = "https://admissions.ulab.edu.bd/academics/course-catalogue"
D = "Department of {}".format

# The catalogue's program filter (field_course_catalogue_tid) -> department.
# The research centre's catalogue (81, CSD) has no department of its own.
# ETE shares the EEE department.
PROGRAMS = {
    79: D("Business Administration"), 86: D("Business Administration"), 88: D("Business Administration"),
    1691: D("Bangla Language and Literature"),
    80: D("Computer Science and Engineering"),
    83: D("Electrical and Electronic Engineering"), 84: D("Electrical and Electronic Engineering"),
    85: D("English and Humanities"), 1680: D("English and Humanities"),
    82: D("Media Studies and Journalism"), 89: D("Media Studies and Journalism"),
    1687: D("Environmental Science and Sustainability"),
    87: "General Education Department",
}
# Real codes are letters + a four-digit number ("MSJ 3162"); the catalogue also prints
# the registrar's long numeric ids and older three-digit codes, which are skipped.
CODE = re.compile(r"\b[A-Z]{2,5} ?\d{4}[A-Z]?\b")
LEGACY = re.compile(r"\b[A-Z]{2,5} ?\d{3}[A-Z]?\b")

courses = []

# Department sites first: they print the current curriculum's codes (the catalogue still mixes in
# legacy three-digit ones). GED's own table covers the general education courses.
TABLES = [
    ("https://eee.ulab.edu.bd/eee/course-information/" + p, D("Electrical and Electronic Engineering"))
    for p in ("eee-course-distribution", "eee-major-core-courses", "eee-ged-courses")
] + [("https://ged.ulab.edu.bd/ged-course-structure", "General Education Department")]
for url, dept in TABLES:
    for tr in soup(url).select("table tr"):
        td = [clean(x.get_text(" ")) for x in tr.find_all(["td", "th"])]
        # Term headers ("Term 1") share the row with the first course.
        td = td[1:] if len(td) > 3 and td[0].lower().replace(" ", "").startswith("term") else td
        if len(td) >= 2 and (m := re.match(r"^([A-Z]{3} ?\d{4})\b", td[0])):
            courses.append((m[1], td[1], dept))
    time.sleep(0.5)

# Only ETE has nothing but three-digit codes in the catalogue; keep them there.
LEGACY_OK = {84}
for tid, dept in PROGRAMS.items():
    page = 0
    while rows := soup(f"{URL}?field_course_catalogue_tid={tid}&page={page}").select(".views-row"):
        for r in rows:
            code = r.select_one(".views-field-title-1 .field-content")
            name = r.select_one(".views-field-field-title .field-content")
            if code and name:
                text = clean(code.get_text(" ")).upper()
                found = CODE.findall(text) or (LEGACY.findall(text) if tid in LEGACY_OK else [])
                courses += [(c, name.get_text(" "), dept) for c in found]
        page += 1
        time.sleep(0.5)

write_courses("ulab", source=URL, courses=courses)
