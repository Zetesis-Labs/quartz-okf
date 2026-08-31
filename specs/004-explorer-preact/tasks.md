# Tasks: The explorer as a Preact component

**Input**: spec.md, plan.md, research.md, data-model.md  
**Rule**: every pure decision starts as a failing test; the shell is gated by the
quickstart walk on a consumer build.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Pure decisions (tests first)

- [X] T001 [P] Tests + `lib/dock.ts`: open/pin/activate/close, one temporary tab.
- [X] T002 [P] Tests + `lib/navigation.ts`: level stack, trail, `levelOf`, direct
      entry, `popAction`.
- [X] T003 [P] Tests + `lib/url-state.ts`: `?explorer`/`graph`/`focus`, legacy redirect.
- [X] T004 [P] Tests + `lib/commands.ts`: command list, matching, node/background menus.
- [X] T005 [P] Tests + `lib/spatial-nav.ts` (from graphacker).
- [X] T006 [P] Tests + `lib/canvas-rules.ts`: alpha, drawn-alone, label rules, viewport.
- [X] T007 Catalogue keys (`en`, `es`) for menu, palette, keyboard, dock errors;
      `access.expand`/`access.reduce` removed.

## Phase 2: Package plumbing

- [X] T008 `package.json`: `quartz.category: ["component", "emitter"]`,
      `quartz.components.OkfExplorer` (right, 15), `exports["./components"]`, deps
      (`preact` peer + dev, `@preact/signals`, `d3-*`, `@types/d3-*`, `sass`), scripts
      `build`/`typecheck`.
- [X] T009 `tsup.config.ts`: esm dist with `external: preact*`, inline-script and scss
      loaders (as `quartz-okf-panels`), entries `index` + `components/index`.
- [X] T010 `tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: preact`, include
      `src`, `lib`, `types`) and `types/globals.d.ts`.
- [X] T011 `src/components/OkfExplorer.tsx` + `components/index.ts`: widget (title,
      preview, *Open*, stats slot), stage host, `data-cfg` from `explorerConfig`;
      warnings logged once per options object; `mountSelector` deprecation warning.
- [X] T012 `src/index.ts`: redirect emitter (`static/explorer.html` →
      `legacyRedirect`), type re-exports; delete `src/hud/main.js`, `src/assets/*`.

## Phase 3: The HUD (User Stories 1–4)

- [X] T013 [US2] `src/hud/state.ts`: signals and derived views.
- [X] T014 [US1] `src/hud/graphs.ts`: fetch/cache, registry, enter/back/direct/route,
      focus resolution, mode change, note fetch for the dock.
- [X] T015 [US2] `src/hud/canvas/engine.ts` (+ `ground.ts`): simulation, camera, draw,
      gestures, portal positioning; `requestDraw` coalescing; viewport culling.
- [X] T016 [US2] Components: `Bar` (trail, omnibar, close), `Results` (rows + palette
      rows), `Selection`, `Views`, `Filters`, `SideMenu`, `Dock`, `Tooltip`, `Portals`,
      `ContextMenu`, `Toast`; `Hud.tsx` root.
- [X] T017 [US4] `src/hud/actions.ts`: dispatcher for command and menu ids; keyboard
      (omnibar keys, walk, `Space`, `Escape` chain, printable → omnibar).
- [X] T018 [US1] `scripts/explorer.inline.ts`: boot, widget wiring, URL open, history,
      `addCleanup`, body scroll lock.
- [X] T019 [US2] `styles/explorer.scss`: 002 rules scoped to the stage + widget + new
      pieces; `hud.tokens` applied on the stage; reduced motion/transparency.

## Phase 4: Gate

- [X] T020 Build the plugin locally (`npm run build`), check the inline bundle size.
- [X] T021 Consumer build of `cern-it-governance-graph` against the working tree
      (`layout.position: right` on the plugin); quickstart walk in Chrome at 1440×900
      and 390×844; `?explorer` deep link; legacy redirect; back button.
- [X] T022 `npm test`, `npm run typecheck` green at the root (explorer `src/**/*.tsx`
      in the gate).
- [X] T023 Docs: `plugins/quartz-okf-explorer/README.md`, root `README.md`, `CLAUDE.md`,
      `docs/METHODOLOGY.md` mention; `quickstart.md` of this feature.
- [X] T024 Commits per scope; PR [#6](https://github.com/Zetesis-Labs/quartz-okf/pull/6) stacked on `003-typescript-toolkit`.
