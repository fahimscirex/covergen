# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Shahjalal University of Science and Technology. sust.edu.bd sits behind a Cloudflare
challenge, so schools and departments come from the English Wikipedia article (departments
only, no teacher list). Run: uv run scrapers/sust.py"""
import re
import time

from common import clean, get, write

PAGE = "Shahjalal_University_of_Science_and_Technology"
SHORT = {  # Wikipedia gives no acronyms for schools; these are the usual ones
    "School of Agriculture and Mineral Sciences": "SAMS",
    "School of Applied Sciences and Technology": "SAST",
    "School of Life Sciences": "SLS",
    "School of Management and Business Administration": "SMBA",
    "School of Medical Sciences": "SMS",
    "School of Physical Sciences": "SPS",
    "School of Social Sciences": "SSS",
}


def wikitext(page):
    url = f"https://en.wikipedia.org/w/index.php?title={page}&action=raw"
    for i in range(6):
        try:
            return get(url)
        except Exception as e:
            if getattr(e, "code", 0) != 429 or i == 5:  # rate limited: wait and retry slowly
                raise
            time.sleep(30)


def plain(s):
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)   # [[a|b]] -> b
    s = re.sub(r"<ref.*?(?:/>|</ref>)|\{\{.*?\}\}|\([A-Z]{2,5}\)", "", s)  # refs, templates, "(CSE)"
    return clean(s.replace("''", "")).replace("Social work", "Social Work")  # Wikipedia link-case quirk


text = wikitext(PAGE)
section = re.search(r"==\s*Schools and departments\s*==(.*?)\n==[^=]", text, re.S)[1]
faculties = []
for head, body in re.findall(r"===\s*(School of [^=]+?)\s*===(.*?)(?=\n===|\Z)", section, re.S):
    depts = [plain(m) for m in re.findall(r"^\*\s*(Department of .+)$", body, re.M)]
    # Medical sciences lists affiliated colleges, not departments: the school stands alone.
    faculties.append({"name": head, "short": SHORT[head], "departments": depts or [head]})
assert len(faculties) == len(SHORT), [f["name"] for f in faculties]

write("sust",
      name="Shahjalal University of Science and Technology",
      tagline="",  # Wikipedia only has a loose translation of the Bangla motto
      address="Sylhet-3114, Bangladesh",
      logo="data/logos/sust.png",
      source=f"https://en.wikipedia.org/wiki/{PAGE}",
      faculties=faculties, teachers=None)
