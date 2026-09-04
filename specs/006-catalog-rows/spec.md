# Feature Specification: Catalog rows as nodes

**Feature Branch**: `006-catalog-rows`
**Created**: 2026-09-04
**Status**: Draft
**Input**: User description: "A note may hold a table whose rows are the real
entities — a standard's catalogue, a register, an inventory. Each row should be a node of
the graph, addressable inside its page, linkable from other notes, readable on its own in
the explorer, and annotatable from tables in other notes. Today one consumer (Singular
Solving's HERM corpus) builds this by hand with 380 lines of Python outside the toolkit;
the explorer then opens the whole page for every row because the toolkit never knew a
node could be part of a page. The feature belongs to the toolkit so every consumer gets
it and the Python goes away." Research and decisions: [research.md](research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declare a table as a catalog and get one node per row (Priority: P1)

A corpus author has a note with a table whose rows are entities with a stable identifier
(`AC001`, `DE161`, `ISO-27001-A.5`). They write one marker line above the table saying
which column is the id, which is the label, which columns travel as properties and what
the rows are (their type). They rebuild. Every row is now a node of the site's graph
with its own slug, its type, its title, its properties, an edge to the note that holds
it, and a URL that lands on that row inside the page. The bundle exported by `okf-export`
carries the same nodes.

**Why this priority**: it is the feature. Without nodes from rows there is nothing to
anchor, link, read or annotate.

**Independent Test**: build a fixture note with a marked three-row table and assert the
emitted graph: three row nodes with slug `<note>#<anchor>`, the declared type, `label`
= the id, `title` from the label column, `properties` from the named columns, `url`
`/<note>#<anchor>`, a `row` marker, one containment edge each from row to note plus the
derived inverse, and `stats.rows = 3`. Run the same through the exporter and compare.

**Acceptance Scenarios**:

1. **Given** a note `standards/arm` with `<!-- okf:rows type=component id=Code
   label=Name properties="Gloss=gloss" -->` above a table of 3 rows, **When** the site is
   built, **Then** the graph holds nodes `standards/arm#ac001` … with `type: component`,
   `label: "AC001"`, `title: "AC001 — Student Recruitment"`, `properties.gloss`, `aliases:
   ["AC001"]`, `url: "/standards/arm#ac001"`, `row: { note: "standards/arm", anchor:
   "ac001" }`, and each has an edge `Part of → standards/arm` with `Contains` derived.
2. **Given** the same note, **When** `okf-export` runs, **Then** `okf-graph.json` in the
   bundle holds the same row nodes and edges as the site's graph.
3. **Given** a note whose frontmatter carries `okf_rows: { type: component, id: Code,
   label: Name }`, **When** a table below has only `<!-- okf:rows -->`, **Then** the
   table inherits those keys; a key in the marker overrides the frontmatter.
4. **Given** a marker whose `id` column is not in the table header, or a row whose id
   cell is empty, or two rows in one note that slug to the same anchor, **When** the site
   is built in strict mode, **Then** the build fails naming the file, the table (its
   1-based position among the note's tables) and the row.
5. **Given** a marker with `type` outside the profile's `types` or `edge` outside its
   `edgeLabels`, **When** built in strict mode, **Then** the build fails with the same
   message shape the profile rules use today (`profile/type-closed`,
   `profile/edge-label-closed`).
6. **Given** a table whose id cell mixes id and name (`BC002 Curriculum Planning`) and
   a marker `pattern="^(?<id>BC\d{3})\s+(?<label>.+)$"`, **When** built, **Then** the
   row's id is `BC002` and its title `BC002 — Curriculum Planning`; a cell that does not
   match fails the build naming the row.

---

### User Story 2 - Reach a row: anchors, links and the reading dock (Priority: P1)

A reader clicks a row node in the explorer, follows a `[[standards/arm#AC001]]` link
from another note, or opens a shared URL ending in `#ac001`. The page scrolls to that
row and highlights it. In the explorer, opening the node in the dock shows *that row* —
its table's header and the row — not the whole page; opening a second row of the same
page does not download the page again.

**Why this priority**: a node whose URL lands on a 109 KB page is not addressable; the
feature is not usable without it, and it is the bug that started this spec.

**Independent Test**: on the fixture build, assert the rendered page carries `<tr
id="ac001" data-okf-node="standards/arm#ac001">`; in the explorer open two rows of the
same note and observe one fetch of the page and a dock that shows one row each time.

**Acceptance Scenarios**:

1. **Given** a catalog table, **When** the page is rendered, **Then** every catalog row
   is `<tr id="<anchor>" data-okf-node="<slug>">` and the table carries
   `data-okf-catalog`; no other markup of the table changes.
2. **Given** a note that writes `[[standards/arm#AC001]]`, **When** rendered by Quartz,
   **Then** the link's `href` is `/standards/arm#ac001` and it lands on the row — the
   anchor the toolkit writes is the one Quartz derives for wikilink headings.
3. **Given** a URL with a row fragment, **When** opened directly or reached through the
   site's SPA navigation, **Then** the row is scrolled into view and visibly highlighted.
4. **Given** the explorer's dock opening a row node, **When** the page is fetched,
   **Then** the dock shows the table's `<thead>` and that `<tr>` only, titled with the
   node's title; **When** the fragment names a heading, the dock shows that heading's
   section; **When** the fragment matches nothing, the dock shows the whole article and
   logs a warning naming the URL.
5. **Given** two row nodes of the same page opened in turn, **When** the second opens,
   **Then** no second request for the page is made.
6. **Given** a row anchor that would equal a heading anchor of the same note, **When**
   built in strict mode, **Then** the build fails naming both.

---

### User Story 3 - Relate rows: hierarchy and typed edges from tables (Priority: P2)

A catalog is rarely flat. The author wants the rows of one table to hang from an entry
declared in another table of the same note (an application capability's components), or
a column of the table to hold each row's own relations. They declare the table-wide
relation in the marker with the same grammar as a `# Topology` line, or name a column
after an edge label of the profile. The graph shows the hierarchy; inverses are derived;
targets that do not resolve are reported like any unresolved Topology target.

**Why this priority**: containment in the note (US1) already gives a connected graph;
the hierarchy is what makes a standard readable as a tree and what the first consumer's
modes are built on.

**Independent Test**: a fixture note with a table of capabilities and, below it, a table
of components marked `edge=none; Part of: [[AP001]]`; assert the components' only edges
go to `<note>#ap001` and the capability gets `Contains` derived; a `Uses` column on one
row yields the edge and an unknown target lands in `unresolved`.

**Acceptance Scenarios**:

1. **Given** `<!-- okf:rows type=component; Part of: [[AP001]] -->`, **When** built,
   **Then** every row of that table has `Part of → <note>#ap001` (resolved through the
   row's alias) in addition to its containment edge.
2. **Given** the same marker with `edge=none`, **When** built, **Then** rows have no
   edge to the note; the `Part of` clause is their only declared edge.
3. **Given** a column whose header is `Uses` (an edge label of the profile) with cells
   `[[tools/okf]]` or `AP002, AP003`, **When** built, **Then** each row gets one `Uses`
   edge per target; a target that resolves to nothing is listed in `unresolved` with the
   row's slug as `source`.
4. **Given** two catalogs in different notes that both declare the id `AC001`, **When**
   a third note writes `Part of: [[AC001]]`, **Then** the edge is unresolved and the
   message says the short id is ambiguous and names both slugs; `[[standards/arm#AC001]]`
   resolves.
5. **Given** a clause whose label is not in the profile's `edgeLabels`, **When** built in
   strict mode, **Then** the build fails as `profile/edge-label-closed` does for Topology.

---

### User Story 4 - Annotate rows from another note (Priority: P2)

An analyst writes a note *about* a catalog: a table with one row per entry it discusses,
a column with the entry's id, and columns with the analyst's findings (a classification,
a comment). They mark the table with `ref=` instead of `id=` and the relation the note
holds to each entry. The findings become properties of the existing row nodes — so a
mode can colour the catalog by them — and the analyst's note gains one edge to each entry
it discusses.

**Why this priority**: it is how a standard becomes *this corpus'* reading of the
standard; without it a consumer parses the analysis note by hand, which is exactly what
the first consumer does today.

**Independent Test**: fixture note `analysis/gap` with `<!-- okf:rows ref=Code
properties="State=state" edge=About -->` over rows naming `AC001`, `AC002`; assert
`standards/arm#ac001.properties.state` and edges `analysis/gap → About →
standards/arm#ac001`; an unresolved ref fails in strict mode.

**Acceptance Scenarios**:

1. **Given** a `ref=` table, **When** built, **Then** each row's `properties` from the
   named columns are merged into the resolved node, and an edge with the table's `edge`
   goes from the annotating note to that node.
2. **Given** a `ref=` marker without `edge`, **When** built in strict mode, **Then** the
   build fails: an annotation names its relation.
3. **Given** a ref cell that resolves to nothing, or two annotation tables writing
   different values to the same property of the same node, **When** built in strict
   mode, **Then** the build fails naming file, table, row and (for the conflict) both
   values; in non-strict mode a warning names them and the first value wins.
4. **Given** a `ref=` table in the same build as the `id=` table that creates the rows,
   **When** built, **Then** the annotation lands (creation is ordered before
   annotation).

---

### User Story 5 - Find rows in the explorer and read their neighbourhood (Priority: P3)

A reader types `AC001` in the explorer's search, or opens `?explorer&focus=AC001` from a
document that only knows the code. The row node is found by its alias. On the page of a
catalog note, the neighbourhood panel does not list 141 rows one by one: the group is
folded with its count and opens on demand.

**Why this priority**: quality of reading, once the graph is right.

**Independent Test**: fixture explorer: `focus=AC001` selects `standards/arm#ac001`; a
search for `ac00` lists the rows; the panel on `standards/arm` shows `Contains (3)`
folded.

**Acceptance Scenarios**:

1. **Given** `?focus=AC001`, **When** the explorer opens, **Then** the row node is
   selected and framed (aliases are a focus key, after id and url).
2. **Given** a search query, **When** it matches a node's alias, **Then** the node is a
   result, ranked as its type's order says.
3. **Given** a page whose node has more than eight neighbours under one label, **When**
   the neighbourhood panel renders, **Then** that group is a folded section titled
   `<label> (<count>)`.

---

### Edge Cases

- A marker with no table below it (blank line, prose, end of file): error
  `catalog/table-missing` naming the file and line.
- A table inside a fenced code block, or a marker inside one: ignored — fences are
  documentation, as for Topology.
- Markdown in cells: ids, labels and property values are the cell's plain text (emphasis,
  code spans and wikilink syntax stripped; a wikilink contributes its alias or target).
- A property column named in the marker that the table lacks: error
  `catalog/column-unknown`.
- A `pattern` without a named group `id`: error `catalog/pattern-invalid`.
- An id whose anchor slugs to the empty string (only punctuation): error
  `catalog/id-empty`.
- A row id equal to a note slug's last segment (`[[arm]]` vs. a row `arm`): the short
  resolver treats it as a collision — unresolved with both candidates named; the
  qualified forms (`standards/arm`, `standards/arm#arm`) resolve.
- A raw HTML `<table>` in the source: it shifts the rendered table positions, so the
  identifier check fails to find the rows and the build warns naming the note, the table
  and each id it could not place; the graph is unaffected, only the anchors are missing.
- The same note as page and as catalog: the note keeps its own node; rows are separate
  nodes; `stats.notes` counts both (it already counts federated nodes), `stats.rows`
  counts rows.
- Federation: a child's row nodes travel like any other node; their `url` becomes
  `/<mount>/<note>#<anchor>` through the existing rewrite; `preview` may select rows.
- Non-strict mode: every problem above is logged naming file, rule, table and row (the
  machinery the profile's rule levels already provide) and the offending table
  contributes no nodes; the build goes on.

## Requirements *(mandatory)*

### Functional Requirements

**Declaring**

- **FR-001**: A GFM table becomes a catalog when the line immediately above it (blank
  lines allowed) is an HTML comment of the form `<!-- okf:rows <keys>[; <clause>]* -->`.
  Keys are `name=value` pairs, values bare or double-quoted; clauses follow the Topology
  line grammar (`<Edge label>: <targets>`) and apply to every row.
- **FR-002**: Reserved keys: `type` (row node type; required unless inherited), `id`
  (header of the identifier column; required for creating tables), `ref` (header of the
  column naming an existing node; makes the table an annotation), `label` (header of the
  column that names the row), `description` (header of the description column),
  `properties` (comma-separated headers, each optionally `Header=key`), `pattern`
  (regular expression with named groups `id` and optional `label` applied to the
  identifier cell's plain text), `edge` (label of the containment edge from row to note
  for `id` tables — default `Part of`, `none` to suppress; the annotation edge for `ref`
  tables — required). A table declares exactly one of `id` and `ref`.
- **FR-003**: A note MAY carry defaults for every reserved key under the frontmatter key
  `okf_rows` as one inline mapping; a marker's key overrides the note's default. Defaults
  are read identically by the core's YAML subset and by the site's YAML parser.
- **FR-004**: Row identity: `anchor` is the GitHub heading slug of the id (the algorithm
  Quartz applies to `[[note#Heading]]`); the node's `slug` is `<note-slug>#<anchor>`,
  its `url` is `/<note-slug>#<anchor>`, its `aliases` include the raw id. The raw id
  resolves as a short target while unique across the corpus; on collision the short form
  is unresolved and the message names every candidate.
- **FR-005**: Row node fields: `type` from the table; `label` = raw id; `title` = `<id> —
  <label cell>` when a label column is declared, else the id; `description` from the
  description column when declared; `properties` from the declared columns (plain text,
  keyed by header or by the declared key); `path` = the note's path; `tags` = the note's
  tags; `row: { note: <note-slug>, anchor }`.
- **FR-006**: Edges of a created row: the containment edge (`edge`) from row to note;
  one edge per target for every clause; one edge per target for every column whose
  header is an edge label of the profile (targets: wikilinks or comma-separated plain
  ids). All resolve through the same resolver as Topology, derive inverses through
  `inverseLabels`, and report unresolved targets in `unresolved` with the row's slug as
  source.
- **FR-007**: Annotation (`ref`) tables: each row resolves its ref cell to an existing
  node; the declared `properties` are merged into that node; an edge with the table's
  `edge` goes from the annotating note to the node. Creation tables are processed before
  annotation tables corpus-wide.
- **FR-008**: Validation problems are rules with a code, a level and a message naming
  file, table position and row: `catalog/marker-invalid`, `catalog/table-missing`,
  `catalog/column-unknown`, `catalog/id-empty`, `catalog/id-duplicate`,
  `catalog/pattern-invalid`, `catalog/pattern-nomatch`, `catalog/anchor-collision`,
  `catalog/ref-unresolved`, `catalog/edge-required`, `catalog/property-conflict`; `type`
  and edge labels reuse `profile/type-closed` and `profile/edge-label-closed`. Every one
  is `error` by default in strict mode and a named warning otherwise (Constitution V).
- **FR-009**: Extraction, identity, node and edge construction are pure functions in
  `core/lib` consumed by both `buildGraph` callers (exporter and Quartz emitter), so the
  bundle and the site publish identical row nodes (Constitution I, II).

**Rendering and reaching**

- **FR-010**: The `quartz-okf` transformer MUST render every catalog row as `<tr
  id="<anchor>" data-okf-node="<slug>">` and mark the table `data-okf-catalog`. It finds
  the table by its position among the note's tables (so it depends on no plugin order) and
  each row by the identifier it must be holding, scanning forward from the last match — a
  row the core dropped shifts nothing. A row it cannot find is a warning naming the note,
  the table and the id, and nothing is written for it.
- **FR-011**: Arriving at a page URL whose fragment is a row anchor — initial load or SPA
  navigation — MUST scroll the row into view and highlight it (`:target` styling shipped
  by the toolkit); the row MUST be a valid destination of Quartz wikilinks
  `[[note#ID]]` with no consumer script.
- **FR-012**: Topology parsing and bundle link conversion MUST keep fragments: a target
  `note#ID` resolves to the row node when it exists (else to the note, as today), and
  `convertWikilinks` writes `/note.md#anchor`.
- **FR-013**: The explorer's dock MUST fetch and cache pages by path, and with a fragment
  MUST show only the anchored row (table header + row) or heading section; an unmatched
  fragment shows the whole article and logs a warning naming the URL.
- **FR-014**: The explorer MUST match `?focus=` values and search queries against node
  aliases in addition to id, url, title and label.
- **FR-015**: The neighbourhood panel MUST fold any edge-label group with more than eight
  entries into a collapsed section titled with the label and the count.

**Contract and compatibility**

- **FR-016**: `okf-graph/v1` gains only additive fields: node `label`, node `row`,
  `stats.rows`; documented under "Graph shape" in `plugins/quartz-okf/README.md`.
  Existing fields keep their meaning; `stats.notes` remains the node count.
- **FR-017**: Federation MUST need no change for row nodes; a test pins that a child's
  row keeps `url` `/<mount>/<note>#<anchor>` and that `preview` may select rows.
- **FR-018**: Engine code MUST NOT name a consumer, domain, type or edge label; the only
  literal label is the containment default, taken from the base profile and validated
  against the consumer's `edgeLabels`, as 001 did for federation (Constitution IV).
- **FR-019**: The harness fixture MUST gain a catalog note (one `id` table with a
  clause-declared parent table, one column edge, one `ref` table in another note) and
  `expected-graph.json` MUST pin its nodes, edges and stats, so the smoke build fails on
  any drift.

### Key Entities

- **Catalog**: one marked table in one note — its column mapping, type, containment
  edge, clauses, and position among the note's tables.
- **Row node**: a node created from a catalog row — `slug <note>#<anchor>`, alias = raw
  id, `row` marker, edges to its note and to whatever the table or its cells declare.
- **Annotation**: a `ref` table whose rows enrich existing nodes with properties and
  connect the annotating note to them.
- **Anchor**: the GitHub heading slug of a row id — the single form shared by the
  rendered `id`, the node's `slug`/`url`, and Quartz's `[[note#ID]]` links.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The first consumer rebuilds with `herm-to-okf.py`, the graph half of
  `herm-linker.py`, the anchor script of `inject-sidebar.py` and both `herm-*graph.json`
  artifacts deleted; its explorer reads the site's own graph, and every one of the 420
  entries is a row node whose URL lands on its row.
- **SC-002**: Opening a row node in the dock shows one table row; opening any number of
  rows of the same page performs one page fetch.
- **SC-003**: `[[note#ID]]` written in any note reaches the row in the rendered site and
  yields a resolved edge when written in Topology — with no consumer code.
- **SC-004**: Every failure path in FR-008 is exercised by a test and names file, table
  and row; none is silent.
- **SC-005**: Adopting the feature in a consumer needs a ref bump, the row types in its
  profile, and markers in its notes — no engine change, no build hook.
- **SC-006**: `npm test` and the CI smoke build stay green with no network; the fixture's
  expected graph pins the row nodes and edges.

## Assumptions

- Catalog tables are GFM pipe tables authored in markdown (not raw HTML tables).
- Row ids are short tokens whose GitHub slug is stable and non-empty; ids that are
  sentences work but produce long anchors.
- A row's page is the note that holds its table; rows have no page of their own.
- The first consumer accepts rewriting its 29 BCM L1 capabilities from bold paragraphs
  into tables, adding a clean state column to its gap analysis, and declaring `Cites`
  in Topology (or generating them with its reduced linker) — the citation regex is its
  vocabulary, not the engine's.
- Short `[[ID]]` wikilinks *rendered by Quartz* stay out of scope (Quartz resolves links
  per file with no corpus index); qualified `[[note#ID]]` is the supported spelling for
  links, while `[[ID]]` works in Topology because the resolver is corpus-wide.
- The neighbourhood panel's fold threshold (eight) is a constant of the panel until a
  consumer needs to tune it.
