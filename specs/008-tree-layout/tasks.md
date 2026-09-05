# Tasks: Tree layout for hierarchical modes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md)

## Phase 1: Contract and pure module

- [x] T001 [US1] Add `TreeOptions` and `ExplorerMode.tree` to `core/lib/types.ts`.
- [x] T002 [US1] Write the failing tests in `plugins/quartz-okf-explorer/test/tree.test.ts`: orientation, roots, depth, sibling order, placement invariants, determinism, centroid.
- [x] T003 [US3] Add the failing degradation tests: shared parents, cycle, absent label, single node, several roots.
- [x] T004 [US1] Implement `treeOf`, `hierarchyOf`, `radialLayout`, `centroidOf` in `plugins/quartz-okf-explorer/lib/tree.ts`.

## Phase 2: Engine

- [x] T005 [US1] Compute the hierarchy before the simulation in `engine.ts`; pin placed nodes; seed loose nodes at the centroid of placed neighbours.
- [x] T006 [US1] Restore the pin on drag end; shift pins on resize.
- [x] T007 [US2] `layout: "rings"`: radial force by depth ring, taking precedence over the type ring.
- [x] T008 [US3] One warning per degradation, naming mode and edge.

## Phase 3: Proof and documentation

- [x] T009 [US1] Declare a tree mode in `harness/fixture/okf.config.mjs`.
- [x] T010 [US1] Document `tree` in `plugins/quartz-okf-explorer/README.md` and the pin in `CLAUDE.md`.
- [x] T011 [US1] Build Singular Solving with the candidate toolkit, declare `tree` on its hierarchical modes, run the HUD audit and read screenshots of the taxonomy, coverage and mentions modes.
- [x] T012 Run `npm test` and `npm run typecheck`; build the fixture.

## Found on the way

- [x] T013 [US1] Frame a selection around the node, not around its neighbours' box (`aroundNode`, test in `test/viewport.test.ts`).
- [x] T014 [US1] Frame after the selection card renders, so the node is centred in the hole the islands leave on a phone.
