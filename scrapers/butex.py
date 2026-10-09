# /// script
# dependencies = ["beautifulsoup4"]
# ///
"""Bangladesh University of Textiles. Run: uv run scrapers/butex.py"""
import re
import time

from common import clean, soup, write

BASE = "https://www.butex.edu.bd"
SHORT = {"Textile Engineering": "FTE", "Textile Management & Business Studies": "FTMBS",
         "Textile Chemical Engineering": "FTCE", "Fashion Design & Apparel Engineering": "FFDAE",
         "Science & Engineering": "FSE"}

faculties, links = [], {}
menu = soup(BASE + "/").select_one("li.menu-item-has-children > a[href*='page_id=6552']").find_parent("ul")
for a in menu.select("a[href]"):  # flat walk: the menu's <li> nesting is unreliable
    n = clean(a.get_text())
    if n.startswith("Faculty of "):
        faculties.append({"name": n, "short": SHORT[n.removeprefix("Faculty of ")], "departments": []})
    elif n.startswith("Department of ") and faculties:
        faculties[-1]["departments"].append(n)
        links[n] = a["href"]

teachers = []
for d, url in links.items():
    time.sleep(0.5)
    for card in soup(url).select("#team-members-1 .team-member-article"):
        rank = re.sub(r"\s*\(.*", "", clean(card.select_one(".team-member-i").get_text()))
        if any(t in rank.lower() for t in ("professor", "lecturer")):  # skips the Vice Chancellor line
            teachers.append((re.sub(r"\s*\(.*", "", card.select_one(".member-b").get_text()), rank, d))

write("butex",
      name="Bangladesh University of Textiles",
      tagline="Knowledge Is Power",
      address="Tejgaon I/A, Dhaka-1208, Bangladesh",
      logo="data/logos/butex.png",
      source=f"{BASE}/",
      faculties=faculties, teachers=teachers)
