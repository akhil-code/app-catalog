# app-catalog · studio

The calm, product-focused version of the [tools.url2.at](https://tools.url2.at/) landing page.
Plain HTML, CSS and JavaScript; it opens straight from `index.html`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: hero, live demo stage, product directory, public APIs, about, footer. |
| `styles.css` | Design tokens (light and dark) and every component, including each product's real card styles. |
| `app.js` | Theme toggle, demo stage, filters, the responsive hero, the logo background and the demos. |
| `notes-demo.js`, `notes-demo.css` | The real Leetcode Notes screens (extension sidebar and web app), bundled from the Next app. |
| `scripts/build-notes-demo.mjs` | Rebuilds the two `notes-demo` files from the Next app. |
| `img/` | Product logos. |

## What's on the page

- **Live demo stage**: one tab per product, each showing that product's real interface.
  - Leetcode Notes: the "How it works" screens from leetcodenotes.com (extension sidebar and web app), fully clickable.
  - url2.at: the shorten card from the url2.at home page. It makes real short links through `https://url2.at/api/tinyurl`.
  - Word of the Day: the word card from words.url2.at, fed by `https://words.url2.at/api/words`.
  - Cursor Usage Tracker: the popup card from cursorusage.url2.at, driven by a spend slider (example numbers).
- **Responsive hero**: shows Real screens when the window has enough width and height to display them at full size;
  otherwise it switches to Mosaic. Resizing the window updates the view automatically.
- **Background**: drifting logo marks with a spotlight that follows the pointer or wanders when idle.
  Reduced-motion preferences keep the background still.

## Rebuilding the Leetcode Notes screens

`notes-demo.js` is generated from `src/app/notes/landing/templates/final` in the Next app, so the page always matches
leetcodenotes.com. After changing those screens, run this from the app-catalog folder (it uses the Next app's
`node_modules`):

```sh
node scripts/build-notes-demo.mjs                 # Next app at ../next-app
NEXT_APP_DIR=/path/to/next-app node scripts/build-notes-demo.mjs
```

## Things to update

- Chrome Web Store user counts are fixed numbers in `index.html` (`data-users="…"` on each directory row).
  The total in the directory summary is added up from them.

## Run it

Open `index.html`, or serve the folder:

```sh
npx serve .
```
