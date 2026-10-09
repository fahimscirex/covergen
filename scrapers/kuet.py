# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Khulna University of Engineering & Technology. Run: uv run scrapers/kuet.py

Institutes (IICT, IDM, IEPT) have no teachers of their own, so only the
faculties and their departments are covered.
"""
import re
import time

from common import clean, soup, write

BASE = "https://kuet.ac.bd"

page = soup(f"{BASE}/program/faculties")
names = {a["href"].strip("/"): clean(a.get_text()) for a in page.select("a")
         if clean(a.get_text()).startswith("Faculty of ") and a["href"].startswith("/d")}
faculties, slugs = [], {}
for a in page.select("a"):
    text, href = clean(a.get_text()), a.get("href", "")
    if text == "Office of the Dean":  # starts each faculty's block in the menu
        name = names[href.rsplit("/", 1)[1]]
        faculties.append({"name": name, "short": "F" + "".join(w[0] for w in name.split()[2:] if w[0].isupper()),
                          "departments": []})
    elif text.startswith("Department of ") and href.startswith(BASE) and faculties and text not in slugs:
        faculties[-1]["departments"].append(text)
        slugs[text] = href

teachers = []
for dept, url in slugs.items():
    for card in soup(url + "/faculty").select(".card-action"):
        teachers.append((re.sub(r"\b(Prof|Engr|Mr|Mrs|Ms)\.\s*", "", clean(card.select_one(".title").get_text())), card.select_one("span").get_text(), dept))
    time.sleep(0.5)

write("kuet",
      name="Khulna University of Engineering & Technology",
      tagline="Lord, Give Me Knowledge",
      address="Khulna-9203, Bangladesh",
      logo="data/logos/kuet.png",
      source=f"{BASE}/program/faculties",
      faculties=faculties, teachers=teachers)
