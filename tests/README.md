# Stretch & Repeat converter checks

The site is static and has no build step or production dependencies. Open
`stretchrepeat.html` through a local HTTP server. All conversion happens locally.

For browser regression tests, install Playwright in a temporary directory:

```sh
npm install --prefix /tmp/stretchrepeat-tests playwright
/tmp/stretchrepeat-tests/node_modules/.bin/playwright install chromium
python3 -m http.server 8765
```

In another terminal, from the repository root:

```sh
NODE_PATH=/tmp/stretchrepeat-tests/node_modules node tests/stretchrepeat.test.cjs
```

Optionally set `CHROMIUM_PATH` to an existing Chromium executable.

Checks cover the source fixture, exact filter cutoffs across whole-tile boundaries,
Illustrator class colours, non-zero viewBox origins, a 120-unit tile, invalid SVG,
missing/duplicate groups, active/external content rejection, upload, settings,
download naming, preview-only diagnostic colours and mobile overflow.

## Supported source convention

Export horizontal vector artwork as three top-level groups named L, C and R.
Keep the centre artwork's bounds equal to one intended repeat tile, and include
any desired overlap in the endcap artwork. The SVG needs a valid viewBox.
The converter retains internal definitions and freezes presentation styles.
Outline text and expand rotated/skewed section transforms before conversion.
External resources and active SVG content are rejected. Geometry bounds exclude
stroke expansion; outline strokes when they define the intended tile boundary.

The resize preview reproduces the app's whole-tile `<use>` expansion. Its width
and colours are not exported. The download retains a pattern-based REPEAT_X
structure and the tested outer viewport filter. Final app import still needs a
smoke test, especially for artwork containing gradients, masks or nested uses.
