---

description: "Task list for the explorer HUD — islands and omnibar (tranche A)"
---

# Tasks: Explorer HUD — islands and omnibar (tranche A)

**Input**: Design documents from `/specs/002-explorer-hud/`
**Prerequisites**: plan.md, spec.md, research.md

**Tests**: MANDATORY in this repository (Constitution III). Every test task is written
and observed failing before its implementation task.

**Organization**: characterization first (the port must not change the graph), then
one pure module per behaviour, then the plumbing, then the shell, then the consumer
walk.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 (HUD islands), US2 (omnibar and cross-graph search), US3
  (selection capsule), US4 (wording)

---

## Phase 1: Setup

- [X] T001 Add `plugins/quartz-okf-explorer/test/*.test.js` to the `test` script in
      `package.json`.
- [X] T002 [P] Add `lib` to `files` in `plugins/quartz-okf-explorer/package.json`;
      `prepare` removes `dist` before `tsup` (portable `node -e`).

---

## Phase 2: Characterization (blocking)

**Purpose**: pin what `explorer.html` computes today before any of it moves.

- [X] T003 `test/template.test.js`: `fill("{indeg|note|notes}", node)` and nested
      paths (`counts.Cites`, `subgraph.notes`) behave exactly as the tooltip filler in
      `explorer.html`.
- [X] T004 [P] `test/model.test.js`: `indexGraph` over a fixture shaped like the real
      root graph (portal, federated node, derived edge, edge to unknown target) yields
      the same node fields, `counts`, `indeg` and edge list as `indexar`.
- [X] T005 [P] `test/style.test.js`: `sizeOf` (radius byType / property map / default /
      mode sizeBy / indegree fallback) and `fillOf` (countEdge scale gated by
      knowledgeTypes, property map, fallback string and per-type map, type colour) match
      `explorer.html`.
- [X] T006 [P] `test/view.test.js`: `buildView` reproduces `build()` — mode edge
      filter, `sourceType`/`targetType`, relation filter applied only when the mode
      leaves more than one label, grouping by type or by the mode's property, nodes
      without the property never filtered, `adj`/`idx` shape.

---

## Phase 3: Pure modules (test first)

- [X] T007 [US4] `test/i18n.test.js` → `lib/i18n.js`: `resolveLocale` maps `en-US`
      → `en`, `es-ES` → `es`, unknown → `en` plus a problem; `makeT` applies overrides,
      reports unknown override keys, `t` throws on an unknown engine key; both
      catalogues have identical key sets.
- [X] T008 [US1] `test/display.test.js` → `lib/display.js`: base vocabulary; a child's
      display wins inside a subgraph and the base fills gaps; palette assignment for
      undeclared types and labels is stable; a child without modes gets the catalogue's
      *full graph* mode; leaving restores the base.
- [X] T009 [US2] `test/search.test.js` → `lib/search.js`: `matchNode` on title, label,
      id; `rankResults` by kind order then title; `searchAcross` badges foreign rows
      with the graph key and lists unavailable graphs; `scopesFor` returns no scope
      when one graph is published.
- [X] T010 [US2] `test/registry.test.js` → `lib/registry.js`: registry from root
      portals with paths; expanding with a loaded child adds its portals under the
      child's path; `loadGraphs` with an injected fetcher returns models and named
      failures, never throws on one bad graph.
- [X] T011 [US2] `test/route.test.js` → `lib/route.js`: same path → no steps; ancestor
      → one back; sibling → back to common prefix then dives; deeper → dives only.
- [X] T012 [US2] `test/focus.test.js` → `lib/focus.js`: `focusKeys` (decode, trim,
      lowercase); `findNode` exact then leaf; `resolveFocus` finds a mounted page
      `<mount>/<slug>` in the child by `url` when the root lacks it, prefers the root
      when both match.
- [X] T013 [US1][US3] `test/hud.test.js` → `lib/hud.js`: `trailView` (root: title,
      no ancestors; child: ancestors as controls; scope key present only with >1 graph);
      `viewsIsland` hidden with one mode at the root, shows the return chip inside a
      subgraph, marks the active mode; `filtersIsland` texts with counts and hidden when
      nothing to filter; `filterRows` with all/none state; `selectionView` groups by
      label with direction marker, six-note cap and `+n`, explore action for portals;
      `statsText`; `dismissOrder`.
- [X] T014 [US4] `test/emit-config.test.js` → `lib/emit-config.js`: config JSON shape;
      locale defaults to the site's; `wording` overrides applied; unknown key and
      unsupported locale reported as problems; `hud.surfaces` defaults to `flat`.

**Checkpoint**: `npm test` green; every decision of the HUD reachable from a test.

---

## Phase 4: Plumbing

- [X] T015 `tsup.config.ts`: array config — node emitter (`src/index.ts`, esm, dts) and
      browser shell (`src/hud/main.js` → `dist/assets/hud.js`, iife, es2022, no
      splitting); `clean: false` on both; assets copied after the node build.
- [X] T016 `src/index.ts`: options `locale`, `wording`, `hud: { surfaces, tokens }`;
      build the config with `explorerConfig(opts, ctx.cfg?.configuration?.locale)`;
      log each problem as `[quartz-okf-explorer] warning: …`; inline `hud.js` at
      `__OKF_EXPLORER_HUD__`; substitute `__OKF_WORDING__` in `access.js`.
- [X] T017 Build the plugin locally (`npx tsup` in the plugin) and check that
      `dist/assets/hud.js` exists and `dist/index.js` still exports `OkfExplorer`.

---

## Phase 5: Shell and markup

- [X] T018 [US1] `src/assets/explorer.html`: tokens (light/dark, flat default, glass
      opt-in, reduced-transparency), stage with absolute canvas, `#hud` layer with
      pointer-events rules, omnibar + results + selection capsule at top centre, island
      stack bottom-left (brand, views, filters), side menu, dock overlay, tooltip; narrow
      viewport rules; `body.framed` hides the back link.
- [X] T019 [US1][US2][US3] `src/hud/main.js`: port the script of `explorer.html` on top
      of the modules — canvas drawing, simulation, zoom/drag, dock tabs, subgraph
      navigation and history untouched in behaviour; new: omnibar with trail scope and
      results keyboard, scope cycling with lazy registry loading, activation of foreign
      results through `routeTo`, side menus with all/none/legend, views island with
      return chip and on-demand description, selection capsule, single dismiss chain,
      `?focus=` across graphs, fit into the visible rect.
- [X] T020 [US4] `src/assets/access.js`: read its strings from `__OKF_WORDING__`.
- [X] T021 Rebuild the plugin; open `dist/assets/explorer.html`'s emitted form on a
      consumer build (next phase) — no standalone check possible without a graph.

---

## Phase 6: Consumer walk (gate)

- [X] T022 Build cern-graph against the local toolkit (`okf/build-site.sh` with the
      candidate SHA staged in the toolkit cache), serve `public/`, and walk
      `quickstart.md` in Chrome: root HUD, `Types ›` / `Relations ›`, mode chips, search
      in *this graph*, `Tab` to *all graphs*, a child-only note → enter with selection,
      trail controls back, `?focus=<mount>/<slug>` opens inside the child selected,
      dock tabs, 390px viewport.
- [X] T023 Write `quickstart.md` with the walk and the expected `[okf]` build line.
- [X] T024 `plugins/quartz-okf-explorer/README.md`: new options, HUD anatomy, keyboard,
      wording keys.
- [X] T025 Commits per scope (`test(quartz-okf-explorer)`, `feat(quartz-okf-explorer)`,
      `chore: test glob`, `docs(002)`); branch stays rebased on `001-subgraph-federation`.

---

## Phase 7: Review before the PR

- [X] T026 Silent failures named: a graph that fails to load says so where *loading…*
      was and in the console; trail, history and stack move only after the file arrived;
      the modal protocol warns on a malformed message; the dock's trim logs when it cannot.
- [X] T027 `lib/viewport.js` (+ tests): wheel step, visible rect and frame leave the shell.
