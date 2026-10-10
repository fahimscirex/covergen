# /// script
# dependencies = ["beautifulsoup4", "pypdf"]
# ///
"""Khulna University's course codes, from the curriculum PDFs each discipline links from
its Undergraduate and Graduate program pages (undergraduate first, so its titles win).
The PDFs come in several layouts (old syllabus tables, OBE curricula whose rows carry an
ISCED prefix "0714 02 CSE 1101: Title"), so one tolerant row pattern reads them all:
a code (2-6 letters + 4 digits) followed by a title, minus trailing credits/type columns.
A course goes to the discipline whose page links the PDF, so service courses taken from
other disciplines (MATH, PHY, ENG...) appear under the discipline whose curriculum
lists them. Ordinances, calendars and thesis formats are skipped.
Run: uv run scrapers/ku_courses.py"""
import io
import logging
import re
import sys
import time
import urllib.request
from urllib.parse import quote

import pypdf

from common import UA, clean, soup, write_courses

BASE = "https://ku.ac.bd"
SKIP = re.compile(r"ordinance|calendar|calender|thesis format|examination", re.I)
KEEP = re.compile(r"curricul|syllab|course outline", re.I)   # "Ordinance and Course outline for MSS"
# reference-list and boilerplate abbreviations that look like course codes
NOT_A_PREFIX = {"BAC", "UGC", "IQAC", "KU", "ISBN", "ISO", "IEEE", "DOI", "PP", "NO", "SL", "VOL",
                "ED", "EDN", "ACM", "RFC", "IS", "ABET", "AD", "BC", "ISSN", "SINCE", "CHAPTER"}

ROW = re.compile(r"^\s*(?:\d{4}\s\d{2}\s+)?([A-Za-z]{2,6})[\s\-]?(\d{4})\*?\s*[:\-–.]?\s+(\S.*)$")
TAIL = re.compile(r"(?:\s+(?:[\d.]+(?:[-+/][\d.]+)*|Core\*?|Optional(?:/Elective)?|Elective|Compulsory|Theory|Lab|"
                  r"Sessional|Required|None|Major(?: Course)?|Minor|Non-Core|Nil|[-–●*]|(?:CW|MD|MI),?|X(?=\s+X\b)|(?<=X\s)X))+\s*$", re.I)
CONT = re.compile(r"^(?:and|of|for|in|to|with|&|\(|[a-z])")
OPEN_END = re.compile(r"(?:\b(?:and|of|for|in|to|with|on|the)|[&,:\-–(])$")   # the title goes on next line


def fetch(url):
    for i in range(6):
        try:
            req = urllib.request.Request(quote(url, safe=":/%"), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except OSError as e:      # the server resets connections on big files; just retry
            if i == 5 or getattr(e, "code", 500) < 500:
                raise
            time.sleep(3 * (i + 1))


def rows(text):
    lines = text.split("\n")
    for i, l in enumerate(lines):
        m = ROW.match(l)
        if not m:
            continue
        prefix, num, title = m[1].upper(), m[2], m[3]
        if prefix in NOT_A_PREFIX or (re.match(r"(19|20)\d\d", num) and prefix != "ES"):
            continue
        title = TAIL.sub("", title).strip()
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        tail = TAIL.sub("", nxt)
        if (nxt and (CONT.match(nxt) or OPEN_END.search(title)) and not ROW.match(nxt) and len(nxt) < 60
                and not re.search(r"\d", tail)):
            title = f"{title} {tail}".strip()      # title wrapped onto the next line
        title = re.sub(r"\s+(?:Credits?\b|Contact Hours?\b|\(Prerequisite).*$|(?:\s+X){2,}$", "", title)
        if (len(title) < 4 or len(title) > 110 or not re.match(r"[A-Z(]", title) or OPEN_END.search(title)
                or re.search(r"\d{4}\s\d{2}|\b(?:19|20)\d\d\b|pp\.|ISBN|http", title)):
            continue
        yield f"{prefix}-{num}", title


logging.disable(logging.CRITICAL)  # pypdf warns about every odd font
schools = soup(BASE).find("a", string=lambda s: s and clean(s) == "Schools").find_next_sibling("ul")
courses, seen = [], set()
programs = []
for a in schools.select('ul a[href*="/discipline/"]'):
    programs.append((clean(a.get_text()), a["href"].rstrip("/")))
# undergraduate PDFs of every discipline come before any graduate one
for level in ("undergraduate", "graduate"):
    for dept, url in programs:
        time.sleep(0.5)
        for a in soup(f"{url}/programs/{level}").select('a[href*="/uploads/courses/"]'):
            pdf = a["href"]
            if pdf in seen or (SKIP.search(clean(a.get_text())) and not KEEP.search(clean(a.get_text()))) or not pdf.lower().endswith(".pdf"):
                continue
            seen.add(pdf)
            time.sleep(0.5)
            try:
                reader = pypdf.PdfReader(io.BytesIO(fetch(pdf)))
                text = "\n".join(p.extract_text() or "" for p in reader.pages)
            except Exception as e:
                print(f"skipped {pdf}: {e}", file=sys.stderr)
                continue
            found = [(code, title, dept) for code, title in rows(text)]
            print(f"{dept} / {level} / {clean(a.get_text())[:50]}: {len(found)} rows", file=sys.stderr)
            courses += found

write_courses("ku", source=f"{BASE}/", courses=courses)
