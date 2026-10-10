# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""CUET's course codes and titles. Run: uv run scrapers/cuet_courses.py

Only Materials and Metallurgical Engineering publishes a readable curriculum:
the Downloads list of the JSON API behind cuet.ac.bd has its "Academic
Curriculum" PDF. Architecture's bulletin and the course-registration notices
are scanned images, and the other departments publish nothing (the student
portal, course.cuet.ac.bd, needs a login).
"""
import io
import json
import re
import urllib.request

from pypdf import PdfReader

from common import UA, clean, get, write_courses

API = "https://api.cuet.ac.bd/api/v1"
SMALL = {"and", "of", "in", "for", "to", "the", "on", "with", "a", "an", "by", "at", "from"}


def dept_name(title):
    return "Department of " + clean(title).replace(" & ", " and ").replace(" And ", " and ")


def title_case(s):
    s = clean(s)
    if not s.isupper():
        return s
    words = [w if re.fullmatch(r"I{1,3}|IV|V|VI", w) else w.lower() if w.lower() in SMALL else w.capitalize()
             for w in s.split()]
    words[0] = words[0][:1].upper() + words[0][1:]
    return " ".join(words)


def pdf_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(r.read())).pages)


courses = []
for item in json.loads(get(f"{API}/downloads"))["data"]:
    if not re.search(r"curriculum|syllabus", item["title"], re.I) or not item["file"].lower().endswith(".pdf"):
        continue
    dept = dept_name(item["administrative_department_title"])
    text = pdf_text(item["file"])
    # Term tables: "MME 214" / "Fuels and Combustion" / "Sessional" / "0-0.75 Credits".
    for code, name in re.findall(
            r"^([A-Z]{2,5} \d{3})[ \t]*\n(.{3,90}?)\s*\n\s*\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s+Credits?", text, re.M | re.S):
        courses.append((code, " ".join(name.split()), dept))
    # Syllabus sheets: "MME 211: THERMODYNAMICS OF MATERIALS".
    for code, name in re.findall(r"^([A-Z]{2,5} \d{3})[ \t]*:[ \t]*(.+?)[ \t]*$", text, re.M):
        courses.append((code, title_case(name), dept))
    print(f"{dept}: {len(courses)} rows from {item['title']!r}")

write_courses("cuet", source="https://cuet.ac.bd/downloads", courses=courses)
