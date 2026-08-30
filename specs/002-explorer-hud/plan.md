# Implementation Plan: Explorer HUD — islands and omnibar (tranche A)

**Branch**: `002-explorer-hud` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-explorer-hud/spec.md`

## Summary

Rebuild the explorer's chrome as floating islands over an edge-to-edge canvas, put the
graph trail inside an omnibar that searches the current graph or every published graph,
replace the full-width relations strip with a selection capsule, fold types and
relations into side menus, and move every visible word into a locale catalogue. The
d3 canvas, the dock with temporary/pinned tabs, the subgraph navigation and the browser
history behaviour of 001 are preserved. The plugin gains a pure `lib/` that `node --test`
exercises without a build; the browser shell becomes one IIFE bundle inlined at emit.

## Technical Context

**Language/Version**: JavaScript (ESM) on Node ≥ 22 for `lib/` and tests; TypeScript
only in `src/index.ts` (the emitter); plain JS for the browser shell `src/hud/main.js`  
**Primary Dependencies**: tsup 8 (already a devDependency) bundles the shell with
esbuild; D3 v7 stays a global served by the consumer  
**Storage**: static files — `static/okf-graph.json`, `static/okf-subgraphs/<id>.json`  
**Testing**: `node --test` via `npm test`; new glob
`plugins/quartz-okf-explorer/test/*.test.js`  
**Target Platform**: static sites; consumers build with `okf/build-site.sh`, which runs
`quartz plugin install` → `prepare: tsup` inside the copied plugin  
**Project Type**: library + plugins (npm workspaces)  
**Performance Goals**: flat surfaces by default; a HUD interaction on the 290-note child
paints within one frame; no extra network beyond the published graph documents  
**Constraints**: zero network and zero build in tests; additive `okf-graph/v1` (no
schema change in this feature); no vocabulary in engine code; named warnings at emit  
**Scale/Scope**: one root graph plus 1–5 subgraphs, ≤ 300 notes each

## Constitution Check

| Principle | How this plan complies |
|---|---|
| I. Git is truth; bundles are the contract | The HUD reads only the documents the site already publishes; no derived store, no writes. |
| II. Functional core, effectful shell | Decisions in `plugins/quartz-okf-explorer/lib/*.js` (model, view, style, search, focus, route, hud, i18n, emit-config); DOM, canvas, fetch and history in `src/hud/main.js`; file I/O in `src/index.ts`. Fetching is injected into the registry loader. |
| III. Tests first, vertical | Phase 2 opens with characterization tests of `indexar`/`build`/`fillOf`/`sizeOf` ported from `explorer.html` before extraction; every new module starts with a failing test; the shell has no unit tests (canvas) and is gated by the quickstart walk on a consumer build. |
| IV. Engine ships no vocabulary | Catalogue keys are engine-generic (`search.placeholder`, `scope.all`); every type, label, mode and colour still comes from `okf.config.mjs` or the graph's `display`. |
| V. No silent failures | Unknown wording key and unsupported locale → named warning at emit; unavailable subgraph in *all graphs* scope → named in the results header; missing `hud.js` asset → thrown error naming the file. |
| VI. Comments only for a non-obvious why | The browser quirks documented in `explorer.html` (DPR, Firefox wheel lines, drag subject projection, hidden-tab fit, SPA config inlining) travel with the code they explain; nothing else. |
| VII. Additive schema, pinning | No graph change. New plugin options (`locale`, `wording`, `hud`) have safe defaults; no option renamed. |

No violations; Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-explorer-hud/
├── spec.md              # scoped specification (tranche A)
├── plan.md              # this file
├── research.md          # study of graphacker, D1–D12, §6 scope cut
├── informe-hud.md       # Spanish report for the owner, §11 decision
├── mock/hud.html        # interactive mock (full HUD, for discussion)
├── img/                 # screenshots used by the report
├── quickstart.md        # acceptance walk on a consumer build
└── tasks.md             # ordered, test-first task list
```

### Source Code (repository root)

```text
package.json                              # test script gains the explorer's test glob

plugins/quartz-okf-explorer/
├── lib/                                  # NEW pure modules (ESM, no DOM, no d3)
│   ├── template.js                       # {path} / {path|one|many} filling, readPath
│   ├── i18n.js                           # catalogues es/en, resolveLocale, makeT
│   ├── model.js                          # indexGraph: okf-graph/v1 → internal model
│   ├── display.js                        # vocabulary of the graph on screen (base + child)
│   ├── view.js                           # buildView: mode + filters → nodes/links/counts
│   ├── style.js                          # sizeOf, fillOf, scaleOf
│   ├── search.js                         # matchNode, rankResults, searchAcross, scopes
│   ├── focus.js                          # focusKeys, findNode, resolveFocus (all graphs)
│   ├── registry.js                       # graph registry from portals; loadRegistry(fetch)
│   ├── route.js                          # routeTo(trail, path) → back/dive steps
│   ├── hud.js                            # trailView, viewsIsland, filtersIsland, filterRows,
│   │                                     #   selectionView, statsText, dismissOrder
│   └── emit-config.js                    # explorerConfig(opts, siteLocale) + problems
├── test/                                 # NEW node --test suites, one per module
├── src/
│   ├── index.ts                          # emitter: inline hud bundle, locale/wording/hud opts
│   ├── hud/main.js                       # NEW browser shell (ports explorer.html's script)
│   └── assets/
│       ├── explorer.html                 # markup + tokens + CSS; __OKF_EXPLORER_HUD__ slot
│       └── access.js                     # wording from the catalogue (__OKF_WORDING__)
├── tsup.config.ts                        # two builds: node emitter + browser IIFE
├── package.json                          # prepare cleans dist before the two builds
└── README.md                             # new options, HUD anatomy, keyboard
```

**Structure Decision**: single package, no new workspace. `lib/` sits beside `src/`
so tests import it directly and tsup bundles it into the shell.

## Phase 0 — Research

Complete; see [research.md](research.md) §1–§5 and the scope cut in §6.

## Phase 1 — Design

- **Model** (`lib/model.js`): `indexGraph(raw)` returns
  `{ nodes: Map, edges, title, federatedFrom, display, types, edgeLabels }` without
  touching global colour maps. Colour assignment moves to `display.js`.
- **Display** (`lib/display.js`): `displayFor(base, graphDisplay, { palette, t })` →
  `{ colors, labels, edgeColors, modes, kindOrder, tooltip }`; inside a subgraph the
  child's display wins, the base fills gaps; without modes the child gets the
  catalogue's *full graph* mode.
- **View** (`lib/view.js`): `buildView(model, display, mode, { types, edges })` →
  `{ nodes, links, adj, idx, groups: {counts, meta, byProperty}, edgeCounts,
  edgesFilterable }`. `types`/`edges` are `Set|null` (null = all).
- **Search** (`lib/search.js`): `scopesFor(registry, trail)` → `[{id:"graph"|"all",
  label}]` or `[]`; `searchAcross(graphs, query, { kindOrder, limit })` →
  `{ rows: [{node, graphKey, badge}], unavailable: [graphTitle…] }`.
- **Registry** (`lib/registry.js`): `registryFrom(rootModel, rootKey)` walks portals;
  `expandRegistry(registry, key, model)` adds a loaded graph's portals;
  `loadGraphs(registry, keys, fetchGraph)` resolves each key to a model or a named
  failure.
- **Route** (`lib/route.js`): `routeTo(currentPath, targetPath)` →
  `[{ back: level } | { dive: id }]`.
- **Focus** (`lib/focus.js`): `resolveFocus(keys, graphs)` tries id, then `url`
  path, then leaf, root first, then each subgraph.
- **HUD** (`lib/hud.js`): island views as data; `dismissOrder(state)` returns which of
  `menu | results | selection | dock` `Escape` closes next.
- **i18n** (`lib/i18n.js`): `CATALOGUES.es/en`, `resolveLocale("en-US") → "en"`,
  `makeT(locale, overrides)` → `{ t, problems }`; `t` throws on an unknown engine key.
- **Emit config** (`lib/emit-config.js`): `explorerConfig(opts, siteLocale)` → the JSON
  the shell receives plus `problems` (unknown wording keys, unsupported locale).

### Implementation order (why)

1. **Test glob + characterization tests** — pin `indexar`, `build`, `fillOf`,
   `sizeOf`, `fill` before moving them; the port must not change a pixel of the graph.
2. **Pure modules, test-first, in dependency order** — template → i18n → model →
   display → style → view → search → focus → registry → route → hud → emit-config.
3. **Bundle plumbing** — tsup array config, `prepare` cleanup, emitter inlining,
   emitter options; verified by building the plugin locally with tsup.
4. **Shell + markup** — port `explorer.html`'s script to `src/hud/main.js` on top of
   the modules; new markup and tokens.
5. **Consumer build** — cern-graph with the local toolkit; quickstart walk in Chrome
   on root, child, `?focus=` into the child, search across graphs, narrow viewport.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| tsup array config builds in parallel; `clean` on one config wipes the other's output | `clean: false` on both; `prepare` removes `dist` first with a portable `node -e`. |
| The consumer's `quartz plugin install` runs `prepare` with the plugin copied into the Quartz cache — `lib/` must travel with it | `build-site.sh` copies the whole plugin directory; `files` in `package.json` lists `lib`. |
| esbuild error in the shell breaks every consumer build (same class as today's TS risk) | The shell is plain JS; the plugin is built locally before the ref bump; the consumer build is the gate. |
| The dock over the canvas hides the right part of the graph when fitting | `fit()` fits into the visible rect (canvas minus stack and open dock). |
| A subgraph document missing at runtime | Named in the results header; `?focus=` falls back to the root unselected with a console warning naming the graph. |

## Complexity Tracking

> No constitution violations to justify.

## Follow-ups (tranche B, not in this feature)

See `spec.md` § Deferred.
