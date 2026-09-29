# API

`layout(input, timeoutMs?)`, `validateInput(input)`, `validateScene(scene, originalInput?)`, `svg(scene)`, and `pdf(scene)` all return a discriminated `Result<T>` (PDF is async). Success is `{ok:true,value,report}`; failure is `{ok:false,error,report}`. CLI failures are nonzero exits.

`layout` validates semantic input, shapes bounded text, runs deterministic ELK Layered candidates, and validates the resolved scene. `timeoutMs` must be a finite positive number; AUTO page fitting uses one total deadline across its at-most-24 deterministic candidate/direction attempts and terminates the worker on timeout, error, or unexpected exit.

`validateScene(scene)` checks all resolved geometry and revalidates `scene.source`. Pass the originally supplied semantic JSON as `originalInput` when validating a received layout artifact; this detects a jointly edited `source` and geometry. Renderers always validate the scene but cannot infer a prior semantic input that was not provided.

## Input and output contract

Version 1 accepts the fields in [`schema/diagram-v1.json`](../schema/diagram-v1.json). Unknown fields and unsupported typography options are rejected. The runtime enforces the same contract, including safe hex palette colors, finite dimensions, text/row/graph limits, sides, styles, and all nested objects.

`Scene` retains natural point coordinates in `canvas`, nodes, ports, routes, labels, arrowheads, and declared continuations. For a page-constrained input, `print.transform` is:

```ts
{width, height, translateX: margin, translateY: margin, scale: fitScale}
```

SVG sets its physical width/viewBox to `width`/`height` and wraps natural drawing once in that transform. PDF uses the same physical page and one graphics transform. Hosts that consume a resolved print scene must do the same; do not mutate natural geometry.

`effectiveBodyFontSize` and `effectiveLabelFontSize` derive from the painted 10 pt text. `effectiveMinStrokeWidth` derives from meaningful painted edge/continuation/node-border/label-tether strokes; decorative label-box hairlines are excluded. Fit failure is `NO_VALID_LAYOUT` / `print-fit`, with the restrictive minimum required page.

## Render modes

Ordinary SVG/PDF paints measured glyph outlines. Rich (`theme.visual`) SVG uses outlines while its PDF embeds the packaged IBM Plex Sans font; visual rows, pills, bridges, and label cards are supported only in rich mode. This difference is intentional: neither mode promises universal text selectability or browser/PDF typography identity.

The checker tests finite geometry properties—attachment, nonzero orthogonal paths, declared continuation behavior, labels/tethers, arrows, and bounded no-overlap rules. It does not prove global optimality or universal readability.
