# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""University of Chittagong's course codes. Few departments publish any: the course
catalog API behind each department site (cu.ac.bd/<dept>, "Course Catalog") is empty
for almost all of them, so this also reads the text-based PDFs they attach as
"Ordinance"/"Syllabus" (Academic > Ordinance, Forms & Downloads); scanned ones are
skipped. Run: uv run scrapers/cu_courses.py"""
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request

from pypdf import PdfReader

from common import ROOT, UA, clean, get, write_courses

API = "https://cu.ac.bd/peopleresources/php/ui/facultyprofile/"
DEPT = "https://cu.ac.bd/dept/"
FILES = "https://cu.ac.bd/assets/sectionacademicinfo/"
CODE = r"[A-Za-z]{2,6}\.?\s?-?\d{3,4}[A-Za-z]{0,2}"
WANTED = re.compile(r"syllabus|curricul|ordinan|ordian|ordinace|course", re.I)


def tidy(code):
    """"Bot. 601" -> "Bot-601", so that common.course_code() settles the rest."""
    return re.sub(r"^([A-Za-z]+)[\s.-]*(\d)", r"\1-\2", clean(code))


def junk(title):
    # also what bibliographies and mark breakdowns leave behind ("Press, 1977", "LA (20), Mapping (18)")
    return (len(title) < 4 or len(title) > 100 or not re.search(r"[A-Za-z]{3}", title)
            or not title[0].isupper() or re.search(r"https?:|www\.|Publish|\bPress\b|\bInc\b|\(\d+\)", title)
            or re.match(r"(credits?|marks?|total|hours?|course (no|title|code)|type)\b", title, re.I))


# where the numeric columns (credits, marks, "70+20+10", CLO ticks) start after a title
COLUMNS = re.compile(r"(?<!\S)\d+(?:\.\d+)?(?!\S)|\s\(\s*\d|\s\d+\+\d|\sCLO\d")
HEADING = re.compile(r"(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|year|semester|total|part|group|course|credit|marks?|paper|theory|practical|summer)\b", re.I)


def split_columns(s):
    """"Digital Signal Processing 3 100" -> ("Digital Signal Processing", True): the
    flag says the numeric columns were reached, i.e. the title is complete."""
    s = re.sub(r"[^\w)\].!?+#]+$", "", s)  # tick marks and other symbols the PDF font maps oddly
    m = COLUMNS.search(s)
    return (s[:m.start()], True) if m else (s, False)


def clean_title(t):
    t = re.split(rf"\s+(?:{CODE})\b", t)[0]  # a second code: the next column of the table
    t = re.sub(r"\s+(?:CORE|GED|MAT|LAB|VIVA|Core|Compulsory|Major|Minor|Optional)$", "", t)
    return clean(t).strip(" :-–|")


def from_text(text):
    """Typed or PDF-extracted lines: "PHY 1101: Mechanics", "Chem. 110F Physical Chemistry I  4.0 100",
    and titles wrapped over several lines until the credit column ("ICE3121 Digital Signal / Processing 3")."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        m = re.fullmatch(rf"\s*(?:\d{{1,2}}[.)]\s+|\d{{4}}\s+\d{{2}}\s+)?({CODE})\s*[:\-–.|]?(?:\s+([A-Za-z].*))?", line)
        if not m:
            continue
        title, done = split_columns(m[2] or "")  # no title yet: it is on the next line
        for nxt in map(clean, lines[i + 1:i + 4]):
            part, ended = split_columns(nxt)
            if done or not nxt or len(part) > 50 or HEADING.match(nxt) or re.match(rf"(?:{CODE})\b", nxt):
                break
            title, done = f"{title} {part}", ended
        if not junk(title := clean_title(title)):
            yield tidy(m[1]), title


def post(url, **data):
    req = urllib.request.Request(url, urllib.parse.urlencode(data).encode(), {"User-Agent": UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


def dept_name(d):
    n = clean(d["sec_title"])
    if d["leveltitle"] == "Department":
        return "Department of " + n
    if d["leveltitle"] == "Institute":  # the API drops the "Institute of" prefix
        return "Institute of " + n.replace(" And ", " and ")
    return n


def fetch(url, limit=25_000_000):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                return r.read(limit)
        except OSError as e:
            if i == 3 or getattr(e, "code", 500) < 500:
                raise
            time.sleep(2 ** (i + 1))


known = {d for f in json.loads((ROOT / "data" / "cu.json").read_text(encoding="utf-8"))["faculties"]
         for d in f["departments"]}
courses = []
for f in post(API + "get_all_faculty_departments.php")["data"]:
    for d in f["deptlist"]:
        dept = dept_name(d)
        if dept not in known:
            continue
        secno, n = d["secno"], len(courses)
        time.sleep(0.5)
        # 1. the course catalog API, newest session first
        sessions = post(DEPT + "php/ui/coursecatalog/get_all_sessions.php", secno=secno)
        for s in sorted((sessions or {}).get("data") or [], key=lambda s: -s["sessionno"]):
            time.sleep(0.5)
            for c in (post(DEPT + "php/ui/coursecatalog/get_coursecatalog_of_a_section.php",
                           secno=secno, sessionno=s["sessionno"]) or {}).get("data") or []:
                if re.match(r"[A-Za-z]", clean(c["coursecode"])):  # some entries are a bare "502"
                    courses.append((tidy(c["coursecode"]), c["coursetitle"], dept))
        # 2. attached ordinance/syllabus PDFs: the page embeds them as JSON
        time.sleep(0.5)
        m = re.search(r"var resp = (\{.*?\});\s*\n", get(f"{DEPT}academic_ordinance.php?secno={secno}&menumapno=117"))
        files = [(i["info"]["acinfono"], a["attachment_url"]) for i in (json.loads(m[1]).get("data") or [] if m else [])
                 for a in i["attachments"] if WANTED.search(i["info"]["infotitle"])]
        for _, name in sorted(files, reverse=True):
            time.sleep(0.5)
            try:
                text = "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(fetch(FILES + name))).pages)
            except Exception as e:  # scans have no text; nothing to take from them
                print("skipped", name, type(e).__name__, file=sys.stderr)
                continue
            courses += [(c, t, dept) for c, t in from_text(text)]
        # bibliographies cite years ("... Wastewater, APHA 1996"); a prefix seen only with a year is not a course
        mine = courses[n:]
        prefixes = {c.split("-")[0] for c, _, _ in mine if not re.search(r"-(19|20)\d\d$", c)}
        courses[n:] = [r for r in mine if r[0].split("-")[0] in prefixes]
        print(dept, len(courses) - n, flush=True)

write_courses("cu", source="https://cu.ac.bd/faculty-dept-inst/", courses=courses)
