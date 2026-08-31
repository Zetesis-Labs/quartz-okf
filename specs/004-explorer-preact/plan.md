# Implementation Plan: The explorer as a Preact component

**Branch**: `004-explorer-preact` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)
**Input**: `spec.md`, `research.md`, `data-model.md`. Stacked on `003-typescript-toolkit`.

## Summary

Turn `@zetesis/quartz-okf-explorer` into a Quartz component plugin: the access widget
and the explorer's host are rendered by Quartz (Preact, build time); the HUD is a
Preact application (signals) mounted in the page by the plugin's inline script; the
canvas engine stays a framework-free module; D3 is bundled from modules; the dock
reads notes by fetching them; graphacker's context menu, palette, keyboard walk and
dot-grid ground come in as pure decisions plus small components. The emitter survives
only as a redirect page for old links.

## Technical Context

**Language/Version**: TypeScript 5.9 (erasable syntax) on Node ≥ 22.18 for `lib/` and
tests; TSX for components and the HUD; tsup 8 / esbuild for the plugin's two bundles  
**Primary Dependencies**: `preact` (peer for SSR, bundled for the HUD), `@preact/signals`,
`d3-force`, `d3-zoom`, `d3-drag`, `d3-selection`, `d3-transition`, `sass` (styles),
`@quartz-community/types` (types only)  
**Testing**: `node --test` on `lib/`; `tsc --noEmit` on `src/**/*.{ts,tsx}` in the repo
gate; the 002 quickstart walk on a consumer build for the shell  
**Target Platform**: static Quartz sites; consumers build with `okf/build-site.sh`
(`quartz plugin install` runs `npm install` + `npm run build` in the plugin)  
**Constraints**: no build in tests; no vocabulary in engine code; named warnings; the
draw loop never renders a component; inline bundle ≤ 120 KB minified  
**Scale/Scope**: one root graph + 1–5 subgraphs, ≤ 300 notes each

## Constitution Check

| Principle | How this plan complies |
|---|---|
| I. Git is truth | Reads only the published graph documents and note pages; writes nothing. |
| II. Functional core, effectful shell | New decisions in `lib/{dock,navigation,url-state,commands,spatial-nav,canvas-rules}.ts`; DOM, fetch, history, canvas in `src/hud/**` and `src/components/scripts/*.inline.ts`; file I/O in the redirect emitter. |
| III. Tests first, vertical | Each new pure module starts with its `test/*.test.ts` (red → green); the shell's gate is the 002 walk plus the 004 additions in `quickstart.md`. |
| IV. Engine ships no vocabulary | Only catalogue keys are added; types, labels, modes, colours still come from the consumer. |
| V. No silent failures | Deprecated `mountSelector` → named warning at build; a note the dock cannot fetch → named message with the URL; a graph document that fails → named in the stats line (002). |
| VI. Comments for a non-obvious why | The browser quirks of `main.js` travel with the engine; the SSR/CSR split and the hot-path rule are stated once in `hud/state.ts` and `engine.ts`. |
| VII. Additive schema, pinning | No graph change; options keep their meaning; one consumer change (`layout.position`). |

No violations.

## Project Structure

```text
plugins/quartz-okf-explorer/
├── lib/                          # pure (+6 new modules)
├── test/                         # node --test (+6 new suites)
├── src/
│   ├── index.ts                  # entry: redirect emitter (default) + type re-exports
│   ├── components/
│   │   ├── index.ts              # export { OkfExplorer }
│   │   ├── OkfExplorer.tsx       # SSR: widget + stage host + data-cfg; .css; .afterDOMLoaded
│   │   ├── styles/explorer.scss  # widget + stage + HUD styles (002 tokens + new pieces)
│   │   └── scripts/explorer.inline.ts   # boot: reads data-cfg, wires widget, URL, nav cleanup, mounts <Hud/>
│   └── hud/
│       ├── state.ts              # signals + derived
│       ├── graphs.ts             # fetch/cache/registry, level navigation, focus (effectful)
│       ├── actions.ts            # command dispatcher (ids → state/engine)
│       ├── Hud.tsx               # root: Stage, North, Stack, Side, Dock, Tooltip, Menu, Toast
│       ├── components/*.tsx      # Bar, Trail, Omnibar, Results, Selection, Views, Filters, SideMenu, Dock, Tooltip, Portals, ContextMenu, Toast
│       └── canvas/
│           ├── engine.ts         # simulation, camera, hit-test, draw loop, gestures
│           └── ground.ts         # dot grid + vignette (opt-in)
├── types/globals.d.ts            # *.scss, *.inline.ts modules; Quartz globals
├── tsup.config.ts                # esm dist (external preact) + inline/scss loaders
├── tsconfig.json                 # jsx react-jsx / preact; include src, lib, types
└── package.json                  # category [component, emitter]; exports ./components
```

Removed: `src/hud/main.js`, `src/assets/explorer.html`, `src/assets/access.js`, the
IIFE build, `tsconfig.build.json`'s iife entry.

## Phase 1 — Design notes

- **Boot** (`explorer.inline.ts`): find `.okf-explorer` hosts, read `data-cfg`, wire the
  widget's *Open* (adds `?explorer&focus=<slug>` and mounts), load stats for the widget
  from `graphUrl`, open on load when `stateFromSearch(location.search).open`, register
  `window.addCleanup` to unmount, listen to `popstate`. Runs on every `nav`.
- **Mount**: `render(<Hud cfg={cfg} host={host} />, host)`; `Hud` creates the state,
  the engine (in a `useEffect` on the canvas ref) and the graphs controller; unmount
  destroys the engine and releases the body scroll.
- **Engine ↔ state**: the engine subscribes with `effect()` to `selected`, `query`,
  `keyboardFocus` and `view`; it exposes `positions()` for `Portals`; `Portals`
  registers button refs; the engine positions them on each draw.
- **Dock content**: `graphs.ts#fetchNote(url)` → `DOMParser` → `article` innerHTML
  (Quartz's `.center` minus sidebars) → `dockContent`; a failure stores the named error.
- **History**: `open()` → `pushState` with the explorer state; `enter()` → `pushState`;
  `close()` → `history.back()` if `history.state?.okfExplorer`, else `replaceState`
  with the cleaned search. `popstate` → `popAction`.
- **Styles**: `explorer.scss` = 002 tokens and rules (from `explorer.html`) scoped under
  `.okf-explorer-stage`, plus widget styles (from `access.js`), context menu, palette
  rows, keyboard hint, toast. Light/dark via `light-dark()` as before, tokens
  overridable through `hud.tokens` set on the stage element.

### Implementation order

1. Pure modules with tests (done first, red → green).
2. Package plumbing: deps, tsup, tsconfig, globals; `OkfExplorer.tsx` + `index` files;
   the redirect emitter; build locally.
3. HUD: state → graphs → engine → components → actions → boot.
4. Consumer build (cern-it-governance-graph, local toolkit), walk in Chrome, fix.
5. Docs: README, CLAUDE.md, quickstart, tasks ticked; commits per scope.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| `npm prune --omit=dev` removes what `dist` needs at Quartz build | SSR dist externals: only `preact` (Quartz has it); everything else bundled. |
| Two Preact copies (Quartz SSR, HUD client) | They never meet: SSR outputs HTML; the HUD mounts into an empty host. |
| Signals + d3 mutating node objects | Node positions live on engine-owned objects; signals hold references, never positions. |
| Layout of the widget differs from 002's `mountSelector` insertion | The consumer's YAML gets `layout.position: right, priority: 15` (before backlinks). |
| Stats fetch on every page (widget) | Unchanged from 002 (`okf-graph.json` cached by the browser). |
