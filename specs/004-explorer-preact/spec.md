# Feature Specification: The explorer as a Preact component — in-page HUD, declarative islands

**Feature Branch**: `004-explorer-preact`
**Created**: 2026-08-31
**Status**: Draft
**Input**: User description: "Comienza la implementación de la migración a Preact para
dejar atrás el código JS imperativo y pasemos al declarativo; llévate lo mejor que veas
de graphacker." Stacked on `003-typescript-toolkit` (which is stacked on
`002-explorer-hud`). Study of graphacker: `specs/002-explorer-hud/research.md` §1 and
the decisions below.

## Why

After 003 the explorer's *decisions* are typed and tested (`plugins/quartz-okf-explorer/
lib/*.ts`), but the *shell* that turns them into pixels is still one 1130-line
imperative module (`src/hud/main.js`): every island is assembled as an HTML string,
every button re-bound after every `innerHTML`, and the explorer lives in its own HTML
page that the note pages open inside an `<iframe>` and talk to by `postMessage`. The
owner's rule is one stack: Quartz renders with Preact, so the explorer is a Quartz
component — its islands are components that render from state, and it opens *inside*
the page, no second document, no message protocol. graphacker already solved the same
problem for a canvas graph with floating chrome; what carries over is its
discipline (hot path plain, application state reactive, UI reacts) and its power idioms
(context menu, command palette, keyboard walk, dismiss chain), not its bookmark domain.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the explorer inside the page (Priority: P1)

A reader on any note presses *Open the graph* in the right sidebar. The explorer covers
the page it is on — canvas edge to edge, the islands of 002 over it — with the note
selected. The trail of graphs is in the explorer's own bar; there is no second bar, no
frame. `Escape` (with nothing left to dismiss), the close control or the browser's back
button return to the note exactly as it was, without a reload. The address bar carries
the explorer's state (`?explorer`, `&graph=`, `&focus=`), so a copied link reopens the
same view.

**Why this priority**: it is the structural change everything else hangs on — one
document, one runtime — and it removes the iframe, the `postMessage` trail protocol and
the modal's duplicate bar.

**Independent Test**: on a consumer build, open a mounted note, press *Open the graph*,
check the URL gains `?explorer&focus=<slug>`; press `Escape` → the note is back, the URL
is clean, the scroll position kept; press the browser's back button after entering a
subgraph → the explorer returns to the parent graph; back again → the note.

**Acceptance Scenarios**:

1. **Given** a note page, **When** the reader opens the explorer, **Then** it renders
   over the page (no navigation, no iframe) with the note selected and framed, and the
   page behind does not scroll while it is open.
2. **Given** the explorer open on a subgraph, **When** the reader presses the browser's
   back button, **Then** the explorer returns to the parent graph with the portal
   selected; pressing back again closes the explorer.
3. **Given** a link `/<note>?explorer&graph=<id>&focus=<slug>`, **When** it is opened
   directly, **Then** the page renders and the explorer opens inside the subgraph with
   the note selected.
4. **Given** an old link `/static/explorer?graph=<id>&focus=<slug>`, **When** it is
   opened, **Then** it lands on the in-page explorer with the same graph and focus.
5. **Given** the explorer open, **When** the reader activates *Open* on a dock tab,
   **Then** the site navigates to that note through the SPA router and the explorer is
   closed.

---

### User Story 2 - Every island renders from state (Priority: P1)

The omnibar, trail, results, selection capsule, views island, filters island, side
menu, dock and tooltip are components: each reads the HUD state and renders; nothing
assembles markup as strings or re-binds handlers after a repaint. The behaviours of 002
are preserved one for one — the 002 quickstart walk passes on the new shell.

**Why this priority**: it is the migration the owner asked for ("dejar atrás el código
JS imperativo"); the walk of 002 is its regression suite.

**Independent Test**: the 002 quickstart walk, steps 1–12, on a consumer build of the
candidate; `grep -c innerHTML plugins/quartz-okf-explorer/src` returns 0.

**Acceptance Scenarios**:

1. **Given** any HUD interaction of 002 (mode chip, filter checkbox, result row, trail
   level, dock tab, `Escape` chain), **When** it is performed on the new shell, **Then**
   the outcome is the one the 002 walk describes.
2. **Given** the canvas, **When** the simulation ticks or the camera moves, **Then** no
   component re-renders: positions, transform and hover are plain fields the draw loop
   reads, and only the portal buttons are repositioned per frame.
3. **Given** a consumer's `locale`, `wording`, `hud.surfaces` and `hud.tokens`,
   **When** the page builds, **Then** they apply exactly as in 002 (catalogue, glass
   opt-in, token overrides), with build-time warnings for unknown keys.

---

### User Story 3 - Read a note in the dock without a frame (Priority: P2)

Clicking a node opens its note in the dock as a temporary tab; double-click pins it.
The note's content is the page's own article, fetched and placed in the dock — the
same mechanism Quartz's popovers use — so it inherits the site's styles and theme. The
dock keeps temporary/pinned tabs, *Open*, *Explore subgraph* and close.

**Independent Test**: open two notes, pin one, switch between them, close one; the
dock never contains an `<iframe>`; the content shows the note's body with headings and
links styled like the site.

---

### User Story 4 - The power idioms of graphacker (Priority: P2)

- **Context menu**: right-click on a node offers *Open*, *Open in new tab*, *Pin in
  dock*, *Frame neighbourhood*, *Copy link* and, on portals, *Explore subgraph*;
  right-click on the background offers *Fit*, *Clear*. `Space` on a keyboard-focused
  node opens the same menu at the node.
- **Command palette**: typing `>` in the omnibar lists commands — the modes of the
  graph on screen, *Fit*, *Clear*, *Enter <portal>*, *Back to <parent>*, *Open selected
  note*, *Pin selected note*, *Close dock*, *Copy link* — matched by title and keywords;
  `Enter` runs the highlighted one.
- **Keyboard walk**: `Tab`/`Shift+Tab` move a focus ring through the nodes; arrows move
  to the nearest node in that direction; `Enter` opens the focused note (or enters its
  subgraph); `Escape` drops the focus. Ignored while typing or while a menu is open.
- **Ground**: an optional dot grid with half-speed parallax and a soft vignette
  (`hud.ground: "dots"`), flat by default.

**Independent Test**: right-click the portal → the menu lists *Explore subgraph*; type
`>fit` and press `Enter` → the graph fits; press `Tab` three times → the ring moves
through three nodes and the label of the focused one is drawn; `hud.ground: "dots"`
draws the grid, the default does not.

---

### Edge Cases

- The explorer is opened from the site's index page (no note to focus): it opens on
  the root graph with nothing selected.
- The reader navigates (SPA) while the explorer is open — e.g. *Open* on a tab: the
  explorer is closed and unmounted before the navigation; its listeners are removed.
- A note fetched for the dock is missing (404) or has no article: the tab shows a
  named message with the URL and a link to open the page, never a blank panel.
- `?explorer` on a page whose graph document cannot be loaded: the explorer opens and
  says which file failed where the stats go (002 behaviour), and closing it works.
- The consumer still lists `mountSelector` or `output`: `mountSelector` is ignored with
  a named build warning (the layout places the widget now); `output` keeps naming the
  redirect page.
- Reduced motion: the open/close of the overlay and the camera transitions are cuts.
- Narrow viewport (< 900px): as in 002 — the dock takes the screen, islands stack.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `@zetesis/quartz-okf-explorer` MUST be a Quartz **component** plugin
  (`quartz.category: component`, one component `OkfExplorer`), placed by the consumer's
  layout (`position: right`), rendering the access widget and the explorer's host in
  the page. It MUST NOT emit a standalone explorer page other than a redirect for old
  links (FR-010).
- **FR-002**: The explorer MUST run in the page's own document: no `<iframe>` for the
  explorer, no `postMessage` between explorer and page. The dock MUST show notes
  without frames (fetched content).
- **FR-003**: Every visible HUD element MUST be a Preact component rendering from HUD
  state; the plugin's browser code MUST contain no `innerHTML`/string-assembled markup
  and no handler re-binding after render.
- **FR-004**: The draw loop MUST stay framework-free: node positions, the camera
  transform, hover and drag state are plain fields owned by the canvas engine; a
  simulation tick or a camera move MUST NOT trigger a component render.
- **FR-005**: D3 MUST be bundled from modules (`d3-force`, `d3-zoom`, `d3-drag`,
  `d3-selection`, `d3-transition`) into the plugin's browser script; the consumer no
  longer needs to serve a global `d3`.
- **FR-006**: The explorer's state MUST be readable from the URL: `?explorer` opens it,
  `graph=` names the subgraph, `focus=` the note; entering/leaving subgraphs and
  opening/closing MUST push/replace history entries so the browser's back button
  reverses each step.
- **FR-007**: Keyboard: all of 002 (FR-005, FR-013) plus `Tab`/`Shift+Tab` sequential
  focus, arrows spatial focus, `Enter` on the focused node, `Space` for its menu;
  `Escape` MUST extend the 002 dismiss chain with the context menu (first) and the
  keyboard focus, and close the explorer when nothing else is left.
- **FR-008**: A context menu MUST exist for nodes and for the background with the items
  of User Story 4; items MUST be data (`{label, run, danger?, sep?}`) and every item
  MUST also be a palette command.
- **FR-009**: `>` in the omnibar MUST open the command palette (engine commands only;
  consumer commands are out of scope) in the same results list.
- **FR-010**: The plugin MUST keep emitting `static/explorer.html` as a redirect that
  forwards `graph` and `focus` to the in-page explorer, so links published before 004
  keep working.
- **FR-011**: All wording MUST come from the 002 catalogue (`es`, `en`); new keys for
  the menu, the palette, the keyboard focus and the dock's fetch failure MUST be added
  to both; `access.expand` / `access.reduce` are removed (the overlay is always
  full-viewport) and a consumer overriding them gets the existing "not an engine key"
  warning.
- **FR-012**: Decisions MUST be pure and tested with `node --test`: dock tab
  operations, the level stack and trail, URL state, command matching, spatial
  navigation, the label/alpha rules of the draw loop. The components MUST type-check in
  the repository gate (`npm run typecheck`) against `@quartz-community/types` and
  `preact`.
- **FR-013**: The plugin MUST keep the 002/003 options (`locale`, `wording`, `hud`,
  `modes`, `radius`, `layout`, …) with the same meaning; `mountSelector` is deprecated
  (warning), `injectAccess: false` hides the widget but keeps the host so `?explorer`
  still works.
- **FR-014**: Nothing in the engine MAY name a consumer, domain, type or label
  (constitution IV); the consumer's `okf.config.*` `explorer` block is the only source
  of vocabulary.
- **FR-015**: The consumer's build MUST keep working with one change in
  `quartz.config.yaml` (`layout.position: right` on the plugin) and none in
  `okf/quartz.ts`.

### Key Entities

- **HUD state**: level stack (`levels`, `currentId`), documents (`data`, `display`),
  mode, checked types/relations, query/scope/hits/highlight, selection, side menu,
  dock (`tabs`, `active`), context menu, keyboard focus, loading/error line.
- **Engine (hot)**: view (nodes/links with positions), transform, hover, drag,
  camera-touched, search camera; owned by the canvas module, never by a component.
- **Command**: `{ id, label, keywords, shortcut?, run }`; the palette and the context
  menu draw from the same registry.
- **Dock tab**: `{ id, title, type, url, pinned, content: loading | html | error }`.

## Success Criteria *(mandatory)*

- **SC-001**: The 002 quickstart walk passes on the consumer build at 1440×900 and
  390×844, from the in-page explorer.
- **SC-002**: `grep -rc "innerHTML\|postMessage\|<iframe" plugins/quartz-okf-explorer/src`
  is 0; `src/hud/main.js`, `src/assets/explorer.html` and `src/assets/access.js` are
  gone.
- **SC-003**: `npm test` and `npm run typecheck` are green at the root with the
  explorer's `src/**/*.tsx` in the gate; every pure module of FR-012 has its test file.
- **SC-004**: On the 274-note child graph, opening a menu, typing a query or toggling a
  filter paints within one frame; a simulation tick costs no component render
  (verified with Preact's render counter in the walk).
- **SC-005**: The browser script of the plugin (inline, minified) stays under 120 KB
  with Preact, signals and the five d3 modules bundled.
- **SC-006**: A published link `/static/explorer?graph=it-governance&focus=…` from the
  002 era opens the same view in the in-page explorer.

## Assumptions

- Quartz v5 component plugins ship `css` and `afterDOMLoaded` inline scripts bundled by
  the plugin's own tsup step at `quartz plugin install` (as `quartz-okf-panels` does);
  `preact`, `@preact/signals` and the `d3-*` modules are dependencies of the plugin and
  are installed there.
- Quartz renders components at build time only; the HUD is mounted client-side by the
  inline script into the host the component rendered.
- The reading dock fetches note pages the way Quartz popovers do; scripts inside a
  fetched note (mermaid, callouts) do not run — reading, not interacting.
- One layout position for the widget (`right`); consumers wanting it elsewhere use the
  layout, not an option.

## Out of scope (follow-ups)

- Consumer-declared palette commands (`explorer.commands`) — data extension point.
- Saved explorations (`localStorage`), full HUD state in the URL (modes, filters, pins).
- Reading island in the stack, `⌘W`, dock maximise.
- The note-page widget's own look beyond what the component renders today.
