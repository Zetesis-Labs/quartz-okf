# Tasks: Materialized catalog pages

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md)

## Phase 1: Extraction and binding

- [x] T001 [US1] Add failing catalog tests for `page=`, blank cells and multiple targets.
- [x] T002 [US1] Extract the optional page target and row position in `core/lib/catalog.ts`.
- [x] T003 [US3] Add failing corpus tests for unresolved, duplicate, self and type-conflicting bindings.
- [x] T004 [US3] Build the pure materialization index and report it from both validation paths.

## Phase 2: One symbolic identity

- [x] T005 [US2] Add failing resolver tests for page slug, short name and aliases mapping to the row.
- [x] T006 [US2] Add failing graph tests for node suppression, merged metadata and remapped edges.
- [x] T007 [US2] Implement resolver and graph coalescence without changing non-materialized rows.
- [x] T008 [US2] Add failing annotation tests and remap annotations authored by the page.

## Phase 3: Rendering and federation

- [x] T009 [US1] Add a failing panel browser-script regression for lookup by node URL.
- [x] T010 [US1] Make a materialized page show the row node's neighbourhood panel.
- [x] T011 [US1] Add a failing federation regression for a row URL that differs from its slug.
- [x] T012 [US1] Preserve relative page URLs while mounting and previewing child graphs.

## Phase 4: Vertical proof and documentation

- [x] T013 [US1] Extend the harness fixture and expected graph with one materialized page.
- [x] T014 [US1] Document `page`, diagnostics and the additive row marker in the plugin README.
- [x] T015 [US1] Materialize HERM AP012 in Singular Solving with a real detail page.
- [x] T016 Run `npm test`, typecheck, the fixture smoke build and the full Singular build/checker.
