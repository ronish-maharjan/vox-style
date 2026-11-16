# Asset Download Guide — Wikimedia Commons

How I downloaded assets for the India-British video (what I actually did as a CLI agent).

---

## Process to download images

Use the **MediaWiki API** 

### My workflow (what I ran in terminal)

```bash
# 1. SEARCH via API (replaces typing in website search box)
curl -sG 'https://commons.wikimedia.org/w/api.php' \
  --data-urlencode 'action=query' \
  --data-urlencode 'generator=search' \
  --data-urlencode 'gsrsearch=Battle of Plassey 1757' \
  --data-urlencode 'gsrnamespace=6' \
  --data-urlencode 'gsrlimit=10' \
  --data-urlencode 'prop=imageinfo' \
  --data-urlencode 'iiprop=url|extmetadata' \
  --data-urlencode 'format=json'

# 2. PARSE JSON → extract title, original URL, license
# (I used Python since jq wasn't installed)
curl ... | python3 -c "
import sys, json
data = json.load(sys.stdin)
for page in data.get('query', {}).get('pages', {}).values():
    info = page.get('imageinfo', [{}])[0]
    title = page.get('title', '')
    url = info.get('url', '')
    license = info.get('extmetadata', {}).get('LicenseShortName', {}).get('value', 'Unknown')
    if url and any(l in license for l in ['Public domain', 'CC0', 'CC BY', 'CC BY-SA']):
        print(f'{title}\t{url}\t{license}')
"

# 3. DOWNLOAD with curl (replaces right-click → Save As)
curl -L -o "battle-plassey-1757.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/5/57/Battle_of_Plassey%2C_1757.jpg"
```

---

## Search terms  (API `gsrsearch` parameter)

### Examples 

| Need | API search term | Why it worked |
|------|-----------------|---------------|
| EIC origins | `East India Company fleet 1601` | Specific year + "fleet" = historical engraving |
| EIC symbol | `East India Company arms` | "arms" = coat of arms |
| Battle map | `Battle of Plassey 1757` | Year + battle name = maps/paintings |
| Battle scene | `Clive meeting Mir Jafar` | Specific moment = paintings |
| Person portrait | `Robert Clive portrait Nathaniel Dance` | Artist name filters to best painting |
| Person portrait | `Warren Hastings portrait George Stubbs` | Artist name = high-quality painting |
| Rebellion art | `Sepoy Mutiny 1857` | Period term = contemporary illustrations |
| Rebellion map | `Indian Rebellion 1857 map` | "map" keyword = cartographic images |
| Artwork | `Vereshchagin Blowing from Guns` | Artist + title = specific famous painting |
| Last Mughal | `Bahadur Shah Zafar 1858` | Year = actual photograph from 1858 |
| Empress | `Queen Victoria Bassano` | Photographer = definitive portrait |
| Map (SVG) | `British Raj map 1900` | "1900" + "map" = historical SVG |
| Map | `India 1900 map Brockhaus` | Publisher = detailed historical map |
| Architecture | `Taj Mahal 1850s photograph John Murray` | Photographer + decade = early photo |

---

## Problems faced & how to solved them

| Problem | What happened | Fix |
|---------|---------------|-----|
| **`filemime:image/jpg` filter returned no results** | API search with MIME filter gave empty batchcomplete | **Removed MIME filter** — search plain text, filter license in code |
| **No `jq` installed** | `jq: command not found` | **Used Python** to parse JSON (stdlib, always available) |
| **CC BY-SA / CC BY images need attribution** | Some results were CC BY-SA 4.0, CC BY 2.0 | **Acceptable** — add attribution in video credits; only skip CC BY-NC / GODL |
| **GODL-India license (Government Open Data License)** | Nehru portrait had "GODL-India" — not in safe list | **Skipped it** — chose Public domain alternative |
| **Huge file sizes (27 MB watercolor)** | `Plassey, 1757.jpg` was 27 MB (high-res scan) | **Kept it** — draft render downscales; for final, could use thumbnail |
| **URL encoding in filenames** | URLs have `%2C` (comma), `%28` (paren) — messy filenames | **Renamed manually** in `-o "clean-name.jpg"` |
| **Redirects** | Wikimedia URLs redirect through thumbor | **Use `-L` flag** — follows redirects to final file |
| **403 Forbidden on some URLs** | Missing User-Agent | **Add `-H 'User-Agent: MyProject/1.0'`** if needed |
| **Search too broad = irrelevant results** | "India map" gave modern maps | **Add year**: "India map 1900", "British Raj map 1900" |
| **Search too narrow = no results** | "Robert Clive 1757 portrait" | **Remove year**: "Robert Clive portrait Nathaniel Dance" |
| **SVG vs PNG/JPG** | British Raj map was SVG (vector) | **Downloaded SVG** — works in script.json as asset |

---

## Exact commands I ran (copy-paste to re-download)

```bash
cd /home/ronish/Downloads/vox-studio/projects/india-british/assets

# East India Company origins
curl -L -o "eic-fleet-1601.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/8/89/East-india-company-1601_Woolwich.jpg"

curl -L -o "east-india-company-arms.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/6/6d/Arms_of_the_Honourable_the_East_India_Company.jpg"

# Battle of Plassey
curl -L -o "battle-plassey-1757.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/5/57/Battle_of_Plassey%2C_1757.jpg"

curl -L -o "clive-mirjafar.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/c/c4/Lord_Clive_meeting_with_Mir_Jafar_after_the_Battle_of_Plassey.jpg"

# Portraits
curl -L -o "robert-clive-portrait.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/6/60/Robert_Clive%2C_1st_Baron_Clive_by_Nathaniel_Dance%2C_%28later_Sir_Nathaniel_Dance-Holland%2C_Bt%29.jpg"

curl -L -o "warren-hastings-portrait.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/5/56/Portrait_of_Warren_Hastings%2C_Esq._MET_DP835548.jpg"

# 1857 Rebellion
curl -L -o "sepoy-mutiny.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/5/5f/SepoyMutiny.jpg"

curl -L -o "indian-rebellion-map.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/5/5c/Indian_Rebellion_of_1857.jpg"

curl -L -o "blowing-from-guns.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/b/be/Vereshchagin-Blowing_from_Guns_in_British_India.jpg"

# End of Mughal / British Raj
curl -L -o "bahadur-shah-zafar.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/f/f2/Bahadur_Shah_Zafar.jpg"

curl -L -o "queen-victoria.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/e/e3/Queen_Victoria_by_Bassano.jpg"

# Maps
curl -L -o "british-raj-map.svg" \
  "https://upload.wikimedia.org/wikipedia/commons/8/86/The_British_Raj_circa_1900_%28orthographic_projection%29.svg"

curl -L -o "india-1900-map.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/b/b0/India_1900.jpg"

# Taj Mahal (early photography)
curl -L -o "taj-mahal-1850s.jpg" \
  "https://upload.wikimedia.org/wikipedia/commons/6/62/-The_Taj_Mahal_from_the_Banks_of_the_Yamuna_River-_MET_DP143011.jpg"
```

---

## Flags

- `-L` — follow redirects (required for Wikimedia URLs)
- `-o` — output filename (you choose)

---

## Verify

```bash
ls -la *.jpg *.svg *.png
file *.jpg  # should say "JPEG image data"
```
