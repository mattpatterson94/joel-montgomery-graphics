# Stretch & Repeat converter checks

The site is static and has no build step or production dependencies. Open
`tools/stretch-repeat/index.html` through a local HTTP server. All conversion happens locally.

For browser regression tests, install Playwright in a temporary directory:

```sh
npm install --prefix /tmp/stretchrepeat-tests playwright pngjs
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
1 output SVG unit, after normalization. Uploads with either viewBox dimension
above 240 are uniformly scaled to fit 240 × 240; smaller uploads are not enlarged.
Geometry, transforms, strokes and user-space definitions are rescaled, while
percentages and objectBoundingBox fractions retain their relative meaning.
The measurements, preview slider and advanced settings use original SVG units;
manual values are converted to output units without another overlap subtraction.
For example, a 720-wide source uses scale 1/3: a detected 240-wide centre defaults
to a displayed tile width of 237 (79 in the output), and a manual cutoff of 210
becomes 70 in the output.

Run `node tests/stretchrepeat-normalize.test.cjs` with the same server and
Playwright setup. It checks large wide/tall inputs, unchanged small inputs,
baked polygon/path geometry, gradients, patterns, filters, clips, masks,
transformed primitives, nested viewports and uses, pixel parity with source
artwork, and original-unit advanced settings including apply/reset.


## Stretch & Repeat resource IDs

Each conversion generates a random 128-bit namespace for the interior filter and
source artwork IDs (patterns, gradients, clips, masks, paths and groups). Local
`url(...)`, `href`, `xlink:href` and accessibility references are updated together.
The namespace stays stable while changing settings, previewing and downloading;
converting the same source again generates a new namespace.

Keep the tested `PATTERN`, `REPEAT_X`, `L` and `R` import markers. The supplied
app DOM shows the repeat handler renaming PATTERN when expanding it, whereas
filter IDs remain untouched. Changing the pattern naming convention previously
broke repetition, so this fix targets the confirmed shared-filter collision
without changing those app markers.

Run `node tests/stretchrepeat-ids.test.cjs` using the same server/browser setup
and with `pngjs` installed alongside Playwright. It checks references, namespaces,
source patterns also named PATTERN, stable rebuilds, and two inline elements with
different cutoffs. A control with the old shared filter ID reproduces the wrong
cutoff; unique filter IDs preserve each element's intended bounds.

This prevents collisions between separately converted files. Reusing a single
export still reuses its IDs; the host app must namespace resources per placed
instance to guarantee isolation for copies of the same asset.

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

## Hidden basketball game

Run `node tests/basketball.test.cjs` with the same HTTP server and Playwright
setup. The unlisted page is `/basketball/`.

Mouse and touch share a drag-and-release throw. Direction, drag distance and a
small contribution from recent release velocity determine the shot. There is no
pointer power meter or hold-to-charge timer. The ball follows the hand within the
return area; a short, fading arc uses the same launch state and gravity. Each
new ball returns to a different rack position. Keyboard controls remain under
the expandable help section. Best scores use localStorage with an in-memory
fallback; sound starts off.

The supplied backboard reference is cropped at runtime without redrawing it.
Ball rendering uses a textured sphere with three-axis rotation, curved tricolour
panels and surface grain. Distant/mobile balls use smaller cached sprites.
Net cords have fixed rim anchors and deform as the ball passes; a swish stretches
the collar downward, while rim/offset entries add restrained lateral movement.
Reduced-motion preferences disable the extra net reaction and score-label travel.

Sound effects are generated locally with Web Audio, not downloaded recordings:
filtered noise for net friction/swish, short resonances for metal rim and hollow
backboard contacts, and a rubber impact for floor bounces. Volume follows impact
strength; left/right positioning follows the ball. Basket scoring has no beep.

Tests cover slow/fast mouse throws, real high-DPI mobile touch, sample-rate
independence, release continuity, shifted rack positions, misses, cancellation,
preview/physics consistency, net settling, multi-axis spin, keyboard fallback,
scoring/multipliers and saved statistics. Physics checks run at 30/60/144 fps.
Offline audio renders verify each material effect is non-silent and unclipped.
Desktop drag, net-entry and mobile screenshots support visual review.

The court is 800 × 960 logical units, with a longer ball return. Ball radius is
52 units; the rendered rim radius is 64 units, with the physics ring scaled to
match. Shots reach hoop depth in roughly 0.9 seconds. Favicon PNGs at 32 and
192 pixels extract the Copirite wordmark and pink ball from the supplied image.
Bounce audio adds irregular broadband contact noise and compressed rubber-body
resonance rather than relying on a clean sliding tone.



## Size limits across converters

Shape Mask, Repeating Shape and Stretchable Shape exports now use the same
maximum artboard size as Stretch & Repeat: uniformly fit within 240 × 240,
without enlarging smaller sources. Paths, primitives, strokes, transforms,
viewBoxes, patterns and user-space definitions are scaled. Relative dimensions
remain relative. Mask image bounds are measured after normalization, and
stretchable artwork is normalized before cutting it into equal thirds.

The shared SVG normalizer is `tools/shared/normalize-svg.js`. The earlier
`tools/stretch-repeat/normalize-svg.js` is retained for cached older pages.
The stretchable converter scales its Paper.js geometry directly.

Run `node tests/converter-sizing.test.cjs` with the same local server and
Playwright setup. Checks cover large wide/tall sources, unchanged smaller
sources, rendering parity, mask image bounds, PNG bottom-edge coverage,
repeat tile sizes and all three stretchable slicing modes.
