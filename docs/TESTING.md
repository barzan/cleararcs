# Testing

Run `npm run check` for TypeScript and all discovered assertion-bearing tests. Run `npm run verify:release` for the release gate: tests and frozen corpora, deliberate artifact corruption checks, `npm pack`, and a tarball-only consumer that exercises the public API, CLI, packaged font/worker assets, and all four examples.

The frozen ordinary corpus retains its 95/100 success threshold. The acceptance corpus retains 50 DAG, 25 feedback, and 25 fan graphs. Neither gate contacts a runtime network service.
