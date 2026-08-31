# Research: one stack — the explorer as a Preact component of Quartz

**Feature**: `004-explorer-preact` · **Date**: 2026-08-31

Sources: the Quartz v5 checkout consumers build against (`harness/quartz.ref`
`9cf87ff`), read at `quartz/plugins/loader/*`, `quartz/cli/*`, `quartz/components/*`;
graphacker v0.22.1 (`~/Developer/graphacker`), read at `src/`; the 002 study
(`specs/002-explorer-hud/research.md`).

## 1. How Quartz v5 loads a component plugin

- `quartz plugin install --from-config` reads `quartz.config.yaml`; a local source
  (`./quartz-okf-explorer`) is symlinked into `.quartz/plugins/`, then the loader runs
  `npm install --ignore-scripts`, `npm run build` and `npm prune --omit=dev` in the
  plugin directory (`quartz/plugins/loader/gitLoader.ts:369-398`). So a plugin's own
  `dependencies`/`devDependencies` are installed before its build, `prepare` does **not**
  run (`--ignore-scripts`), and dev dependencies are gone afterwards — anything the
  built `dist` imports at Quartz's build time must resolve from Quartz's own
  `node_modules` (Preact does) or be bundled.
- The manifest is `package.json#quartz`; `category` may be an array
  (`["component", "emitter"]`). Components are imported from the package's
  `./components` subpath (`exports["./components"]` → `dist/components/index.js`) and
  registered by the names listed in `quartz.components` (`componentLoader.ts:1-71`).
  The emitter is found on the entry module (`findFactory`: `default`, then `plugin`,
  then the one exported function; several → the first whose instance has `emit`).
- Options: the YAML `options:` block merged with `componentRegistry.setOptionOverrides(
  pluginName, …)` is the single constructor argument (`config-loader.ts:779-789`). The
  consumer's `okf/quartz.ts` already calls `setOptionOverrides("quartz-okf-explorer",
  explorer)`; it keeps working unchanged. Position comes from `layout: { position,
  priority, condition }` per plugin entry.
- A component is a function `(props) => JSX` with three statics: `css`,
  `beforeDOMLoaded`, `afterDOMLoaded` (strings). Rendering is build-time only
  (`preact-render-to-string`); nothing hydrates on the client. `afterDOMLoaded` scripts
  are bundled by the plugin's own tsup (the `*.inline.ts` loader of `quartz-okf-panels`),
  with `bundle: true`, so they may import npm modules and sibling `.ts` files.
- The SPA router dispatches `prenav`/`nav` on `document`, exposes `window.addCleanup(fn)`
  (run before the next navigation) and `window.spaNavigate(url, isBack)`.

## 2. Decisions

### D1 — One document: the explorer is an overlay in the page

The component renders the access widget (title, preview, *Open the graph*, stats) in
the right sidebar **and** an empty host `<div class="okf-explorer-stage" hidden>`. The
inline script mounts the HUD into the host with Preact's `render()` when the explorer
opens, and unmounts (`render(null, host)`) when it closes or before a SPA navigation.
The old `<iframe>` + `postMessage` trail protocol disappears; the trail is the HUD's own
bar. Body scroll is locked while open (the 002 modal's hijack, kept).

### D2 — Two runtimes of Preact, on purpose

Quartz renders components at build time with its own Preact; the HUD needs Preact in
the browser. The inline script bundles `preact` + `@preact/signals` (≈ 6 KB gz) — there
is no client-side Preact to share with. Signals are chosen over hooks for the HUD state
because they are the Preact counterpart of graphacker's `S` (signal-backed application
fields, plain hot fields): a component reads `state.query.value` and re-renders only
when that field changes, without prop drilling or a reducer.

### D3 — The hot path stays framework-free

`src/hud/canvas/engine.ts` owns the force simulation, the camera transform, hover,
drag and the draw loop (ported from `main.js`, with graphacker's `requestDraw`
coalescing, viewport culling and a hidden-tab guard). It reads signals it needs
(selection, query, mode) and writes back only discrete events (hover node, click,
context-menu, camera touched). Portal buttons are rendered by Preact once and
positioned by the engine per frame through refs. A tick never renders a component.

### D4 — D3 from modules, bundled

`d3-force`, `d3-zoom`, `d3-drag`, `d3-selection`, `d3-transition` are imported and
bundled into the inline script (graphacker's choice); the consumer's global
`/static/d3.v7.9.0.min.js` is no longer needed by the explorer.

### D5 — The dock reads notes the way popovers do

A tab fetches the note's page, parses it with `DOMParser`, and shows the `article`
(Quartz's `.center` body without sidebars). Same document, same styles, same theme;
no iframe, no CSS injection across frames. Scripts of the note do not run (reading).

### D6 — Power idioms from graphacker, as data + pure decisions

Context menu (`lib/commands.ts` `nodeMenuItems`/`backgroundMenuItems`), command palette
(`commandList` + `matchCommands`, `>` prefix), keyboard walk (`lib/spatial-nav.ts`),
dismiss chain extended (`menu` → results → selection → keyboard focus → dock →
close). The shell dispatches by id; every menu item is also a command.

### D7 — URL and history

`?explorer` opens, `graph=` and `focus=` as before (`lib/url-state.ts`). Opening pushes
one history entry; entering a subgraph pushes another; `popstate` is resolved by the
pure `popAction` (`lib/navigation.ts`) into close / back / enter. Closing with the
control or `Escape` goes `history.back()` when the entry is ours, else replaces the URL.

### D8 — Old links keep working

The plugin keeps `category: ["component", "emitter"]`; the emitter writes
`static/explorer.html` as a redirect page (`legacyRedirect`) to `/?explorer&graph=…
&focus=…`. No other page is emitted.

### D9 — Ground, opt-in

graphacker's dot grid with half-speed parallax and vignette (`render/backdrop.ts`)
ports to the engine behind `hud.ground: "dots"`; the default stays flat (002 D12).

## 3. What stays out

Consumer-declared palette commands, saved explorations, reading island, `⌘W`, dock
maximise — `spec.md` § Out of scope. Solid, iframes, `postMessage` — by the owner's
rule (one stack).
