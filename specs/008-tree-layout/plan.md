# Implementation Plan: Tree layout for hierarchical modes

**Branch**: `008-tree-layout` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

Add an optional `tree` to `ExplorerMode`; compute the hierarchy and a radial placement in
a pure module of the explorer; let the engine pin (radial) or ring (rings) the hierarchy
nodes and seed the rest at the centroid of what they touch; warn on every degradation.
Prove it on the fixture and on Singular Solving's taxonomy.

## Technical Context

**Language/Version**: TypeScript, erasable syntax on Node 22.18+
**Primary Dependencies**: d3-force (already in the engine); none in `lib/`
**Storage**: none
**Testing**: `npm test` for `lib/tree.ts`; `npm run typecheck` for the engine; browser
audit and screenshots on a consumer build
**Target Platform**: the in-page explorer of Quartz sites
**Project Type**: toolkit plugin
**Constraints**: no vocabulary in the engine, no numbers for the consumer to tune,
every node stays on screen
**Scale/Scope**: hundreds of nodes per mode (424 in the first consumer)

## Constitution Check

| Gate | Design response |
|---|---|
| I. Git/source and bundle contract | Nothing authored changes; the graph document is untouched. |
| II. Functional core | Hierarchy and placement are pure (`lib/tree.ts`); the engine applies them. |
| III. Tests first | `test/tree.test.ts` fails before `lib/tree.ts` exists. |
| IV. No vocabulary | The edge comes from the mode; the engine names no label. |
| V. No silent failures | Every degradation warns naming mode and edge. |
| VI. Comments | Only the orientation rule and the pin-restore quirk get a line. |
| VII. Additive schema | `ExplorerMode.tree` is optional; graph schema unchanged. |

## Project Structure

```text
core/lib/types.ts                              ExplorerMode.tree, TreeOptions
plugins/quartz-okf-explorer/lib/tree.ts        hierarchyOf, radialLayout, treeOf, centroidOf
plugins/quartz-okf-explorer/test/tree.test.ts  the failing tests first
plugins/quartz-okf-explorer/src/hud/canvas/engine.ts   pins, rings, seeding, warnings
plugins/quartz-okf-explorer/README.md          Shape → tree
CLAUDE.md                                      the pin and its degradation paths
harness/fixture/okf.config.mjs                 a tree mode in the smoke build
specs/008-tree-layout/
```

**Structure Decision**: the layout is renderer-specific, so it lives in the explorer's
`lib/`, not in `core/`; only the option's type is in the contract.

## Complexity Tracking

No constitution exceptions.
