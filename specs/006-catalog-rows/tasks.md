# Tasks: Catalog rows as nodes

**Input**: `spec.md`, `plan.md`, `data-model.md`, `research.md`
**Tests**: mandatory — Constitution III overrides the template's optional clause. Every
phase opens with tests written and observed failing.

## Phase 1: Foundational (blocking)

- [X] T001 `core/test/anchor.test.ts` — pin `anchorSlug` against the verified
      `github-slugger` outputs (`AC001`, `BC002 Curriculum Planning`,
      `Área de Learning (L2)`, `AP-01_x`, `**AC001**`, punctuation-only → `""`).
- [X] T002 `core/lib/anchor.ts` — implement it.
- [X] T003 [P] `core/test/topology.test.ts` — characterize `WIKILINK_RE` and
      `convertWikilinks` on fragment-bearing links before changing them.
- [X] T004 `core/lib/topology.ts` — capture the fragment; keep it through
      `parseTopologyEdges` and `convertWikilinks`; update `markdownLinkTarget`.
- [X] T005 `core/lib/types.ts` — `CatalogRow`, `CatalogAnnotation`, `CatalogProblem`,
      `RowMarker`; `GraphNode.label`, `GraphNode.row`, `GraphStats.rows`;
      `ValidatedDocument.rows`/`.annotations`; `Frontmatter.okf_rows`.

## Phase 2: US1 — one node per row (P1) 🎯 MVP

- [X] T006 `core/test/catalog.test.ts` — marker grammar (bare and quoted values,
      clauses), table discovery (fences ignored, blank lines allowed, position among all
      tables), cell text and targets, row construction, and every `catalog/*` problem.
- [X] T007 `core/lib/catalog.ts` — implement `parseMarker`, `findCatalogs`, `cellText`,
      `cellTargets`, `catalogsOf`.
- [X] T008 `core/test/rules.test.ts` — catalog problems become violations at the profile's
      levels; `type` and edge labels reuse the profile rules; the document carries rows.
- [X] T009 `core/lib/rules.ts` — wire `catalogsOf` into `validateDocument`.
- [X] T010 `core/test/resolver.test.ts` — row slugs, aliases, `note#ID` targets,
      collisions.
- [X] T011 `core/lib/resolver.ts` — register rows and aliases; resolve fragments.
- [X] T012 `core/test/graph.test.ts` — row nodes with their fields, containment edges and
      derived inverses, `stats.rows`; existing assertions unchanged.
- [X] T013 `core/lib/graph.ts` — emit row nodes and their edges.
- [X] T014 `core/lib/index.ts` — export the new pure functions.

**Checkpoint**: a catalog note produces row nodes in bundle and site.

## Phase 3: US2 — anchors and the reading dock (P1)

- [X] T015 `plugins/quartz-okf/test/anchors.test.ts` — the html phase over a hast
      fixture: ids and `data-okf-node` written, table marked, header mismatch warns and
      writes nothing.
- [X] T016 `plugins/quartz-okf/src/index.ts` — `htmlPlugins()` and the `:target` style.
- [X] T017 [P] `plugins/quartz-okf-explorer/test/note-cut.test.ts` — cut to a row
      (`<thead>` + `<tr>`), to a heading section, and the unmatched fallback.
- [X] T018 `plugins/quartz-okf-explorer/lib/note-cut.ts` — implement `cutFragment`.
- [X] T019 `plugins/quartz-okf-explorer/src/hud/controller.ts` — fetch and cache by path;
      cut by fragment; warn on fallback.

**Checkpoint**: a row node opens as its row, and its URL lands on it.

## Phase 4: US3 — relations from tables (P2)

- [X] T020 `core/test/catalog.test.ts` — clauses applied to every row, `edge=none`,
      columns named after edge labels, unresolved targets.
- [X] T021 `core/lib/catalog.ts` + `core/lib/graph.ts` — clause and column edges.

## Phase 5: US4 — annotations (P2)

- [X] T022 `core/test/catalog.test.ts` + `core/test/graph.test.ts` — `ref` tables merge
      properties and add the note's edge; missing `edge`, unresolved ref and property
      conflict are reported.
- [X] T023 `core/lib/catalog.ts` + `core/lib/graph.ts` — annotations, ordered after
      creation.

## Phase 6: US5 — finding and reading (P3)

- [X] T024 [P] `plugins/quartz-okf-explorer/test/{model,focus,search}.test.ts` — aliases
      and `row` reach the HUD model and match in focus and search.
- [X] T025 `plugins/quartz-okf-explorer/lib/{types,model,focus,search}.ts` — implement.
- [X] T026 `plugins/quartz-okf-panels/src/components/scripts/blast-radius.inline.ts` —
      fold groups over eight.

## Phase 7: Regression net and contract

- [X] T027 `harness/fixture/content/standards/arm.md` and `analysis/gap.md` — a catalog
      note (two tables, a clause, a column edge) and an annotation note.
- [X] T028 `harness/fixture/expected-graph.json` + `harness/assert-fixture-graph.ts` —
      pin the row nodes, edges and stats, and the rendered row anchor.
- [X] T029 `plugins/quartz-okf/README.md` — document `label`, `row`, `stats.rows` and the
      marker under "Graph shape".
- [X] T030 `npm test` and `npm run typecheck` green; fixture smoke build green.

## Phase 8: Consumer validation (Development Workflow)

- [X] T031 Built `singular-solving-propuesta` (a copy, with markers on its 26 HERM tables
      and its linker off) against this working tree: `[okf] knowledge graph: 206 typed
      notes, 511 edges (0 unresolved)` — 65 notes + 141 rows, 141 anchors written, no
      warning. Its real adoption (markers, deleted scripts) is its own change.
