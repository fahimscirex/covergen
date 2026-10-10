"""Shared helpers for the per-university scrapers.

Every scraper ends in write(): it validates the scrape and emits
data/<id>.json in the one format app.js reads:

  {
    "name", "tagline", "address", "logo", "source", "updated",
    "faculties": [{"name", "short", "departments": ["Department of ..."]}],
    "titles":    ["Professor", ...],             # designation lookup table
    "teachers":  [["Name", titleIdx, deptIdx]]   # deptIdx counts departments
  }                                              # across faculties, in order

Indices instead of repeated strings keep the files small; the app is served
from GitHub Pages and every byte is paid for once per visitor.
"""
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (covergen faculty directory; +https://covergen.scirex.me)"


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
        except Exception as e:
            # A 404 will still be a 404 in 30 seconds; only retry what can recover.
            if i == tries - 1 or getattr(e, "code", 500) < 500:
                raise
            print(f"retry {url}: {e}", file=sys.stderr)
            time.sleep(2 ** (i + 1))


def soup(url):
    return BeautifulSoup(get(url), "html.parser")


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


TITLE_CASE = {
    "prof": "Professor", "professor": "Professor",
    "associate professor": "Associate Professor", "assoc. professor": "Associate Professor",
    "assistant professor": "Assistant Professor", "asst. professor": "Assistant Professor",
    "lecturer": "Lecturer", "senior lecturer": "Senior Lecturer",
}


def title(s):
    s = clean(s).rstrip(",")
    return TITLE_CASE.get(s.lower(), s)


def person(s):
    s = clean(s)
    # The app prefixes the designation ("Asst. Prof. ..."), so courtesy titles
    # would double up. Trailing "(nickname)", ", PhD" and the "-2" some sites
    # use to tell namesakes apart don't belong on a cover either.
    s = re.sub(r"^(?:(?:Mr|Mrs|Ms|Miss|Engr)(?:\.\s*|\s+))+", "", s, flags=re.I)
    s = re.sub(r"\s*[(\[][^)\]]*[)\]]?$", "", s)
    s = re.sub(r"(?:,?\s+Ph\.?\s?D\.?|\s*-\s*\d+)$", "", s, flags=re.I)
    # Some directories shout names in ALL CAPS; a cover page should not.
    if s.isupper() and len(s) > 3:
        s = re.sub(r"(^|[\s.\-'])([a-z])", lambda m: m[1] + m[2].upper(), s.lower())
    return s


def write(uid, *, name, tagline, address, logo, source, faculties, teachers=None):
    """teachers: iterable of (name, designation, department), or None when the
    university publishes no list we can read (departments only)."""
    depts = [d for f in faculties for d in f["departments"]]
    assert len(depts) == len(set(depts)), "department listed twice"
    index = {d: i for i, d in enumerate(depts)}

    titles, rows, seen = [], [], set()
    for n, t, d in teachers or ():
        n, t, d = person(n), title(t), clean(d)
        if not n or (n, d) in seen:
            continue
        seen.add((n, d))
        assert d in index, f"{n}: department {d!r} is not in faculties"
        if t not in titles:
            titles.append(t)
        rows.append([n, titles.index(t), index[d]])

    assert rows or teachers is None, "scraped no teachers"
    assert depts, "scraped no departments"
    out = {
        "name": name, "tagline": tagline, "address": address, "logo": logo,
        "source": source, "updated": date.today().isoformat(),
        "faculties": faculties, "titles": titles, "teachers": rows,
    }
    # One teacher per line: compact, yet a re-scrape diffs line by line.
    body = json.dumps({k: v for k, v in out.items() if k != "teachers"},
                      ensure_ascii=False, separators=(",", ":"))[:-1]
    lines = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
    path = ROOT / "data" / f"{uid}.json"
    path.write_text(f'{body},"teachers":[\n{lines}\n]}}\n', encoding="utf-8")
    json.loads(path.read_text(encoding="utf-8"))  # self-check
    print(f"{path.relative_to(ROOT)}: {len(faculties)} faculties, {len(depts)} departments, "
          f"{len(rows)} teachers, {path.stat().st_size // 1024} KB")


def course_code(code):
    """"MKT1102(V1)", "GED1103_V2", "Bot. 601" or "mkt 1102" -> "MKT-1102" style."""
    code = re.sub(r"\(.*?\)", "", clean(code)).upper()
    code = re.sub(r"(?<=\d)[_\s]*V\d+$", "", code)  # revision tags: ALD2101V2, GED1103_V2
    return re.sub(r"^([A-Z]+)[\s.-]*(\d+[A-Z]{0,2})$", r"\1-\2", code.replace(" ", ""))


MINOR = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}
ROMAN = re.compile(r"^(?=[IVX]+$)X{0,3}(IX|IV|V?I{0,3})$")


def course_title(title):
    """A course title as a cover prints it, whatever state the site left it in."""
    t = clean(title)
    t = re.sub(r"^(?:[a-z]\)\s*)?[(.:,;\s]+", "", t)  # "a) (Computer Aided Design", ". Investigative"
    t = re.sub(r"\s*\([^()]*\b(?:only|major|prerequisite|pre-requisite|credits?)\b[^()]*\)", "", t, flags=re.I)
    t = re.sub(r"(?:\s+\d+(?:\.\d+)?){2,}$", "", t)  # credit columns: "Chemistry 3 3"
    t = re.sub(r"[\s.…,;:]+$", "", t)
    if t.count("(") > t.count(")"):
        t += ")"  # a note cut off mid-way: close it rather than lose it
    if t.isupper() and len(t) > 3:
        words = t.lower().split(" ")
        t = " ".join(w.upper() if ROMAN.match(w.upper()) else
                     w if i and w in MINOR else w[:1].upper() + w[1:]
                     for i, w in enumerate(words))
    return t


def write_courses(uid, *, source, courses):
    """courses: iterable of (code, title, department) -> data/courses/<uid>.json

      {"source", "updated", "departments": [...],
       "courses": [["MKT-1102", "Principles of Marketing", [deptIdx, ...]]]}

    A course several departments share (general education) is listed once.
    Departments are checked against data/<uid>.json, so the app can match
    them to the student's department; indices point into this file's own
    list, so re-scraping the teachers can never misalign them.
    """
    known = [d for f in json.loads((ROOT / "data" / f"{uid}.json").read_text(encoding="utf-8"))["faculties"]
             for d in f["departments"]]
    by_code = {}
    for code, name, dept in courses:
        code, name, dept = course_code(code), course_title(name), clean(dept)
        # Elective slots ("SE-41XX") are not courses; a roman numeral is part of a
        # title misread as a code ("II-12" from "Biochemistry-II 12").
        # "Course 501" or "Paper 3" is a page's numbering, not a code.
        if "XX" in code or ROMAN.match(code.split("-")[0]) or code.split("-")[0] in ("COURSE", "PAPER"):
            continue
        # A row with no real word in its title is a parsing leftover ("X X NN X").
        if not code or not any(len(re.sub(r"[^\w\u0980-\u09ff]", "", w)) >= 3 and not w.isdigit()
                               for w in name.split()):
            continue
        assert dept in known, f"{code}: department {dept!r} is not in data/{uid}.json"
        entry = by_code.setdefault(code, [code, name, set()])
        entry[2].add(dept)

    assert by_code, "scraped no courses"
    depts = [d for d in known if any(d in e[2] for e in by_code.values())]
    rows = [[c, n, sorted(depts.index(d) for d in ds)] for c, n, ds in sorted(by_code.values())]
    head = json.dumps({"source": source, "updated": date.today().isoformat(), "departments": depts},
                      ensure_ascii=False, separators=(",", ":"))[:-1]
    lines = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
    path = ROOT / "data" / "courses" / f"{uid}.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(f'{head},"courses":[\n{lines}\n]}}\n', encoding="utf-8")
    json.loads(path.read_text(encoding="utf-8"))  # self-check
    print(f"{path.relative_to(ROOT)}: {len(rows)} courses across {len(depts)} departments, "
          f"{path.stat().st_size // 1024} KB")
