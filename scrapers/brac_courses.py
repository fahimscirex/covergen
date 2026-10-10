# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""BRAC University's course codes. bracu.ac.bd sits behind a Cloudflare challenge, so only
the CSE department site (cse.bracu.ac.bd), which lists its undergraduate and postgraduate
courses, is read; the other departments publish nothing reachable.
Run: uv run scrapers/brac_courses.py"""
import re

from common import clean, soup, write_courses

courses = []
for a in soup("https://cse.bracu.ac.bd/course/list").select('a[href*="/course/view/"]'):
    code, title = (clean(p.get_text()) for p in a.select("div > p")[:2])
    if re.fullmatch(r"[A-Z]{3}\d{3}", code):   # the list also links "1 Postgraduate Degree Details"
        courses.append((code, title, "Department of Computer Science and Engineering"))

write_courses("brac", source="https://cse.bracu.ac.bd/course/list", courses=courses)
