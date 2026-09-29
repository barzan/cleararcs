# Usage

Create semantic v1 JSON, render it into a fresh directory, and keep the input with the output bundle.

```sh
cleararcs render diagram.json --out artifacts/study-figure
cleararcs check diagram.json artifacts/study-figure/layout.json
```

The renderer rejects unknown fields, unsafe color values, unsupported text, oversized input, invalid geometry, and infeasible page constraints. It never overwrites an existing output directory; files are written to an adjacent staging directory and committed by rename only after all four bundle files are ready.

For a physical page, specify `layoutGoal: "fit-page"` and `page`. `AUTO` evaluates a deterministic bounded set of LR/TB candidates within one deadline. If the requested body text, labels, or meaningful strokes would be too small, the result reports `NO_VALID_LAYOUT` with `print-fit` rather than shrinking the artifact again.

Use declared continuations when a flow must pass through a node. A compact reference node is explicit reference metadata; it is not automatic pagination. Hosts that use resolved geometry should call `validateScene(scene, originalInput)` and preserve the recorded page transform.
