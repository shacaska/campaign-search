# Campaign Update Search

Search the full text of every update in a **Kickstarter** or **Gamefound** campaign. Find the one update that mentioned the *eidolons* without scrolling through 120 of them.

**Site & install instructions:** https://shacaska.github.io/campaign-search/

## How it works

It's a bookmarklet (or userscript). Open a campaign page, tap it, and a search panel slides in:

- It reads every update using the campaign site's own data, from your browser and with your login. Backer-only updates are included if you're a backer.
- Search is case- and accent-insensitive, supports `"exact phrases"` and `-exclusions`, ranks by number of mentions, and highlights every hit. You can expand any update to read it in full.
- Results are cached in your browser, so it opens instantly next time and only fetches new updates.
- **Save .json** exports the updates, and the site can open that file for offline searching.

On Android you can also **install the site as an app**. It then appears in the Share menu, so sharing a campaign from the Kickstarter or Gamefound app opens it in your browser, ready to search, instead of fighting the app.

There's no server. Kickstarter and Gamefound block automated server-side downloads behind "verify you are human" checks, so the tool runs as you, on pages you've opened.

## Files

| Path | What |
|---|---|
| `index.html`, `assets/app.js`, `assets/style.css` | The GitHub Pages site (install guide + saved-file viewer) |
| `assets/overlay.js` | The in-page search panel |
| `assets/kickstarter-core.js` | Fetches posts via Kickstarter's `/graph` GraphQL endpoint |
| `assets/gamefound-core.js` | Fetches Gamefound's update list API + each update's embedded content |
| `assets/search.js`, `assets/text.js`, `assets/campaign-url.js` | Shared search, HTML→text and URL parsing |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable app + Android Share-menu target |
| `assets/bookmarklet.txt`, `assets/bookmarklet-full.txt`, `assets/panel.js`, `campaign-search.user.js` | **Built** outputs; don't edit by hand |

## Developing

```sh
npm install
npm run build   # regenerates assets/bookmarklet.txt and campaign-search.user.js
python3 -m http.server   # then open http://localhost:8000
```

Not affiliated with Kickstarter or Gamefound. Update text belongs to each campaign's creator.
