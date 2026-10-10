# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""IUT's course codes, from the course-structure PDFs two departments publish on their
sites (EEE: Academic Catalogue page; BTM: Students > Curriculum). The other departments
publish no readable curriculum: CSE embeds a Google Drive viewer, MPE/CEE/NSC link no
curriculum, TVE's is a scanned image. Each course goes to the department whose catalogue
lists it (so allied Math/Phy/Hum/CSE courses appear under EEE and BTM).
Catalogues are read newest first; the first title seen for a code wins, and a title read
from a full table row (type column present) beats one cut off by a line break.
Run: uv run scrapers/iut_courses.py"""
import io
import logging
import re
import sys
import time
import urllib.request
from urllib.parse import urljoin

import pypdf

from common import UA, clean, soup, write_courses

SITES = [  # (site, page listing the PDFs, link-text filter, department)
    ("https://eee.iutoic-dhaka.edu", "/academic-catalogue", r"Course Curriculum 202\d",
     "Department of Electrical and Electronic Engineering"),
    ("https://btm.iutoic-dhaka.edu", "/students/curriculum", r"HANDBOOK",
     "Department of Business and Technology Management"),
]
CODE = re.compile(r"^\s*([A-Za-z]{2,5})\s{0,3}(\d{4})\b\s*(.*)$")
TYPE = re.compile(r"\b(Theory|Practical|Sessional|Project|Thesis|Viva|Seminar|Field\s*Work)\b.*$")
HEADING = re.compile(r"^(\d+\.|Contact|Course|Code|Total|[A-Z]\.\s)")


def fetch(url):
    for i in range(6):   # the server cuts large PDFs short; a truncated file fails to parse
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                reader = pypdf.PdfReader(io.BytesIO(r.read()))
                return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception as e:
            if i == 5:
                print(f"skipped {url}: {e}", file=sys.stderr)
                return ""
            time.sleep(3 * (i + 1))


def rows(text):
    """(code, title, rank); rank 0 = title read up to the Type column, 1 = no type column,
    2 = title looks cut off ("... and")."""
    lines = text.split("\n")
    # catalogues with a Type column wrap titles over several lines; those without do not
    typed_doc = sum(bool(TYPE.search(l)) for l in lines) > 0.3 * max(1, sum(bool(CODE.match(l)) for l in lines))
    i = 0
    while i < len(lines):
        m = CODE.match(lines[i])
        if not m:
            i += 1
            continue
        codes, rest, j = [(m[1].upper(), m[2])], m[3].strip(), i + 1
        # paired codes: "Hum 4122/" "Hum 4124" "Arabic I/ English I Practical"
        while rest in ("", "/") or (rest.endswith("/") and CODE.match(rest.rstrip("/"))):
            n = CODE.match(lines[j]) if j < len(lines) else None
            if not n:
                break
            codes.append((n[1].upper(), n[2]))
            rest, j = n[3].strip(), j + 1
        title = rest.lstrip("/ ").strip()
        t = TYPE.search(title)
        typed, k = bool(t), j
        if t:
            title = title[:t.start()]
        else:
            parts = [title] if title else []
            while k < len(lines) and k < j + 3:
                nx = lines[k].strip()
                if not nx or CODE.match(nx) or HEADING.match(nx):
                    break
                t = TYPE.search(nx)
                if t:
                    parts.append(nx[:t.start()])
                    k, typed = k + 1, True
                    break
                parts.append(nx)
                k += 1
                if title and not typed_doc and (len(nx) > 25 or not re.match(r"^(Lab|Sessional|[a-z&(])", nx)):
                    parts.pop()      # without a type column only a lone short tail ("Lab") continues a title
                    k -= 1
                    break
            title = " ".join(parts)
        title = re.sub(r"\s*\bCredit.*$", "", clean(title)).strip(" /:")
        title = re.sub(r"\s+[\d.]+(?:\s+[\d.]+)*$", "", title)
        rank = 0 if typed else (2 if re.search(r"(\b(and|of|for|in|to|with|on)|&|\()$", title)
                                or title.count("(") > title.count(")") else 1)
        if 3 <= len(title) <= 80 and re.match(r"[A-Z]", title):   # prose lines that start like a code are longer
            for prefix, num in codes:
                yield f"{prefix}-{num}", title, rank
        i = max(j, i + 1)


logging.disable(logging.CRITICAL)
best = {}
for site, page, label, dept in SITES:
    links = [(clean(a.get_text()), urljoin(site + "/", a["href"])) for a in soup(site + page).select("a[href$='.pdf']")
             if re.search(label, a.get_text(), re.I)]
    # newest catalogue first: "Course Curriculum 2025" before "2016", "HANDBOOK 2023" before "2018"
    links.sort(key=lambda l: -int((re.findall(r"\d{4}", l[0]) or ["0"])[-1]))
    for text, url in links:
        time.sleep(0.5)
        found = list(rows(fetch(url)))
        print(f"{dept}: {text}: {len(found)} rows", file=sys.stderr)
        for code, title, rank in found:
            if (dept, code) not in best or rank < best[dept, code][0]:
                best[dept, code] = (rank, title)

# a prefix seen with fewer than three codes is running text ("March 1981"), not a course series
series = {}
for (dept, code) in best:
    series.setdefault(code.split("-")[0], set()).add(code)
best = {k: v for k, v in best.items() if len(series[k[1].split("-")[0]]) >= 3}

write_courses("iut", source="https://iutoic-dhaka.edu/academics/faculties_&_departments",
              courses=((c, t, d) for (d, c), (_, t) in best.items()))
