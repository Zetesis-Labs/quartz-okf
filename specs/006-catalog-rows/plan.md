# Implementation Plan: Catalog rows as nodes

**Branch**: `006-catalog-rows` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-catalog-rows/spec.md`

## Summary

A note may declare that one of its tables is a catalog: each row becomes a node of the
graph, anchored inside the page, addressable as `<note>#<anchor>`, linkable with
`[[note#ID]]`, readable on its own in the explorer's dock, and annotatable from tables in
other notes. The engine gains two pure modules in `core/lib` (`anchor`, `catalog`) wired
into the existing validate → build pipeline, so the exporter and the Quartz emitter
publish the same row nodes; the `quartz-okf` transformer gains an html phase that writes
the row anchors; the explorer learns to cut a page to a fragment and to match aliases;
the panels fold long neighbour lists. `okf-graph/v1` grows three additive fields.

## Technical Context

**Language/Version**: TypeScript, type-stripped by Node ≥ 22.18 (`.nvmrc` = 22); no build
step in `core/`, tsup only for the plugins' published entry
**Primary Dependencies**: none at runtime in `core/`; Quartz v5 (pinned in
`harness/quartz.ref`) for the plugins; Preact + signals inside the explorer's HUD
**Storage**: static files — `static/okf-graph.json`, the rendered pages
**Testing**: `node --test` via `npm test` (`core/test`, `plugins/*/test`, `harness/test`),
plus the fixture smoke build asserted by `harness/assert-fixture-graph.ts`
**Target Platform**: static sites built by `okf build` on a developer machine or CI
**Project Type**: library + Quartz plugins (npm workspaces)
**Performance Goals**: a catalog of ~500 rows adds no perceptible time to a build; the
dock performs one page fetch per note regardless of how many of its rows are opened
**Constraints**: zero network in tests; additive `okf-graph/v1`; no vocabulary in engine
code; strict builds fail loudly; the anchor must equal what Quartz derives for
`[[note#Heading]]` (`github-slugger`) without depending on that package
**Scale/Scope**: 1–10 catalogs per note, ≤ 1000 rows per corpus in practice (the first
consumer has 420 in three notes)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies |
|---|---|
| I. Git is truth; bundles are the contract | Rows are derived from the notes' own tables at a given `source_head`; nothing is authored outside git and no second writer appears. The exporter and the emitter call the same pure extraction, so bundle and site agree (FR-009). |
| II. Functional core, effectful shell | `core/lib/anchor.ts` and `core/lib/catalog.ts` are pure (string → values, no fs, no DOM); the shells are the transformer's html phase (hast) and the explorer's fetch. The dock's cut is a pure function over a minimal document interface, tested with a stub. |
| III. Tests first, vertical | Each phase below opens with failing tests: characterization of `anchorSlug` against the verified `github-slugger` outputs, of `WIKILINK_RE` before it gains the fragment group, and of `buildGraph`'s current output before rows enter it. |
| IV. Engine ships no vocabulary | No type, label or consumer name in engine code. The single literal is the containment default `Part of`, taken from the reference profile the consumer already inherits and validated against its own `edgeLabels` — the precedent 001 set with `Contains`. Row types come from the marker and are checked against `profile.types`. |
| V. No silent failures | Eleven `catalog/*` rules, `error` by default; in non-strict mode each is a named warning and the offending table contributes nothing, with a summary line saying how many tables were skipped. The dock's fallback to the whole article logs a warning naming the URL. |
| VI. Comments only for a non-obvious why | New core code carries no narrative comments; the constraints that deserve one (the slug must match `github-slugger`; the html phase must not depend on plugin order) get one line each, in the language of the file. |
| VII. Additive schema, pinning | New node fields `label` and `row`, new `stats.rows`; documented in `plugins/quartz-okf/README.md` under "Graph shape". No existing field changes meaning. Consumers adopt by ref bump plus markers in their notes. |

No violations; Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-catalog-rows/
├── spec.md              # feature specification
├── research.md          # what was read, what it rules out, decisions D1–D11
├── plan.md              # this file
├── data-model.md        # marker grammar, module contracts, graph additions
├── quickstart.md        # how to try it on the fixture and adopt it in a consumer
└── tasks.md             # ordered, test-first task list
```

### Source Code (repository root)

```text
core/
├── lib/
│   ├── anchor.ts                # NEW pure: anchorSlug (github-slugger's algorithm)
│   ├── catalog.ts               # NEW pure: marker, tables, rows, annotations
│   ├── topology.ts              # WIKILINK_RE keeps the fragment; links convert with it
│   ├── resolver.ts              # row slugs, aliases, `note#anchor` targets
│   ├── rules.ts                 # catalog problems become violations; rows on the document
│   ├── graph.ts                 # row nodes, row edges, annotations, stats.rows
│   ├── types.ts                 # CatalogRow, CatalogAnnotation, GraphNode.label/.row
│   └── index.ts                 # exports
└── test/
    ├── anchor.test.ts           # NEW
    ├── catalog.test.ts          # NEW
    ├── graph.test.ts            # + row nodes, row edges, annotations, stats
    ├── resolver.test.ts         # + row slugs, aliases, collisions
    ├── rules.test.ts            # + catalog rules and levels
    └── topology.test.ts         # + fragments kept

plugins/quartz-okf/
├── src/index.ts                 # htmlPlugins: row ids + data-okf-node; :target style
├── test/emitter.test.ts         # + rows in the emitted graph
├── test/anchors.test.ts         # NEW: the html phase over a hast fixture
└── README.md                    # Graph shape: the additive fields

plugins/quartz-okf-explorer/
├── lib/note-cut.ts              # NEW pure: cut an article to a fragment
├── lib/focus.ts                 # aliases as a focus key
├── lib/search.ts                # aliases in matchNode
├── lib/model.ts                 # aliases and row through to the HUD model
├── lib/types.ts                 # HudNode.aliases, HudNode.row
├── src/hud/controller.ts        # fetch + cache by path; cut by fragment
└── test/{note-cut,focus,search,model}.test.ts

plugins/quartz-okf-panels/
└── src/components/scripts/blast-radius.inline.ts   # fold groups over eight

harness/
├── fixture/content/standards/arm.md        # NEW catalog note (two tables, a clause, a column edge)
├── fixture/content/analysis/gap.md         # NEW annotation note (ref table)
├── fixture/okf.config.mjs                  # the fixture's types/labels for rows
├── fixture/expected-graph.json             # pins the row nodes, edges and stats
└── assert-fixture-graph.ts                 # + the rendered row anchor
```

**Structure Decision**: single repository, existing workspaces. The feature adds two core
modules, one explorer module, two fixture notes and three test files; no new package and
no new dependency.

## Phase 0 — Research

Complete; see [research.md](research.md). Eleven decisions; the three that shape the code:

- **D3** identity is `slug = <note>#<anchor>` with the raw id as an alias, so the rendered
  `id`, the node slug and Quartz's `[[note#ID]]` agree with no registry;
- **D6** edges come from three declarations (containment by default, table-wide clauses in
  the Topology grammar, columns named after edge labels), all through the existing
  resolver;
- **D8** the dock cuts by fragment from knowledge (a row is `<thead>` + its `<tr>`), which
  is only possible once the toolkit knows a node can be part of a page.

## Phase 1 — Design

Complete; see [data-model.md](data-model.md). Surface summary:

- **Marker**: `<!-- okf:rows type=… id=… label=… description=… properties="A,B=key"
  pattern="…" edge=… ; <Label>: <targets> -->`, with note-level defaults in frontmatter
  `okf_rows`.
- **Core API**: `anchorSlug(value)`; `parseMarker(line)`, `findCatalogs(body)`,
  `cellText(cell)`, `cellTargets(cell)`, `catalogsOf(document, options)`.
- **Document**: `ValidatedDocument` gains `rows: CatalogRow[]` and `annotations:
  CatalogAnnotation[]`; problems arrive as violations with the `catalog/*` rules.
- **Graph**: row nodes with `label`, `aliases`, `row { note, anchor }`, `url`, their
  edges and derived inverses; annotations merged into the target nodes; `stats.rows`.
- **Rendering**: `<tr id="<anchor>" data-okf-node="<slug>">` inside a
  `data-okf-catalog` table, matched by table position and verified by header.
- **Explorer**: `cutFragment(document, fragment)` and a page cache keyed by path;
  aliases in focus and search.

### Implementation order (why)

1. **`anchorSlug` first** — every other piece addresses a row by its anchor; it is pinned
   against the outputs verified from `github-slugger` in research §2.
2. **`catalog.ts` pure extraction** — the value, no I/O, fast iteration; covers the three
   table shapes the first consumer has.
3. **Fragments through the plumbing** (`topology`, `resolver`) — characterize first: the
   wikilink regex changes capture groups and two call sites move with it.
4. **`rules` + `graph`** — rows reach the contract; the exporter gets them for free.
5. **The transformer's html phase** — the anchors the URLs promise; matched by table
   position so no plugin order is assumed, verified by header so a mismatch warns.
6. **The explorer** — the bug that started the spec, now with the graph to back it.
7. **Panels, fixture, README** — the reading polish, the regression net and the contract
   documentation.
8. **Consumer validation** — build Singular Solving against this SHA (Development
   Workflow requires it before proposing a ref bump); its adoption is its own change.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| The anchor drifts from `github-slugger` on an exotic id | `anchor.test.ts` pins the verified cases; the algorithm is the documented one (strip everything but letters, numbers, marks, connectors, dashes and spaces; spaces to hyphens) |
| A raw HTML table shifts the table positions in the hast | The html phase verifies the header cells before writing and, on mismatch, warns naming the note and writes nothing |
| `WIKILINK_RE` is exported and used elsewhere | It is re-exported from `core/lib/index.ts`; the change adds a capture group, so every call site is updated in the same commit and characterization tests pin both spellings |
| A consumer's short ids collide with note names | The resolver's existing collision rule applies unchanged: the short form goes unresolved and every candidate is named |
| The dock's cut needs a DOM in tests | The cut is a pure function over a minimal document interface that the real `Document` satisfies structurally; the test supplies a stub |

## Complexity Tracking

> No constitution violations to justify.

## Follow-ups (not in this feature)

- Short `[[ID]]` wikilinks rendered by Quartz (needs a corpus index at parse time).
- Rows from definition-list-like prose (the BCM's bold L1 paragraphs).
- Popover previews for row links, and Quartz's own search index over rows.
