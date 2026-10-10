# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""BUP's course codes, from each department's program pages, where the whole
curriculum is listed by semester. Run: uv run scrapers/bup_courses.py"""
import time

from bup import faculties
from common import clean, soup, write_courses

courses = []
for _, _, links in faculties():
    for name, url in links.items():
        for program in soup(f"{url}/program").select('a[href*="/academics/academic_details/"]'):
            time.sleep(0.5)
            for row in soup(program["href"]).select(".course-header span:first-child"):
                code, _, title = clean(row.get_text()).partition("|")
                courses.append((code, title, name))

write_courses("bup", source="https://bup.edu.bd/academics", courses=courses)
