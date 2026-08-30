# Research: what graphacker's interface does, and what carries over to the explorer

**Feature**: `002-explorer-hud` · **Date**: 2026-08-30 · **Status**: study, pre-specification

Source studied: `~/Developer/graphacker` at v0.22.1 (HEAD `1b1bdd39`), read at file level
and run live from `chrome-dev/newtab.html?demo=landing` next to the current explorer of
`cern-graph` (toolkit `98247dd`). File references below point at graphacker unless
prefixed with `explorer:`.

## 0. Why this study

The explorer's chrome grew by accretion: one tall panel (modes, help, search, type pills,
relation pills, legend, buttons) anchored bottom-left, two full-width bars stacked at the
top (trail of graphs, relation bar of the selected node), a reading dock on the right.
graphacker solved the same problem — a canvas graph that needs controls without losing
the canvas — with a HUD of floating islands, an omnibar and a strict "decisions are pure,
DOM reacts" discipline. The question is which of those moves are about *graphs* (and
carry over) and which are about *bookmarks and browser windows* (and do not).

## 1. Anatomy of graphacker's HUD

### 1.1 Stage and layering

- The canvas is the page: `#stage { position: fixed; inset: 0 }`, `html, body { overflow:
  hidden }` (`newtab.css`). Nothing reserves space; everything else floats.
- Floating containers are `pointer-events: none`; only their children take input
  (`#topbar > *`, `.hud-left-stack > *`). The graph stays draggable between islands.
- Z-order is explicit and small: stage 1 · HUD 20 · results 25 · tooltip 50 · toast 70 ·
  menus 95 (above the tour veil).
- Safe areas are respected once, at the anchors: `top: max(16px, env(safe-area-inset-top))`,
  `bottom: max(20px, env(safe-area-inset-bottom))`.
- The canvas draws its own ground: a dot grid that parallaxes at half the pan speed
  (`render/backdrop.ts`, `DOT_SPACING 26`, alpha .55) and a radial vignette. Cheap, and it
  makes the empty space read as *space* instead of *nothing loaded*.

### 1.2 Design tokens ("Liquid Glass")

Two palettes on `:root` selected by `prefers-color-scheme`; everything else is derived.

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--page` / `--surface-1` | `#f2f2ee` / `#fcfcfb` | `#000` / `#1c1c1e` | ground, dialogs |
| `--text-primary/secondary/muted` | `#1d1d1f` … | `#f5f5f7` … | three text levels, no more |
| `--hud-bg` (+`-hover`) | `rgba(255,255,255,.72)` | `rgba(28,28,30,.72)` | every island, capsule, menu, tooltip, toast |
| `--hud-border` + `--hud-border-inner` | `rgba(0,0,0,.08)` + inset highlight | `rgba(255,255,255,.12)` + inset | the glass edge |
| `--hud-shadow` / `--hud-shadow-lg` | soft / focused | deeper | rest / focus & menus |
| `--pill-active-bg/color` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.14)` | the one "selected" treatment |
| `--accent` | `#ff8000` | `#ff9000` | focus rings, scope pill "all", dirty dot |
| `--series-1..8` | Apple system colours | | data colours; never used for chrome |

Shapes: `.hud-capsule` (999px radius, inline-flex) for single-row things; `.hud-panel`
(14px radius) for islands; menus 16px; results 18px; `backdrop-filter: blur(28px)
saturate(190%)` on islands, `blur(36px) saturate(200%)` on menus/results. One motion
curve everywhere: `cubic-bezier(0.16, 1, 0.3, 1)`, 0.2s; `:active { transform: scale(.96) }`
on chips. `:focus-visible` is a 2px accent outline, offset 2px — nothing else styles focus.

Known cost, measured as a backlog item and not yet resolved: 12 `backdrop-filter`
surfaces over a 60 fps canvas (`docs/plan-remediacion-apple-floating-ui.md` → backlog).

### 1.3 The header is an omnibar

`newtab.html` header: one capsule, top-centre. Inside: a **scope pill** (`📍 Esta vista` /
`🌐 Todo` / `📁 <colección>`, `Tab` toggles it), the search input (320px, grows to 440px on
focus) and a results list dropping below (`#results`, `min(560px, 88vw)`, `max-height 62vh`).

Behaviour that matters (`search.tsx`):

- **Typing anywhere searches.** Any printable key outside an input focuses the box and
  appends the key; `/` focuses; `Escape` clears and blurs (`handleDocumentKeydown`).
- **Entering search changes the camera and restores it.** `enterSearchMode` saves `S.tf`,
  zooms to the whole graph (450 ms); `exitSearchMode` transitions back. The reader never
  loses where they were.
- **Results drive the canvas.** The query builds `S.focusSet` (matches + their hubs +
  parent) and the renderer dims the rest; the highlighted row sets `S.searchFocusNode`,
  and after a 3 s dwell the camera flies to it (`DWELL_MS`).
- **`>` is a command palette.** Same box, same list: `lib/command-palette.ts` is a
  registry (`id, titleKey, icon, shortcut, keywords, action`); `commands.ts` is the
  catalogue (views, layouts, filters, sessions, export/import, tour, settings). The
  search module knows nothing of the app — it renders `CommandItem`s.
- Each result row: colour dot (node colour, or origin colour for federated results) ·
  title · kind badge on the right (`marcador`, `carpeta`, `En: <colección>`). Federated
  rows carry a differently coloured badge so the reader knows the result lives elsewhere.
- `blur` waits 150 ms before hiding results so the click on a row lands
  (`BLUR_SETTLE_MS`) — the standard blur-vs-click idiom, named.

### 1.4 The left stack of islands

`<aside id="hud-left-stack">`, bottom-left, 215px wide, `gap: 8px`, five islands
(`newtab.html:207-233`, mounted by `panels.tsx`):

| Island | Contents | Rule that governs it |
|---|---|---|
| Brand | logo + settings gear | always visible; the only place the product name appears |
| Windows | window-filter chip ›, open-tab count chip `⧉ 6 abiertas · 3 sueltas` with `<kbd>º</kbd>`, saved sessions as rows with ✕ | chip hides when it would filter nothing — unless the island would then be empty (`lib/badge-label.ts` `winChipView`) |
| Views | saved-views picker › (rows with 📌 pin, then Save / Save as / Discard / Rename / Delete), pinned views as chips, Historial | "there is no entry for *no view*: that is what remains when you pick a source" (`views-nav.tsx` doc comment) |
| Sources + layout | `Colecciones ›` multi-select composition (`menuitemcheckbox` rows, Marcadores first, divider, cloud collections with 🗑, `+ Colección`), layout picker `◇ Libre ›` (icon + label + sub) | three axes, in order: origin → lens → layout (`lib/view-axes.ts`, `docs/layouts-del-grafo.md`) |
| Lenses | `Carpetas · Tags · Dominios` chips (+ strategy extras: history range, unsaved-only) and `← Grafo` while inside a subgraph | lenses are per-origin and remembered per origin (`LENSES_BY_SOURCE`, `lensMemory`) |

Mechanics shared by every island:

- An island with no visible button disappears:
  `.hud-vertical-panel:not(:has(button:not([hidden]))) { display: none }`.
- One control shape, the **chip**: full-width, left-aligned, 12px/500, `.active` gets the
  pill treatment and 600 weight; optional `.chip-sub` (muted count), `.chip-arrow` (›),
  `.chip-kbd` (shortcut), `.dot` (colour). Rows that need a secondary action use
  `.chip-row` / `.views-menu-row` (main button `flex: 1` + pin or ✕).
- Dropdowns open **beside** the island (`.views-menu { position: absolute; bottom: 0;
  inset-inline-start: calc(100% + 8px) }`), bottom-aligned with the trigger, scrollable at
  `min(420px, 100vh - 80px)`. They never cover the stack.
- Every dropdown closes on outside click or `Escape` through one primitive,
  `ui/dismiss.ts` `onDismiss(insideRef, close)`; triggers carry `aria-haspopup`,
  `aria-expanded`; rows carry `menuitemradio` / `menuitemcheckbox` + `aria-checked`.
- Chips **react**; nothing calls `updateChip()`. The text/active/hidden/warn of a chip is
  computed by a pure function over state (`badgeView`, `winChipView`) and the component
  only reads it (CLAUDE.md "La UI no se invoca, reacciona").

### 1.5 Window management

What graphacker calls windows are browser windows; the mechanics are the reusable part.

- **Filter + count + saved sets** is the shape of the island: *which windows* (filter
  chip), *what is open* (count chip that also toggles "only open", with its shortcut
  visible), *what I saved* (sessions: named sets restorable with one click, deletable
  with confirmation, saved from the filter menu itself with 📌 per row).
- **The decision is pure and tested.** `lib/badge-label.ts` returns `{hidden, text,
  active, warn}`; `warn` carries the permission problem into the chip itself (red chip
  "sin acceso a pestañas") instead of a silent empty state.
- **Persistence degrades honestly**: window ids do not survive a restart, so the stored
  filter collapses to `current` (`tabs.ts` `setWinFilter`), documented as a limit.
- **One `<dialog>` for every modal** (`ui/modal.tsx`): mounting a modal disposes the
  previous one; `DialogSpec` stays the boundary so callers build forms without JSX.
  Wide modals (settings master-detail, history journey) set a class on the same host.
- **One context menu element** (`ui/menu.tsx`): items are data (`label, action, danger,
  sep`), the element is clamped to the viewport, dismissed by outside click/Escape, and
  `Space` on a keyboard-focused node opens it at the node's screen position.
- **Toasts are persistent** (product decision, Aug 2026): bottom-right capsule with dot,
  message, optional action (Undo) and ✕. No timer.
- **Tour engine** (`ui/tour.tsx`): steps are data (`title, body, target(), onEnter,
  hero`); a spotlight follows the target while the graph moves. The tour *drives* the
  app (switches lens, zooms to a cluster) rather than describing it.

### 1.6 Subgraphs

A folder hub can be turned into a subgraph from its context menu (`interactions/
subgraph.ts`, preference persisted in `folderPrefs`); `Enter`/double-click opens it,
`rebuildAround` rebuilds and zooms to the members; the lenses island shows `← Grafo`
(`chip active`) to leave. The tooltip on such a hub says how to enter
(`tooltipOpenSubgraph`). This is the same shape the explorer already has for portals
(double-click, `#crumb-dive`, trail) — graphacker just puts the *exit* in the island.

### 1.7 Keyboard

`interactions/keyboard.ts`: `Tab`/`Shift+Tab` walk nodes sequentially, arrows move to the
nearest node in that direction (`lib/spatial-nav.ts`, pure), `Enter` activates (open /
follow portal / open subgraph / expand), `Space` opens the menu, `Escape` drops focus.
Everything is skipped while typing or while a dialog/menu is open. The focused node keeps
its label and gets a ring in the renderer.

### 1.8 Architecture rules that keep it maintainable

- `lib/**` is pure, has the unit tests and the mutation score; `ui/**` cannot import
  domain modules; domain modules never import the orchestrator (they go through
  `bus.ts`).
- Two-level state: application fields are reactive signals, hot fields (`nodes`, `tf`,
  `hover`) are plain because d3 mutates them at 60 fps; derived reads declare their
  dependency through `graphVersion()`.
- Zero visible text in code: `t(key)` over `locales/{es,en,…}.json`.
- Every dismissible surface uses the same primitive; every modal uses the same host;
  every chip uses the same class. Adding an island is HTML + one component.

## 2. The explorer today, seen next to it

From the live comparison (`cern-graph`, parent and `?graph=it-governance`):

1. **The panel is a wall.** In the child graph the bottom-left panel lists 12 mode
   pills, a paragraph of help, the search box, 25 type pills and 20 relation pills before
   reaching the legend and the buttons; it grows to the full viewport height.
2. **The panel hides the trail.** With that height it overlaps the trail bar at the top
   (`explorer:` `#panel { max-height: calc(100% - 1.8rem) }` vs `#topbars` at `top: 0`), so
   the breadcrumb of graphs — the thing FR-016 added on purpose — is only visible when
   the panel is collapsed. A stacking bug, but also a layout that cannot host both.
3. **Two full-width bars.** Trail and relation bar are `left:0; right:0` strips with a
   border and a translucent background; they behave like page chrome, not like HUD.
4. **Search is buried** in the panel, third from the top, and only searches the current
   graph; there is no way to search across the mounted subgraph from the parent.
5. **No command surface, no keyboard model, no context menu.** Fit, reset and the
   collapse chevron are buttons; the only shortcuts are `Escape` in the search box.
6. **Wording lives in the engine** (`Buscar nota…`, `Encajar`, `Limpiar`, `Explorar
   subgrafo ↘`, `Volver: ‹, el nivel anterior…`) in Spanish, whatever the consumer's
   language. Not domain vocabulary, so not a Principle IV violation — but the same class
   of problem graphacker solved with catalogues.
7. **Camera is the reader's** (a stated principle of the explorer README) — and it is
   right. graphacker moves the camera on search and restores it; the explorer's
   `?focus=` and `fit` respect the reader once they touched the camera. Keep that.
8. **The reading dock is already a window manager** (tabs, temporary vs pinned, frames
   per tab, open in new tab, close) with no representation in the HUD: when the dock is
   closed, nothing says three notes are still open.

## 3. Decisions

Each decision names what carries over, what is adapted and what stays out. "Engine" =
`plugins/quartz-okf-explorer`; all wording stays configurable (Principle IV) and every
chip decision is a pure function under the plugin's `src/lib/` with `node --test`
coverage (Principle III).

### D1 — The canvas becomes the page; chrome floats as islands

**Decision**: `#wrap` goes edge-to-edge; every control is a floating island or capsule
over it, containers `pointer-events: none`, children `auto`. The reading dock stays a
docked column (it is content, not chrome) but the canvas keeps its full width when the
dock is closed.
**Rationale**: the panel-as-wall and the trail-overlap both come from reserving space.
**Carries over verbatim**: the token set of §1.2 (renamed `--okf-hud-*`, values
consumer-overridable through the existing `light-dark()` pair), `.hud-capsule` /
`.hud-panel` shapes, the z-order ladder, safe-area anchors.
**Rejected**: a Quartz-style sidebar layout (fights the canvas), a top toolbar (the
trail already showed what a bar costs).

### D2 — The header is an omnibar: trail on the left, search on the right

**Decision**: one capsule, top-centre. Left segment = the **graph trail** as a scope pill
stack (`CERN graph › IT governance`; each earlier level a button; the current one bold),
which doubles as the search scope. Right segment = search input with results below.
Inside a subgraph the pill stack *is* the breadcrumb Rubén asked for in 001 (FR-016);
in the root graph it collapses to the site title.
**Rationale**: graphacker's scope pill and our trail answer the same question — *where
am I searching / where am I* — so they are one control. It also moves the trail out of
the panel's shadow for good.
**Adapted**: the scope has three values: *this graph*, *all graphs* (root + every
`static/okf-subgraphs/*.json`, results badged with the subgraph id, entering the
subgraph on activation), *a given subgraph*. `Tab` cycles as in graphacker.
**Carries over**: typing-anywhere, `/`, `Escape`, camera save/restore on search,
results-drive-dimming (the explorer already dims by `query`; keep), dwell-to-fly.
**Rejected**: keeping the trail as a separate bar above the omnibar (two headers).

### D3 — `>` opens a command palette in the same box

**Decision**: a registry of commands `{id, label, icon, shortcut, keywords, run}` filled
by the engine (modes, fit, reset filters, toggle labels/legend, enter/leave subgraph,
open/pin/close current note, copy link, toggle dock) and extensible by the consumer from
`okf.config.mjs` (`explorer.commands`, data only).
**Rationale**: it removes the `Encajar`/`Limpiar` button row and makes every action
reachable by keyboard without inventing chords. Consumers get an extension point that
is data, not code.
**Carries over**: `lib/command-palette.ts` shape and matching (title + keywords).

### D4 — The relation bar becomes a selection island

**Decision**: when a node is selected, a capsule appears under the omnibar: type dot ·
title · relation chips grouped by label (as today) · actions (`Abrir`, `Fijar`, `Explorar
subgrafo ↘` for portals). It is the only surface that talks about *one node*; the
tooltip stays for hover.
**Rationale**: graphacker has no equivalent because bookmarks have no typed relations;
the explorer's relation bar is its distinctive feature and deserves a first-class
island, not a strip.

### D5 — The left stack: brand · reading · views · filters

**Decision**, bottom-left, in this order (top to bottom):

1. **Brand**: consumer `title`, `backTo` link (`← inicio`), settings gear (labels on/off,
   legend, theme follows system).
2. **Reading** (the windows island): count chip `⧉ N abiertas · M fijadas` that toggles
   the dock; one row per pinned note (title, ✕); `Cerrar todas`. Hidden while nothing is
   open.
3. **Views**: the consumer's modes as chips (the island graphacker calls lenses) with the
   mode `desc` on demand (ⓘ popover), not as a permanent paragraph. Inside a subgraph the
   child's modes replace them and a `‹ Volver a <padre>` active chip leads the island —
   same gesture as graphacker's `← Grafo`, complementary to the trail (D2).
4. **Filters**: `Tipos › (25)` and `Relaciones › (20)` as side menus with
   `menuitemcheckbox` rows, colour dot, count; `Todos / Ninguno`; the legend of the
   current mode lives at the top of the relations menu. The stats line (`26 nodos · 72
   aristas`) becomes the island footer.

**Rationale**: this is the 001 explorer's content, regrouped by question — *what is open,
what am I looking at, what is on screen* — instead of by widget.
**Carries over**: chip anatomy, island auto-hide, side menus bottom-aligned, `onDismiss`,
the pure `chipView` pattern for every chip text/active/hidden/warn.
**Rejected**: sources/layout islands (the explorer has one corpus per site and one
layout; the mode already carries `graph`), history island (no analogue).

### D6 — Right-click is the node's menu; `Space` opens it from the keyboard

**Decision**: one menu element, items as data: open, open in new tab, pin, frame
neighbourhood, filter to this type / this relation, enter subgraph (portals), copy link.
Background right-click: fit, reset filters, toggle labels.
**Rationale**: the most used gesture in graphacker; the explorer has none. Every item is
also a palette command (D3) so nothing is menu-only.

### D7 — Keyboard model ported whole

**Decision**: `Tab`/`Shift+Tab` sequential, arrows spatial, `Enter` open, `Space` menu,
`Escape` clear; ignored while typing or with a menu open. Focused node: ring + label.
`lib/spatial-nav` ported as a pure module with tests.

### D8 — Reading dock as managed windows

**Decision**: keep the dock (right column; full-screen under 900px) but make its windows
first-class: the Reading island (D5) mirrors them, `⌘/Ctrl+W` closes the active tab,
`⌘/Ctrl+Shift+P` pins, temporary-vs-pinned stays (italic tab = temporary), `Ampliar`
(maximise) and `Cerrar` in the dock header. The modal host from note pages
(`access.js`) is untouched: it already is a single-`<dialog>`-like host (one modal
element, iframe replaced on open, scroll hijacked while open).
**Rejected**: floating, draggable note windows over the canvas — they would fight the
graph for the pointer and the islands for the corners.

### D9 — Saved explorations = graphacker's sessions and views, without an account

**Decision**: the whole HUD state is a URL (`?graph=&mode=&types=&edges=&focus=&pins=`)
so a view is shareable by copying the address (`Copiar enlace` in palette and menu);
`Guardar exploración…` stores name + URL in `localStorage` and lists them in the Reading
island as rows with ✕, like sessions. No sync, no server (Principle I: nothing authored
lives outside git; these are reader preferences).
**Rationale**: PAFE and CERN readers want "the view I showed you" more than personal
sessions; the URL is the portable form, and it makes every HUD state testable as a pure
`stateFromUrl` / `urlFromState` pair.

### D10 — Wording through catalogues, language from the consumer

**Decision**: engine strings move to `src/locales/{es,en}.json`; the emitter picks the
catalogue from `explorer.locale` (default: the site's `<html lang>`), the consumer may
override any key in `okf.config.mjs`. No visible text in engine code.
**Rationale**: same class of problem graphacker solved with `t()`; today an English
corpus (cern-graph) ships a Spanish HUD.

### D11 — Implementation substrate: TypeScript modules bundled by tsup, no framework

**Decision (recommended, open for the owner — see spec NEEDS CLARIFICATION)**: split
`explorer.html`'s inline script into `src/explorer/*.ts` — `lib/` pure (chip views,
url state, spatial nav, command matching, search ranking, federated scope) tested with
`node --test`; `hud/` DOM shells; `canvas/` rendering — bundled by the plugin's existing
tsup step into `explorer.js` and inlined into the asset at emit time, exactly as the
config is inlined today. Chips re-render from a tiny store (`set(state) → render()`), no
reactive framework.
**Rationale**: graphacker's win is the *rule* (decisions pure, DOM reacts), not Solid.
Solid would add a Babel plugin to every consumer's `quartz plugin install` and a runtime
the asset does not need; the explorer has ~15 chips, not a form system.
**Alternative kept alive**: SolidJS as in graphacker, if the reading dock grows into
real forms (annotations, comments). Not now.

### D12 — Ground and motion

**Decision**: dot grid with half-speed parallax and a soft vignette on the canvas
(§1.1); the one motion curve and the `:active` scale on chips; `backdrop-filter` on
islands with a `prefers-reduced-transparency` / consumer switch to flat surfaces.
**Rationale**: makes the canvas legible as space; the flat switch answers graphacker's
own unresolved backlog item (12 blurs over a 60 fps canvas) before it bites on a
300-node corpus on a modest laptop.

## 4. What does not carry over

- Origins / collections / composition (`source-nav.tsx`, `views/`): one corpus per site.
- Layout picker: the explorer has one force layout; modes already switch graphs.
- Browser windows, tabs, ghosts, sessions as browser state: no browser API here.
- Cloud, accounts, billing, telemetry.
- SolidJS (D11) — unless the owner decides otherwise.
- Persistent toasts: the explorer has no undoable operations yet; warnings stay in the
  build log (Principle V) and the HUD only needs a transient "Enlace copiado".

## 5. Open questions for the specification

1. Substrate: D11 as recommended, or SolidJS for parity with graphacker?
2. Does the modal host from note pages (`access.js`) adopt the islands too (it currently
   has its own bar with `Ampliar`/`✕`), or does the omnibar absorb those two actions when
   the explorer detects it is framed?
3. Saved explorations (D9): `localStorage` + URL as proposed, or URL only for v1?
4. Ground (D12): dot grid on by default, or opt-in per consumer?

## 6. Scope cut (2026-08-31)

Asked whether this was the best approach, the answer was "in the bones yes, in the
skin not entirely": the defects that hurt a reader are structural (a panel that hides
the trail, search blind to 272 mounted pages, `?focus=` silently unselected, Spanish
wording on English sites) and the power-tool idioms of graphacker — palette, context
menu, windows as a system, spatial keyboard — assume a daily user the explorer does not
have evidence of. The owner accepted the recommendation:

- **Tranche A (this feature)**: D1 (stage and layers), D2 (islands: brand, views,
  filters; reading island deferred), D3 (omnibar with the trail as scope, cross-graph
  search, `?focus=` across graphs; palette deferred), D5 (side menus for types and
  relations with all/none and legend), D6 (selection capsule; context menu deferred),
  D8 (single dismiss chain), D10 (wording catalogues `es`/`en`, default from the site
  locale), D11 (plain ES modules + esbuild through tsup, no framework), D12 tokens only
  (flat by default, glass opt-in; ground deferred). The dock keeps its temporary/pinned
  tabs and becomes an overlay instead of a flex sibling.
- **Tranche B (deferred, unscheduled)**: D4 (reading island, `⌘W`, maximise), D7
  (spatial keyboard), D9 (URL state and saved explorations), palette, context menu,
  dot-grid ground, the modal host adopting the island look.
- **Answers to §5**: (1) plain ES modules, no SolidJS; (2) `access.js` keeps its bar
  and only takes wording from the catalogue; (3) URL keeps `graph`/`focus` only;
  (4) no ground in tranche A.

The mock in `mock/hud.html` shows the full HUD (both tranches) and stays as the
discussion piece; the shipped tranche A is the subset above.
