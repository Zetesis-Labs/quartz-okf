# Implementation Plan: Subgraph portals and open-node federation

**Branch**: `001-subgraph-federation` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-subgraph-federation/spec.md`

## Summary

Let a corpus declare that one of its notes stands for another published corpus, and
compose, at site-build time, that child's open notes into the parent graph around the
portal note. The engine gains a pure federation module in `core/lib`, the Quartz
emitter gains the effectful shell that fetches child graphs and republishes them
same-origin, and the explorer learns to draw portals, dive into a subgraph and come
back. Bundles stay per-corpus; the emitted graph grows only additive fields.

## Technical Context

**Language/Version**: JavaScript (ESM) on Node ≥ 22 for the toolkit; TypeScript
(tsup) for the explorer plugin entry, plain HTML/JS for `explorer.html`  
**Primary Dependencies**: none at runtime in `core/`; Quartz v5 (pinned in
`harness/quartz.ref`) and D3 (served by the consumer) for the plugins  
**Storage**: static files — `static/okf-graph.json`, `static/okf-subgraphs/<id>.json`  
**Testing**: `node --test` via `npm test` (`core/test`, `harness/test`, new
`plugins/quartz-okf/test`)  
**Target Platform**: static sites (Cloudflare Pages and similar); builds run on the
consumer's machine or devcontainer via `okf/build-site.sh`  
**Project Type**: library + plugins (npm workspaces)  
**Performance Goals**: federation adds no measurable time to a build beyond one HTTP
GET per child; the explorer keeps its current frame budget with ≤ 500 extra nodes  
**Constraints**: zero network in tests; additive `okf-graph/v1`; no vocabulary in
engine code; strict builds fail loudly  
**Scale/Scope**: 1–5 children per parent, ≤ 100 open notes per child in practice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies |
|---|---|
| I. Git is truth; bundles are the contract | Federation consumes published `okf-graph.json` of the child, never its markdown; output is regenerable from parent notes + child bundle at a recorded `source_head`. `okf-export` untouched. |
| II. Functional core, effectful shell | `core/lib/federation.js` is pure (`validateFederationConfig`, `federateGraph`, `absolutiseChildGraph`, `deriveInverseEdges`); fetching, copying and logging live in `OkfEmitter` with an injectable `fetchBundle`. |
| III. Tests first, vertical | Every task list phase opens with failing tests: characterization of inverse derivation before the refactor, federation behaviors before the module, emitter shell with a fake context and fetcher. |
| IV. Engine ships no vocabulary | Portals are found by config (`node`) and marked (`subgraph`); the open filter is a consumer-named property; default edge label `Contains` comes from the base profile the consumer already inherits and is validated against the consumer's `edgeLabels`. |
| V. No silent failures | Config problems and fetch failures throw in strict mode with id + value; non-strict paths log named warnings; empty previews warn. |
| VI. Comments only for a non-obvious why | Explorer additions follow the file's existing style (Spanish, why-only); core code has none unless a browser/Quartz constraint demands it. |
| VII. Additive schema, pinning | New fields only (`baseUrl`, `subgraph`, `federated`, `url`, `stats.federated*`); documented in `plugins/quartz-okf/README.md`; consumers adopt by ref bump. |

No violations; Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-subgraph-federation/
├── spec.md              # feature specification
├── plan.md              # this file
├── research.md          # findings, corrections, decisions D1–D9
├── data-model.md        # config schema, graph additions, module contracts
├── quickstart.md        # how to try it on a fixture and on a consumer
└── tasks.md             # ordered, test-first task list
```

Contracts live in `data-model.md` §4–5 (function signatures and emitter options);
no separate `contracts/` directory is needed for an in-process library.

### Source Code (repository root)

```text
core/
├── lib/
│   ├── graph.js                 # extract deriveInverseEdges (behavior unchanged)
│   ├── federation.js            # NEW pure module
│   └── index.js                 # export the new functions
└── test/
    ├── graph.test.js            # + characterization of inverse derivation
    └── federation.test.js       # NEW

plugins/quartz-okf/
├── dist/index.js                # emitter: baseUrl, federation option, fetch shell, copies
├── test/emitter.test.js         # NEW: fake Quartz context + injected fetcher
└── README.md                    # Graph shape: document the additive fields

plugins/quartz-okf-explorer/
├── src/index.ts                 # ExplorerOptions: nothing new required; pass-through only
├── src/assets/explorer.html     # portal rendering, dive/back, federated marks, ?graph=
└── README.md                    # document the new interactions

docs/METHODOLOGY.md              # already describes the flow; add the consumer adoption recipe
.github/workflows/test.yml       # NEW: npm test on push/PR
```

**Structure Decision**: single repository, existing workspaces; the feature adds one
core module, one plugin test directory and one CI workflow. No new package.

## Phase 0 — Research

Complete; see [research.md](research.md). Two corrections changed the design:
`site` is a title (so `baseUrl` is introduced) and the explorer is built by consumers
(so no dist is committed).

## Phase 1 — Design

Complete; see [data-model.md](data-model.md). Summary of the design surface:

- **Config**: `federation.subgraphs[]` with `id?`, `node`, `graph`, `site?`, `edge?`,
  `preview{property, equals}`, `pin?`.
- **Graph**: root `baseUrl`; portal `subgraph{…}`; federated nodes with `federated`
  and absolute `url`; portal edges declared + derived; preserved child edges; `stats`
  counters.
- **Files**: `static/okf-subgraphs/<id>.json` with absolutised URLs and
  `federatedFrom`.
- **Core API**: `validateFederationConfig`, `federateGraph`, `absolutiseChildGraph`,
  `deriveInverseEdges`.
- **Emitter**: `federation` and `fetchBundle` options; strict/non-strict semantics.
- **Explorer**: portal ring + label, tooltip default, "Explore subgraph" in the
  reading panel header, navigation stack with breadcrumb and back, dashed ring and
  search badge for federated nodes, `?graph=<id>` deep link.

### Implementation order (why)

1. **CI first** — the repository has no workflow; test-first without CI loses half its
   value.
2. **Characterize, then extract `deriveInverseEdges`** — the only change to existing
   behavior; pinned before touching it.
3. **`baseUrl` on the emitter** — tiny, independent, and every child must publish it
   before it can be federated without `site`.
4. **Core federation module (US1 tests → code)** — the value; no I/O, fast iteration.
5. **Emitter shell (US1 + US3 tests → code)** — fetch, validate, copy, log.
6. **Explorer (US2)** — manual verification on a consumer build; no unit tests
   possible for canvas code, so the acceptance walk in `quickstart.md` is the gate.
7. **Adoption** — ref bump in the first consumer, then the second.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Child site blocks iframes | Reading panel shows blank; modifier-click still opens the page; documented in spec Assumptions |
| Colon in slugs surprises a downstream tool (panels plugin, search) | Panels render arbitrary slugs; verify the Quartz search index ignores graph-only nodes (they are not pages) during quickstart |
| Consumer builds pull `prepare: tsup` — a TS error in `src/index.ts` breaks every consumer build | `index.ts` changes are pass-through only; explorer logic stays in `explorer.html` |
| Stale previews go unnoticed | `pin` drift warning (US3); follow-up feature for ingest-based federation |

## Complexity Tracking

> No constitution violations to justify.

## Follow-ups (not in this feature)

- `002-bundle-ingest`: ingest bundles into a queryable store (SurrealDB server as the
  candidate) so federation and cross-corpus queries stop depending on parent rebuilds;
  git stays the source of truth and the store is rebuildable from bundles.
- Qualified wikilinks `[[id:slug]]` from parent notes to federated nodes.
