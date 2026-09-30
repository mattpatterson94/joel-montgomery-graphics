# Stretch & Repeat converter checks

The site is static and has no build step or production dependencies. Open
`tools/stretch-repeat/index.html` through a local HTTP server. All conversion happens locally.

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

The working-repeat.svg fixture is the asset confirmed to repeat in the design app.
Regression checks require one defs, a PATTERN tile first in that defs, direct
normalised polygon coordinates, and matching filter/geometry against that fixture.
The browser preview alone cannot verify that the external app recognises an asset.

Path translations use the vendored svgpath 2.6.0 browser bundle (MIT); see
`tools/stretch-repeat/vendor/svgpath.LICENSE`. No CDN or package installation is needed by site users.

Detected repeat tile widths now default to the measured centre width minus exactly
1 SVG unit. End cutoffs, centre artwork and height remain unchanged. Manual tile
width edits are used as entered; the subtraction is not applied a second time.


## Shape Mask selection

Start a local HTTP server on port 8765, then run `node tests/shape-mask.test.cjs`
with Playwright available through `NODE_PATH`. Set `CHROMIUM_PATH` if needed.

The five supplied SVGs under `fixtures/shape-mask/` are known-working output
references. Tests reconstruct plain artwork from their clipping shapes and
verify the new converter's independent image wrappers, geometry and preservation
of solid artwork. Additional checks cover compound-path holes, transformed
shapes, preview/list/keyboard selection, automatic single-shape downloads,
mobile layout and rejected input. The old monitor reference has swapped image
dimensions; the test intentionally expects the actual clipping bounds instead.

These checks do not replace importing generated files into the design app.

Thumbnail coverage: run `node tests/shape-mask-thumbnail.test.cjs` with the same server/browser setup. Checks cover the shared grid across transformed masks, non-zero viewBox origins, 240px output, transparent wide/tall padding, compound holes, solid artwork, unchanged SVG placeholders and paired downloads in both modes.


## Stretchable Shape Creator

Run `node tests/stretchable.test.cjs` with the same HTTP server and Playwright
setup. Tests check horizontal, vertical and nine-slice output; actual path bounds
inside equal thirds; rendering against the original demo and a multicolour shape;
compound holes and empty centre sections; transformed groups and opacity;
download/preview separation; direction controls; mobile layout; and rejected
unsupported inputs.

The creator vendors Paper.js 0.12.18 (MIT) for curve intersections, with its
license in `tools/stretchable/vendor/`. Output contains real paths, not clipping
wrappers. Filled paths and basic vector shapes are supported. Designers must
outline strokes/text and flatten gradients, linked content and live effects.
Empty cells retain an empty named group, useful for hollow frames. Preview resizing
simulates fixed thirds and stretching centre/edges; test all directions, especially
empty sections, in the target design app before relying on its importer behaviour.
