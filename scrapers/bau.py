# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Bangladesh Agricultural University. Faculty/department sites are Nuxt apps that
fetch teachers from app.bau.edu.bd/api with the public X-API-KEY the site's own
JavaScript ships to every browser. The key is not kept in this repo: the scraper reads it
from the live /_nuxt/*.js bundles of a faculty site at run time.
Run: uv run scrapers/bau.py"""
import json
import re
import time
import urllib.request
from urllib.parse import urlparse

from common import UA, clean, get, soup, write


def who(s):
    """Drop "(Chairman)", "(Study Leave)", nicknames and Bangla renderings after the name."""
    s = re.sub(r"\([^)]*\)?|[\u0980-\u09FF]+", " ", s)
    return clean(s).replace(" .", ".")


API = "https://app.bau.edu.bd/api/department/{}/teachers/inservice"
TEACHING = ("professor", "lecturer")
FACULTIES = {  # subdomain -> acronym; the faculty pages list their departments
    "ag": "FA", "fvs": "FVS", "ah": "FAH", "aers": "FAERS", "aet": "FAET", "fs": "FF"}


def api_key(site="https://ag.bau.edu.bd"):
    for path in dict.fromkeys(re.findall(r'/_nuxt/[^"\'\s]+\.js', get(site + "/"))):
        m = re.search(r'"X-API-KEY"\s*:\s*"([^"]+)"', get(site + path))
        if m:
            return m[1]
    raise SystemExit(f"X-API-KEY not found in the /_nuxt bundles of {site}")


KEY = api_key()


def teachers_of(sub):
    req = urllib.request.Request(API.format(sub), headers={"User-Agent": UA, "X-API-KEY": KEY})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except OSError:
            if i == 3:
                raise
            time.sleep(2 ** (i + 1))


faculties, subs = [], {}
for sub, short in FACULTIES.items():
    page = soup(f"https://{sub}.bau.edu.bd/")
    # the faculty name only appears in the page's embedded state
    name = re.search(r'"(Faculty of [^"]+)"', str(page))[1]
    depts = []
    for a in page.select('a[href^="http"][href*=".bau.edu.bd"]'):
        host = urlparse(a["href"]).hostname.split(".")[0]
        if host in ("bau", "www", "app", "bsert", "brtc") or "Employee" in a.get_text():
            continue
        d = "Department of " + clean(a.get_text())
        depts.append(d)
        subs[d] = host
    faculties.append({"name": name, "short": short, "departments": depts})
    time.sleep(0.5)

teachers = []
for d, sub in subs.items():
    time.sleep(0.5)
    for p in teachers_of(sub):
        if any(t in (p["DESIGNATION"] or "").lower() for t in TEACHING):
            teachers.append((who(p["EMPLOYEE_NAME"]), p["DESIGNATION"], d))

write("bau",
      name="Bangladesh Agricultural University",
      tagline="",
      address="Mymensingh-2202, Bangladesh",
      logo="data/logos/bau.png",
      source="https://bau.edu.bd/",
      faculties=faculties, teachers=teachers)
