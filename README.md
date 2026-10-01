# Joel Montgomery Graphics

Static HTML, CSS and JavaScript for [joelmontgomery.graphics](https://joelmontgomery.graphics/): design utilities, small games and experiments. The site has no build step or server-side application.

## Design utilities

Start at [Design Utilities](https://joelmontgomery.graphics/tools/).

| Utility | Location | Purpose |
| --- | --- | --- |
| Shape Mask Converter | `tools/shape-mask/` | Turn vector shapes into image masks. Advanced Mode lets you select independent masks while retaining other artwork. Downloads include a PNG thumbnail. |
| Stretch & Repeat Converter | `tools/stretch-repeat/` | Convert an SVG with top-level `L`, `C` and `R` groups into a repeating middle with fixed endcaps. |
| Repeating Shape Converter | `tools/repeat/` | Put an SVG's artwork into a horizontally repeating element, preserving its groups and local definitions. |
| Stretchable Shape Converter | `tools/stretchable/` | Cut filled artwork into equal thirds for horizontal, vertical or nine-slice stretching. |

SVG conversion runs in the browser. Inputs need a valid `viewBox`; supported artwork and export requirements are described on each utility page. Generated SVGs follow the design app's special element conventions, so check final imports and resizing in that app as well as the browser preview.

## Other pages

- `/` — the original homepage.
- `/joeldle/` — Joeldle.
- `/calculator/` — Joelculator.
- `/basketball/` — the basketball game. Its link appears at the bottom of `/tools/` after ten seconds, expanding the card and fading/sliding into view. It spans both columns on desktop; reduced-motion settings skip the animation.
- `/quickLookDemo/` — Quick Look / 3D experiments.

The legacy `/shapemask.html` and `/stretchrepeat.html` URLs redirect to their utility folders.

## Preview locally

From the repository root, run:

```sh
python3 -m http.server 8765
```

Open [http://localhost:8765/tools/](http://localhost:8765/tools/), or visit the root for the main homepage. Stop the server with **Ctrl+C**. A local HTTP server is preferable to opening HTML files directly because some pages fetch local assets.

Site visitors do not need Node.js or npm. The converters' SVG geometry libraries are vendored in their utility folders, with accompanying license files. Some pages also load external fonts or legacy scripts.

## Files to edit

- `tools/index.html` — utility links and the timed basketball reveal.
- `tools/styles.css` — responsive tools-menu layout.
- `tools/assets/icons/` — transparent PNG icons extracted from the supplied menu mockup.
- Each utility's `index.html`, `styles.css` and `script.js` — its UI and conversion behaviour.
- `basketball/` — game code, artwork and audio.
- `tests/` — browser regression tests and SVG fixtures; see [tests/README.md](tests/README.md).

When adding a utility, link to its folder from the tools menu and include an **All utilities** link on its page. Use a new version query on changed script/style URLs when needed to avoid older cached assets.

## Tests

The browser tests need Node.js, Playwright and Chromium. One way to install test dependencies outside the repository is:

```sh
npm install --prefix /tmp/design-utilities-tests playwright pngjs
/tmp/design-utilities-tests/node_modules/.bin/playwright install chromium
```

Keep the local server running, then use another terminal:

```sh
NODE_PATH=/tmp/design-utilities-tests/node_modules node tests/tools-page.test.cjs
NODE_PATH=/tmp/design-utilities-tests/node_modules node tests/shape-mask.test.cjs
```

Set `CHROMIUM_PATH` to use an existing Chromium executable. See [tests/README.md](tests/README.md) for the remaining converter and game checks. Browser tests do not replace importing exported elements into the design app.

## Hosting

Serve the repository as static files. Folder `index.html` pages provide URLs such as `/tools/shape-mask/` without an `.html` suffix.

`CNAME` records the custom domain for GitHub Pages. `wrangler.jsonc` also contains a Cloudflare static-assets configuration pointing at the repository root. Hosting credentials, domain settings and deployment connections are managed outside this repository. Pull requests keep changes reviewable before they are merged and published by the configured host.
