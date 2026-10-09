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
    """Some directories shout names in ALL CAPS; a cover page should not."""
    s = clean(s)
    if s.isupper() and len(s) > 3:
        s = re.sub(r"(^|[\s.\-'])([a-z])", lambda m: m[1] + m[2].upper(), s.lower())
    # The app prefixes the designation ("Asst. Prof. ..."), so courtesy titles
    # would double up; "-2" is how some sites tell namesakes apart.
    s = re.sub(r"^(?:(?:Mr|Mrs|Ms|Miss|Engr)\.?\s+)+", "", s, flags=re.I)
    return re.sub(r"\s*-\s*\d+$", "", s)


def write(uid, *, name, tagline, address, logo, source, faculties, teachers):
    """teachers: iterable of (name, designation, department)."""
    depts = [d for f in faculties for d in f["departments"]]
    assert len(depts) == len(set(depts)), "department listed twice"
    index = {d: i for i, d in enumerate(depts)}

    titles, rows, seen = [], [], set()
    for n, t, d in teachers:
        n, t, d = person(n), title(t), clean(d)
        if not n or (n, d) in seen:
            continue
        seen.add((n, d))
        assert d in index, f"{n}: department {d!r} is not in faculties"
        if t not in titles:
            titles.append(t)
        rows.append([n, titles.index(t), index[d]])

    assert rows, "scraped no teachers"
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
