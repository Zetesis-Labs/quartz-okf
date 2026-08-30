# Feature Specification: Explorer HUD — islands and omnibar (tranche A)

**Feature Branch**: `002-explorer-hud`
**Created**: 2026-08-30 · **Scoped**: 2026-08-31
**Status**: Scoped — tranche A is this feature; tranche B is listed under *Deferred*
**Input**: User description: "Inspírate profundamente en cómo hemos hecho la interfaz de
graphacker — HUD, header y gestión de ventanas — para rehacer todo el HUD del grafo y el
header del explorador." Study and decisions: `research.md` (D1–D12). Scope decision:
`research.md` §6 and `informe-hud.md` §11.

## Scope decision

The study found eight defects in the explorer; the ones that hurt a reader — a panel
that grows into a wall and hides the trail, a `?focus=` that opens the parent graph
silently unselected for 272 of 290 mounted pages, search that cannot see other graphs,
engine wording fixed in Spanish on English sites — are fixed by the *structure* of
graphacker's HUD, not by its power-tool idioms. Tranche A ships the structure and the
search; tranche B (reading windows as a system, command palette, context menu, spatial
keyboard, saved explorations, dot-grid ground) waits until use shows that readers live
inside the graph rather than passing through it to a page.

The four clarifications of the draft are resolved as follows:

- **Substrate**: plain ES modules. Decisions in `plugins/quartz-okf-explorer/lib/*.js`
  (pure, `node --test`, no build); the browser shell in `src/hud/main.js`, bundled to
  one IIFE by the plugin's existing tsup step and inlined into `explorer.html` at emit
  time. No framework, no TypeScript in the runtime path (a TS error in `src/index.ts`
  breaks every consumer build; the shell must not add that risk).
- **Note-page modal (`access.js`)**: keeps its bar and look; it only takes its wording
  from the same catalogue as the explorer.
- **Saved explorations**: deferred. The URL keeps `?graph=` and `?focus=` only.
- **Dot-grid ground**: deferred. Surfaces are flat by default; blur is opt-in per
  consumer and always flat under `prefers-reduced-transparency`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orient from a floating HUD (Priority: P1)

A reader opens the explorer of a corpus — or lands inside a federated subgraph through
`?graph=` — and sees the graph edge to edge. Controls float over it as small islands:
an omnibar at the top whose left side tells which graph they are in (and how to go back
up), a brand island with the way home, a views island with the modes of *this* graph,
a filters island with types and relations folded into side menus. Nothing covers
anything else; islands with nothing to say are not there. The reading dock opens over
the canvas instead of squeezing it.

**Why this priority**: it removes the two defects seen in the live comparison (a panel
that grows into a wall and hides the trail of graphs) and is the frame every other
story hangs on.

**Independent Test**: open the parent graph and the child graph at 1440×900 and at
390×844; no island overlaps another or the omnibar; the trail is readable in the child
at both sizes; opening a side menu or the dock never moves the canvas.

**Acceptance Scenarios**:

1. **Given** the root graph, **When** the explorer loads, **Then** the omnibar shows the
   site title as scope, the views island lists the consumer's modes, the filters island
   shows `Types › (n)` and `Relations › (m)` and the stats; no mode description is
   permanently visible.
2. **Given** the reader is inside a subgraph, **When** they look at the omnibar, **Then**
   the scope reads `<parent> › <child>` with each ancestor as a control that returns to
   it, and the views island starts with a `‹ <parent>` chip followed by the child's
   modes.
3. **Given** the child graph with 19 types and 20 relations, **When** the reader opens
   `Types ›`, **Then** a side menu lists every type with colour dot, count and checkbox
   state, offers *all* / *none*, scrolls inside itself and closes on outside click or
   `Escape`; the island never grows past its trigger.
4. **Given** any island, **When** every control in it is hidden (one mode and not in a
   subgraph, no filters), **Then** the island is not rendered and the stack closes the gap.
5. **Given** a reader who touched the camera, **When** they change mode or filter,
   **Then** the camera stays where they left it (existing behaviour preserved).
6. **Given** the explorer framed by the note-page modal, **When** it loads, **Then** the
   brand island hides its back link (the modal bar already offers close).

---

### User Story 2 - Find a note in any graph from the omnibar (Priority: P1)

The reader types anywhere: the omnibar takes the keys and lists matching notes with a
colour dot and a kind label; results in another graph carry that graph's badge and
activating one takes the reader there with the note selected. `Tab` cycles the scope
between *this graph* and *all graphs*. A `?focus=` that names a note living only inside
a subgraph enters that subgraph.

**Why this priority**: search is the primary way into a 300-note corpus, and today it
cannot see 272 of the 290 pages the site mounts.

**Independent Test**: from the parent graph, type the title of a child note that is not
previewed in the parent; with scope *all graphs* the result appears with the child's
badge; `Enter` enters the child with that note selected and the trail updated. Open
`/static/explorer?focus=<mount>/<child-slug>`; the explorer opens inside the child with
the note selected.

**Acceptance Scenarios**:

1. **Given** focus is nowhere in particular, **When** the reader presses a printable
   key, **Then** the omnibar receives it and results appear; `/` focuses the box;
   `Escape` clears, blurs and restores the camera saved when search began unless the
   reader moved it meanwhile.
2. **Given** scope *this graph*, **When** the query matches nodes, **Then** non-matching
   nodes and edges dim on the canvas; `↑`/`↓` move the highlighted row and `Enter`
   selects and frames it.
3. **Given** scope *all graphs*, **When** results include notes of a subgraph, **Then**
   each carries the subgraph badge and activating it enters that subgraph, pushes the
   history entry and selects the note.
4. **Given** scope *all graphs* and a subgraph document that cannot be loaded, **When**
   results render, **Then** the results header names the graph that is missing; nothing
   narrows silently.
5. **Given** the root graph publishes no subgraph, **When** the omnibar renders,
   **Then** no scope control is shown.

---

### User Story 3 - A selected node has its own capsule (Priority: P2)

Selecting a node shows a capsule under the omnibar: type dot, title, its relations
grouped by label with the related notes, and `Explore subgraph ↘` for portals. Clicking
a related note selects it. The capsule replaces the full-width strip.

**Why this priority**: typed relations are the explorer's distinctive content; today
they sit in a full-width strip that competes with the trail.

**Independent Test**: select a portal; the capsule shows `Contains` with its notes and
the explore action; click a related note → it becomes the selection.

**Acceptance Scenarios**:

1. **Given** a selected node, **When** the capsule renders, **Then** relations are
   grouped by label (incoming ones marked), each group lists up to six notes and a
   `+n` remainder, and clicking a note selects it and opens it in the dock.
2. **Given** a selected portal, **When** the capsule renders, **Then** it offers
   *explore subgraph*.
3. **Given** a selection, **When** the reader clicks the background or presses
   `Escape` with nothing else to dismiss, **Then** the capsule disappears.

---

### User Story 4 - Read the explorer in my language (Priority: P2)

Every word the engine shows — placeholders, chip labels, hints, counts, the modal's
buttons — comes from a catalogue in the site's language, and a consumer can override
any key.

**Independent Test**: build a consumer with `locale: en-US` and no explorer `locale`;
the explorer and the note-page widget are in English. Set
`wording: { "search.placeholder": "Find a note" }`; the placeholder changes. Set an
unknown key; the build logs a named warning.

---

### Edge Cases

- A subgraph declares modes the parent cannot render (unknown edge labels): the views
  island shows the child's modes only while inside the child; leaving restores the
  parent's, with the mode that was active before entering.
- `?focus=` names a note that only exists inside a subgraph: the explorer enters that
  subgraph and focuses it (closes the silent no-selection gap found in 001).
- `Types ›` has one entry: the menu still renders (one row) so the filter is discoverable.
- Search across *all graphs* while a subgraph JSON is missing: the results header says
  which graph is unavailable; no silent narrowing.
- Reduced motion / reduced transparency: no camera transitions beyond a cut, flat
  island surfaces regardless of the consumer's choice.
- Viewport under 900px: the dock takes the screen when open; islands stack bottom-left
  at a narrower width; side menus open above the stack instead of beside it.
- The explorer is framed by the note-page modal (`access.js`): `Escape` with nothing to
  clear closes the modal (existing), and the brand island's back link is hidden.

## Requirements *(mandatory)*

Requirement numbers are kept from the draft so `research.md` and `informe-hud.md`
still point at the right ones; deferred requirements say so.

### Functional Requirements

- **FR-001**: The canvas MUST occupy the whole explorer viewport; every control MUST be
  rendered as a floating island or capsule that does not reserve layout space; the
  reading dock MUST overlay the canvas.
- **FR-002**: An island MUST NOT render when it contains no visible control.
- **FR-003**: The omnibar MUST show the graph trail as its scope: the current graph, and
  every ancestor as a control that returns to it; in the root graph the scope is the
  site title.
- **FR-004**: The omnibar MUST search the current graph by default and MUST offer *all
  graphs* (root and every published subgraph) as a scope when more than one graph is
  published; results from another graph MUST carry that graph's badge and, when
  activated, MUST enter it with the note selected and the browser history updated.
  A subgraph that fails to load MUST be named in the results header.
- **FR-005**: A printable key pressed outside an input MUST focus the omnibar and apply
  the key; `/` MUST focus it; `Escape` MUST clear it and restore the camera saved when
  search started, unless the reader moved the camera meanwhile.
- **FR-006**: A query MUST dim non-matching nodes and edges on the canvas; `↑`/`↓`
  MUST move the highlighted result and `Enter` MUST activate it.
- **FR-007**: *Deferred to tranche B* (command palette).
- **FR-008**: The views island MUST list the active graph's modes as chips; inside a
  subgraph it MUST show the child's modes preceded by a return chip; a mode's description
  MUST be available on demand, not permanently displayed.
- **FR-009**: Types and relations MUST be filtered from side menus with per-row colour,
  count and checkbox state, with *all* / *none* actions; the current mode's legend MUST
  be reachable from the relations menu.
- **FR-010**: *Deferred to tranche B* (reading island, `⌘W`, maximise). The dock keeps
  its temporary/pinned tabs, *open*, *explore subgraph* and *close*.
- **FR-011**: A selected node MUST render a selection capsule with type, title, relations
  grouped by label and the related notes; portals MUST expose *explore subgraph* there.
- **FR-012**: *Deferred to tranche B* (context menu).
- **FR-013**: `/`, printable keys, `↑`/`↓`/`Enter`/`Escape` in the omnibar and `Tab` for
  scope MUST work as in User Story 2; `Escape` outside the omnibar MUST dismiss, in
  order, the open menu, the results, the selection, the dock.
- **FR-014**: *Deferred to tranche B* (full HUD state in the URL). `?graph=` and
  `?focus=` keep their meaning; `?focus=` MUST resolve across published subgraphs.
- **FR-015**: Every chip's text, active and hidden state, every result row, the trail,
  the filter rows and the selection groups MUST be computed by pure functions over HUD
  state, covered by tests, with no DOM in the decision.
- **FR-016**: All visible engine wording — explorer and note-page widget — MUST come
  from a locale catalogue (`es`, `en`) chosen by the consumer (default: the site's
  Quartz locale) and overridable per key from `okf.config.mjs`; an unknown key or an
  unsupported locale MUST produce a named warning at build time.
- **FR-017**: The visual tokens (surfaces, borders, shadows, active treatment, accent,
  radii, motion) MUST be CSS custom properties with light and dark values, overridable
  by the consumer; surfaces MUST be flat by default, blur MUST be opt-in and MUST be
  disabled under `prefers-reduced-transparency`.
- **FR-018**: The explorer MUST keep its current guarantees: the camera never recentres
  on its own once touched; `?focus=` and `?graph=` keep working; the trail and browser
  history behaviour of 001 (FR-014..FR-016 there) is preserved; the dock keeps its
  tabs.
- **FR-019**: Nothing in the engine MAY name a consumer, domain, type or label; portals,
  federated notes and modes are recognised through the markers and configuration 001
  defined.
- **FR-020**: The HUD MUST NOT require a network request beyond the graph documents the
  site already publishes (`okf-graph.json`, `okf-subgraphs/*.json`).

### Key Entities

- **HUD state**: graph level (trail), active mode, checked types, checked relations,
  query and scope, selected node, dock tabs (active, pinned), camera-touched flag.
- **Island**: a named group of chips with a visibility rule; brand, views, filters,
  selection.
- **Chip view**: `{hidden, text, active, sub?}` produced by a pure function for one
  control.
- **Graph registry**: every graph the site publishes — root and subgraphs reachable
  through portals — with its title, document URL and the path of portal ids from the
  root; the basis of the *all graphs* scope and of `?focus=` resolution.
- **Reading tab**: a note open in the dock; temporary or pinned; one frame each.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In both test corpora (cern-graph root and its child), at 1440×900 and
  390×844, no HUD element overlaps another and the trail is fully readable — verified
  by hand on the consumer build (quickstart walk).
- **SC-002**: Entering a subgraph from the root, and returning, each take at most two
  reader actions from any of: omnibar, selection capsule, views island.
- **SC-004**: A note that lives only inside a subgraph is reachable from the parent's
  omnibar in one query and one activation, and by `?focus=` in zero.
- **SC-006**: Chip decisions, result rows, trail, filter rows, selection groups, graph
  routing, focus resolution and wording live in pure modules with `node --test`
  coverage; the DOM shell contains no decision that a test cannot reach.
- **SC-007**: With the 290-note child graph, HUD interactions (open menu, type a query,
  toggle a filter) paint within one frame at 60 Hz with flat surfaces.
- **SC-008**: `npm test` needs no build; a consumer build (`okf/build-site.sh`) of
  cern-graph succeeds with the candidate SHA and the explorer renders both graphs.

## Assumptions

- The explorer remains a single static HTML asset emitted by `@zetesis/quartz-okf-explorer`
  and consumed by Quartz; its script is bundled by the plugin's tsup step and inlined at
  emit time, as the configuration is today.
- One corpus per site and one layout: no origin composition, no layout picker (see
  `research.md` §4).
- The note-page modal host (`access.js`) keeps its bar; the explorer detects being
  framed and hides its own back link.
- Wording catalogues start with `es` and `en`; consumers with other languages override
  keys.

## Deferred to tranche B (`002b-explorer-hud-b`, not scheduled)

- Command palette (`>`), engine and consumer commands (FR-007).
- Reading island, `⌘/Ctrl+W`, dock maximise, *close all* (FR-010).
- Context menu on node and background, `Space` on a focused node (FR-012).
- Spatial keyboard navigation (`Tab` through nodes, arrows).
- Full HUD state in the URL and saved explorations (FR-014).
- Dot-grid ground with parallax and vignette.
- The note-page modal adopting the island look.
