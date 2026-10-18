# app-catalog · neobrutalism

The neobrutalist version of the [tools.url2.at](https://tools.url2.at/) landing page, inspired by
[neobrutalism.dev](https://www.neobrutalism.dev/). Plain HTML, CSS and JavaScript, no build step.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: hero, product directory with filters, four live demos, public APIs, footer. |
| `styles.css` | Design tokens (light and dark), per-tool accent colours, every component. |
| `app.js` | Theme toggle, filters and the four demos. |
| `img/` | Product logos. |

## The demos

- **Word of the Day** loads live words from `https://words.url2.at/api/words`, with sample words as a fallback.
- **url2.at** makes real short links through `https://url2.at/api/tinyurl`. If the API can't be reached it shows a clearly
  labelled preview code instead.
- **Cursor Usage Tracker** shows the extension popup driven by a spend slider. The numbers are examples.
- **Leetcode Notes** shows the extension sidebar and the review flow with example notes.

## Things to update

- Chrome Web Store user counts are fixed numbers in `index.html` (`data-users="…"` on each product card).
  The hero total is added up from them.

## Run it

Open `index.html`, or serve the folder:

```sh
npx serve .
```
