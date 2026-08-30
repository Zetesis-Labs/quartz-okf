# Feature Specification: Explorer HUD — islands, omnibar and reading windows

**Feature Branch**: `002-explorer-hud`
**Created**: 2026-08-30
**Status**: Draft (pre-clarify)
**Input**: User description: "Inspírate profundamente en cómo hemos hecho la interfaz de
graphacker — HUD, header y gestión de ventanas — para rehacer todo el HUD del grafo y el
header del explorador." Study and decisions: `research.md` (D1–D12).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orient from a floating HUD (Priority: P1)

A reader opens the explorer of a corpus — or lands inside a federated subgraph through
`?graph=` — and sees the graph edge to edge. Controls float over it as small islands:
an omnibar at the top whose left side tells which graph they are in (and how to go back
up), a brand island with the way home, a views island with the modes of *this* graph,
a filters island with types and relations folded into menus. Nothing covers anything
else; islands with nothing to say are not there.

**Why this priority**: it removes the two defects seen in the live comparison (a panel
that grows into a wall and hides the trail of graphs) and is the frame every other
story hangs on.

**Independent Test**: open the parent graph and the child graph at 1440×900 and at
390×844; no island overlaps another or the omnibar; the trail is readable in the child
at both sizes; collapsing/expanding islands never moves the canvas.

**Acceptance Scenarios**:

1. **Given** the root graph, **When** the explorer loads, **Then** the omnibar shows the
   site title as scope, the views island lists the consumer's modes, the filters island
   shows `Types › (n)` and `Relations › (m)` and the footer stats; no help paragraph is
   permanently visible.
2. **Given** the reader is inside a subgraph, **When** they look at the omnibar, **Then**
   the scope reads `<parent> › <child>` with the parent as a button, and the views
   island starts with a `‹ Back to <parent>` chip followed by the child's modes.
3. **Given** the child graph with 25 types and 20 relations, **When** the reader opens
   `Types ›`, **Then** a side menu lists every type with colour dot, count and checkbox
   state, scrolls inside itself and closes on outside click or `Escape`; the island
   never grows past the menu's trigger.
4. **Given** any island, **When** every control in it is hidden (nothing open, no modes),
   **Then** the island is not rendered and the stack closes the gap.
5. **Given** a reader who touched the camera, **When** they change mode or filter,
   **Then** the camera stays where they left it (existing behaviour preserved).

---

### User Story 2 - Find anything and do anything from the omnibar (Priority: P1)

The reader types anywhere: the omnibar takes the keys and lists matching notes with a
colour dot and a kind badge; results in another graph carry that graph's badge and
entering one takes the reader there. `Tab` cycles the scope (*this graph* / *all
graphs* / a subgraph). Typing `>` turns the same box into a command palette with every
action of the explorer — modes, fit, reset filters, pin, enter or leave subgraph, copy
link — filtered by title and keywords and runnable with `Enter`.

**Why this priority**: search is the primary way into a 300-note corpus, and the palette
replaces the button row while making every action keyboard-reachable.

**Independent Test**: from the parent graph, type the title of a child note that is not
previewed in the parent; the result appears with the child's badge; `Enter` enters the
child with that note selected and the trail updated. Type `>fit` and `Enter`; the camera
fits.

**Acceptance Scenarios**:

1. **Given** focus is nowhere in particular, **When** the reader presses a printable
   key, **Then** the omnibar receives it and results appear; `/` focuses the box;
   `Escape` clears, blurs and restores the camera saved when search began.
2. **Given** scope *this graph*, **When** the query matches nodes, **Then** non-matching
   nodes and edges dim on the canvas and the highlighted row is marked on the canvas;
   after a dwell the camera flies to it unless the reader moved the camera.
3. **Given** scope *all graphs*, **When** results include notes of a subgraph, **Then**
   each carries the subgraph badge and activating it enters that subgraph, pushes the
   history entry and selects the note.
4. **Given** the box contains `>`, **When** the reader types, **Then** the list shows
   commands matched by label or keyword with their icon and shortcut; `Enter` runs the
   highlighted one and clears the box.
5. **Given** a consumer declared extra commands in `okf.config.mjs` as data, **When**
   the palette opens, **Then** they appear alongside the engine's, with their label.

---

### User Story 3 - Manage the notes I have open (Priority: P2)

Clicking a node opens its page in the reading dock as a temporary window; pinning keeps
it. A reading island lists what is open — `⧉ 3 open · 1 pinned` toggles the dock, each
pinned note is a row with ✕ — so the reader knows what is open even with the dock
closed. `⌘/Ctrl+W` closes the active window, the dock can be maximised, and `Close all`
empties it.

**Why this priority**: the dock already behaves like windows; giving them a place in the
HUD (as graphacker does with open tabs and sessions) makes their state visible and
manageable without opening the dock.

**Independent Test**: open three notes, pin one, close the dock; the island reads `3
open · 1 pinned`; click a pinned row → the dock reopens on that note; `⌘W` twice leaves
one; `Close all` hides the island.

**Acceptance Scenarios**:

1. **Given** no note is open, **When** the explorer loads, **Then** no reading island is
   rendered.
2. **Given** a temporary window, **When** another node is clicked, **Then** it replaces
   the temporary one (existing behaviour) and the count does not grow.
3. **Given** the dock is closed with windows open, **When** the reader clicks the count
   chip, **Then** the dock opens on the last active window.
4. **Given** the reader presses `⌘/Ctrl+W` with the dock focused, **When** a window is
   active, **Then** it closes and the next one becomes active; with none left the dock
   closes and the island disappears.

---

### User Story 4 - A selected node has its own island and its own menu (Priority: P2)

Selecting a node shows a capsule under the omnibar: type dot, title, its relations
grouped by label as chips, and actions (`Open`, `Pin`, `Explore subgraph ↘` for
portals). Right-click (or `Space` on a keyboard-focused node) opens a menu with the same
actions plus `Frame neighbourhood`, `Only this type`, `Only this relation`, `Copy link`.
Right-click on the background offers fit, reset filters and label toggle.

**Why this priority**: typed relations are the explorer's distinctive content; today
they sit in a full-width strip. The menu is graphacker's most used gesture and the
explorer has none.

**Independent Test**: select a portal; the capsule shows `Contains ×18` and the explore
action; right-click a note → `Only this type` leaves only its type checked in the
filters island.

**Acceptance Scenarios**:

1. **Given** a selected node, **When** the capsule renders, **Then** relation chips are
   grouped by label with counts and each chip selects the target node on click.
2. **Given** a right-click on a node, **When** the menu opens, **Then** it is clamped to
   the viewport, closes on outside click/`Escape`, and every item is also a palette
   command.
3. **Given** a keyboard-focused node, **When** `Space` is pressed, **Then** the menu
   opens at the node's screen position.

---

### User Story 5 - Move through the graph with the keyboard (Priority: P3)

`Tab`/`Shift+Tab` walk nodes in a stable order, arrow keys jump to the nearest node in
that direction, `Enter` opens (or enters a portal), `Escape` drops focus. The focused
node keeps its label and wears a ring. All of it is ignored while typing or while a
menu is open.

**Independent Test**: with the omnibar blurred, press `Tab` five times and `Enter`; a
note opens in the dock; press `Escape` twice; nothing is focused and the dock stays.

---

### User Story 6 - Save and share an exploration (Priority: P3)

Every HUD state — graph level, mode, checked types and relations, selection, pinned
windows — is in the URL. `Copy link` (palette, menu) copies it. `Save exploration…`
names the current URL and lists it in the reading island as a row with ✕, restorable
with one click. No account, no server.

**Independent Test**: filter to two types in the child graph, pin a note, copy the link,
open it in a private window: same graph, same filters, same pinned note.

**Acceptance Scenarios**:

1. **Given** any HUD state, **When** the reader copies the link, **Then** opening it
   reproduces graph level, mode, filters, selection and pinned windows.
2. **Given** a saved exploration, **When** its row is clicked, **Then** the HUD reaches
   that state through the same path as the URL (one code path).

---

### Edge Cases

- A subgraph declares modes the parent cannot render (unknown edge labels): the views
  island shows the child's modes only while inside the child; leaving restores the
  parent's, with the mode that was active before entering.
- `?focus=` names a note that only exists inside a subgraph: the explorer enters that
  subgraph and focuses it (closes the silent no-selection gap found in 001).
- `Types ›` has one entry: the menu still renders (one row) so the filter is discoverable.
- Search across *all graphs* while a subgraph JSON is missing (build without federation):
  the scope offers only *this graph* and says why in the results header; no silent
  narrowing.
- Reduced motion / reduced transparency: no camera transitions beyond a cut, flat
  island surfaces; the consumer can force flat surfaces in `okf.config.mjs`.
- Viewport under 900px: the dock takes the screen when open; islands stack bottom-left
  at a narrower width; menus open upward instead of sideways when there is no room.
- The explorer is framed by the note-page modal (`access.js`): `Escape` with nothing to
  clear closes the modal (existing), and the brand island's back link is hidden because
  the modal's bar already offers close.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The canvas MUST occupy the whole explorer viewport; every control MUST be
  rendered as a floating island or capsule that does not reserve layout space.
- **FR-002**: An island MUST NOT render when it contains no visible control.
- **FR-003**: The omnibar MUST show the graph trail as its scope: the current graph, and
  every ancestor as a control that returns to it; in the root graph the scope is the
  site title.
- **FR-004**: The omnibar MUST search the current graph by default and MUST offer *all
  graphs* (root and every published subgraph) as a scope; results from another graph
  MUST carry that graph's badge and, when activated, MUST enter it with the note selected
  and the browser history updated.
- **FR-005**: A printable key pressed outside an input MUST focus the omnibar and apply
  the key; `/` MUST focus it; `Escape` MUST clear it and restore the camera saved when
  search started, unless the reader moved the camera meanwhile.
- **FR-006**: A query MUST dim non-matching nodes and edges on the canvas; the highlighted
  result MUST be marked on the canvas.
- **FR-007**: A leading `>` MUST switch the omnibar to a command palette listing engine
  commands and consumer-declared commands (data in `okf.config.mjs`), matched by label
  and keywords, each with icon and optional shortcut.
- **FR-008**: The views island MUST list the active graph's modes as chips; inside a
  subgraph it MUST show the child's modes preceded by a return chip; a mode's description
  MUST be available on demand, not permanently displayed.
- **FR-009**: Types and relations MUST be filtered from side menus with per-row colour,
  count and checkbox state, with *all* / *none* actions; the current mode's legend MUST
  be reachable from the relations menu.
- **FR-010**: Open reading windows MUST be represented in a reading island (count chip
  that toggles the dock; a row per pinned window with close); `⌘/Ctrl+W` MUST close the
  active window; the dock MUST offer maximise and close.
- **FR-011**: A selected node MUST render a selection capsule with type, title, relations
  grouped by label and the node's actions; portals MUST expose *explore subgraph* there.
- **FR-012**: Right-click on a node and `Space` on a focused node MUST open one context
  menu whose items are data; every item MUST also exist as a palette command.
- **FR-013**: Keyboard navigation (`Tab`, `Shift+Tab`, arrows, `Enter`, `Space`,
  `Escape`) MUST work as in User Story 5 and MUST be suspended while typing or while a
  menu or modal is open.
- **FR-014**: The full HUD state MUST round-trip through the URL query (`graph`, `mode`,
  `types`, `edges`, `focus`, `pins`); *copy link* MUST produce it and loading it MUST
  reproduce the state through the same path as saved explorations.
- **FR-015**: Every chip's text, active, hidden and warning state MUST be computed by a
  pure function over HUD state, covered by tests, with no DOM in the decision.
- **FR-016**: All visible engine wording MUST come from a locale catalogue (`es`, `en`)
  chosen by the consumer (default: the site language) and overridable per key from
  `okf.config.mjs`; engine code MUST contain no visible text.
- **FR-017**: The visual tokens (surfaces, borders, shadows, active treatment, accent,
  radii, motion) MUST be CSS custom properties with light and dark values, overridable
  by the consumer; blur surfaces MUST have a flat alternative honoured under
  `prefers-reduced-transparency` or by consumer switch.
- **FR-018**: The explorer MUST keep its current guarantees: the camera never recentres
  on its own once touched; `?focus=` and `?graph=` keep working; the trail and browser
  history behaviour of 001 (FR-014..FR-016 there) is preserved.
- **FR-019**: Nothing in the engine MAY name a consumer, domain, type or label; portals,
  federated notes and modes are recognised through the markers and configuration 001
  defined.
- **FR-020**: The HUD MUST NOT require a network request beyond the graph documents the
  site already publishes (`okf-graph.json`, `okf-subgraphs/*.json`).

### Key Entities

- **HUD state**: graph level (trail), active mode, checked types, checked relations,
  query and scope, selected node, keyboard-focused node, reading windows (active,
  pinned), camera-touched flag. Serialisable to and from the URL.
- **Island**: a named group of chips with a visibility rule; brand, reading, views,
  filters, selection.
- **Chip view**: `{hidden, text, active, warn?, sub?, kbd?}` produced by a pure function
  for one control.
- **Command**: `{id, label, icon, shortcut?, keywords, run}`; engine-provided or
  consumer-declared (data).
- **Reading window**: a note open in the dock; temporary or pinned; one frame each.
- **Exploration**: a name plus a HUD-state URL, stored locally by the reader.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In both test corpora (cern-graph root and its child), at 1440×900 and
  390×844, no HUD element overlaps another and the trail is fully readable — verified by
  bounding-box checks in the plugin test harness.
- **SC-002**: Entering a subgraph from the root, and returning, each take at most two
  reader actions from any of: omnibar, selection capsule, node menu, keyboard.
- **SC-003**: Every action available by pointer is available by keyboard through the
  palette or the keyboard model; a full walk (search → open → pin → enter subgraph →
  back) completes without a pointer.
- **SC-004**: A note that lives only inside a subgraph is reachable from the parent's
  omnibar in one query and one activation.
- **SC-005**: Copying and reopening a link reproduces graph level, mode, filters,
  selection and pinned windows in 100% of the cases covered by the URL round-trip tests.
- **SC-006**: All chip decisions, URL round-trip, command matching, spatial navigation
  and federated scope live in pure modules with `node --test` coverage; the DOM shell
  contains no decision that a test cannot reach.
- **SC-007**: With the 290-note child graph on a 2020-class laptop, HUD interactions
  (open menu, type a query, toggle a filter) paint within one frame at 60 Hz with blur
  surfaces on, and the flat alternative removes any measured regression.

## Assumptions

- The explorer remains a single static HTML asset emitted by `@zetesis/quartz-okf-explorer`
  and consumed by Quartz; its script is bundled by the plugin's existing tsup step and
  inlined at emit time, as the configuration is today.
- One corpus per site and one layout: no origin composition, no layout picker (see
  `research.md` §4).
- Saved explorations are reader preferences kept in the browser; nothing authored
  leaves git (constitution Principle I).
- The note-page modal host (`access.js`) keeps its bar; the explorer detects being
  framed and hides its own back link.
- Wording catalogues start with `es` and `en`; consumers with other languages override
  keys.

## Clarifications needed

- [NEEDS CLARIFICATION: substrate — TypeScript modules with a minimal store and render
  functions (recommended, research D11), or SolidJS for parity with graphacker at the
  cost of a Babel step in every consumer install?]
- [NEEDS CLARIFICATION: should the note-page modal (`access.js`) adopt the island look,
  or only the explorer inside it?]
- [NEEDS CLARIFICATION: saved explorations in v1 — `localStorage` list plus URL
  (research D9), or URL only?]
- [NEEDS CLARIFICATION: dot-grid ground and vignette on by default, or opt-in per
  consumer?]
