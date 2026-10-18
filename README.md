# app-catalog

The landing page for [tools.url2.at](https://tools.url2.at/): one directory for every app on url2.at
(Leetcode Notes, url2.at, Word of the Day and Cursor Usage Tracker), with a working demo of each one on the page.

Two designs live on their own branches:

| Branch | Design |
| --- | --- |
| `neobrutalism` | Bold neobrutalist page: thick borders, hard shadows, one colour band per tool. |
| `studio` | Calm, product-focused page with the real product screens, an animated logo background and a design-options panel. |

Both are plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or serve the folder
with any static server, for example:

```sh
npx serve .
```
