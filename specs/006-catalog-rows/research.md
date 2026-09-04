# Research: Catalog rows as nodes

**Feature**: `006-catalog-rows` | **Date**: 2026-09-04

What was read before designing, what it rules out, and the decisions with the
alternatives they beat. Every claim below was verified against the files named; none is
recalled from memory.

## 1. The precedent: how one consumer does it today

`singular-solving-propuesta` publishes the HERM standard (420 catalogue entries in three
notes) as a graph whose nodes are **rows of tables**, not notes. It is the only corpus of
the ten in the working tree that does so (`herm-okf-graph.json`: 420 of 427 nodes carry
a `#fragment` in `url`; the other nine graphs carry none). It gets there with 380 lines of
Python outside the toolkit:

| Script | What it does | Where the toolkit falls short |
|---|---|---|
| `okf/herm-linker.py:144` | Injects `<span id="ac001">AC001</span>` into the id cell of every row at build time (`content` seam) and rewrites bare code mentions in prose into links | No way to give a row a stable anchor; no way to link to it |
| `okf/herm-linker.py:53-95` | Parses another note (`gap-analysis-arm.md`) to attach a `state` property to each row | No way for one note's table to annotate nodes declared elsewhere |
| `okf/herm-to-okf.py` | Emits an `okf-graph/v1` document by hand: one node per code, `url: <note>#<code>`, `label: <code>`, hierarchy as `Part of`, a synthetic root, mentions as `Cita` edges | Nodes only come from notes (`core/lib/graph.ts:98-114`); `label` is not in the contract |
| `okf/inject-sidebar.py` (second half) | Injects a script into every page so arriving at `#ac001` scrolls to the row and highlights it | The site does not treat a row as a destination |

Its explorer configuration (`okf.config.mjs`, `explorer.graphInput`) points at that
hand-made document instead of the site's own graph, so the corpus is split in two graphs
(65 notes vs. 420 codes) that a mode has to stitch (`modes[].graph`).

The bug that prompted this feature: the explorer's dock fetches the node's `url`, drops
the fragment (a browser never sends it) and shows the whole `<article>`
(`plugins/quartz-okf-explorer/src/hud/controller.ts:490-497`). 141 nodes therefore open
the same 109 KB page and re-download it once per node (the cache is keyed by node id,
`controller.ts:499`).

## 2. What the toolkit already has, and where the seams are

- **Nodes**: `buildGraph` (`core/lib/graph.ts:86`) creates one node per typed document;
  edges come only from `document.edges`, parsed by `parseTopologyEdges` from the
  `# Topology` section (`core/lib/topology.ts:60`). Both shells — the exporter
  (`core/lib/exporter.ts`) and the Quartz emitter (`plugins/quartz-okf/src/index.ts:277`)
  — call the same `validateDocument` + `buildGraph`, so a pure extension in core reaches
  the bundle and the site at once (Constitution I).
- **Resolution**: `buildResolver` (`core/lib/resolver.ts:39`) maps a target to a document
  id by exact slug, `dir/name` folder forms, aliases, and a *short* map by basename that
  goes `null` on collision. That collision rule is the model for short row ids.
- **Fragments are dropped everywhere**: `WIKILINK_RE` (`topology.ts:3`) captures the
  target *without* its `#…`; `markdownLinkTarget` (`topology.ts:55`) splits it off;
  `convertWikilinks` (`topology.ts:100`) rewrites `[[note#x]]` to `/note.md` with no
  fragment. `[[herm-arm#AC001]]` in a Topology line resolves to the note today.
- **Contract**: `GraphNode` (`core/lib/types.ts:93`) has `slug, title, type, tags,
  description, path, aliases, properties, url, subgraph, federated`. No `label`. The
  explorer accepts `label` as an "older spelling" (`plugins/quartz-okf-explorer/lib/
  types.ts:21`, `lib/model.ts:18`) and draws it on the canvas (`hud/canvas/engine.ts:248`);
  `title` goes to tooltips, results and the selection bar.
- **`url` per node** exists since 001 and is honoured (`lib/model.ts:18`), but its
  meaning is a page: federation rewrites it as `${mount}/${node.slug}`
  (`core/lib/federation.ts:97,198`).
- **Focus and search**: `findNode` (`lib/focus.ts:22`) matches id, page url, then the
  last path segment; `matchNode` (`lib/search.ts:3`) matches title, label, id. Neither
  reads `aliases`.
- **Rendering hook**: a Quartz transformer may declare `htmlPlugins()` (rehype over hast,
  `quartz/plugins/types.ts:26-31`). `OkfTransformer` declares only `markdownPlugins`. All
  `htmlPlugins` run after `remark-rehype`, so a `<table>` produced by `remark-gfm` (order
  40) is already in the tree when quartz-okf's (order 15) html phase runs. `remark-rehype`
  runs with `allowDangerousHtml: true` (`quartz/processors/parse.ts:41`) and OFM adds
  `rehype-raw` (`obsidian-flavored-markdown/src/transformer.ts:580`), so an HTML comment
  in the source survives into the tree as a `raw` node (before OFM's html phase) or a
  `comment` node (after it).
- **Anchor slugs**: Quartz's OFM turns `[[note#Heading]]` into `note#githubSlug(Heading)`
  (`transformer.ts:280,301,394`, `github-slugger`). Verified outputs: `AC001 → ac001`,
  `BC002 Curriculum Planning → bc002-curriculum-planning`, `Área de Learning (L2) →
  área-de-learning-l2`, `**AC001** → ac001`. Heading ids come from `rehype-slug` in the
  GFM plugin with the same algorithm plus de-duplication among headings.
- **SPA router**: `navigate()` scrolls to the fragment's element after swapping the body
  (`quartz/components/scripts/spa.inline.ts:115-117`) and same-page hash clicks scroll
  too (`:163-165`). The consumer's extra script exists for the initial load and for the
  highlight; the plan verifies what is still needed on a consumer build.
- **Panels**: `BlastRadius` groups a page's edges by label and lists every neighbour
  (`plugins/quartz-okf-panels/src/components/scripts/blast-radius.inline.ts:80-95`). A
  catalogue note with 141 rows would list 141 entries under one label.
- **Frontmatter parser**: the core reads a YAML subset — scalars, lists of scalars, and
  inline `{a: b}` / `[a, b]`; nested block mappings throw (`core/lib/frontmatter.ts:82`).
  Anything declared in frontmatter must fit one inline mapping and must parse the same
  under Quartz's real YAML parser.
- **Fixture and CI**: `harness/fixture` is a five-note corpus built and asserted on every
  push (`harness/assert-fixture-graph.ts`); `expected-graph.json` pins nodes, edges,
  stats, types and edge labels.

## 3. The tables the first consumer actually has

Three shapes in one repository, which is what a generic declaration has to absorb:

| Note | Header | Row example | Observation |
|---|---|---|---|
| `herm-arm.md` (30 tables) | `Código \| Componente \| Glosa \| Ejemplos de producto` and `Código \| Application Capability \| Descripción` | `\| AC001 \| Student Recruitment \| … \|` | Clean id column; the table's parent (`AP001`) is a bold paragraph *above* the table, not a column |
| `herm-drm.md` (26 tables) | `Código \| Entity \| Alternative Names \| Sub-Classes \| TOGAF \| Descripción` | `\| DE161 \| **Programme of Learning** \| … \|` | Clean id; label cell carries markdown emphasis |
| `herm-bcm.md` (30 tables) | `L2 \| Qué hace` | `\| BC002 Curriculum Planning \| … \|` | **Id and name share one cell**; the 29 L1 capabilities are not rows at all but bold paragraphs (`**BC001 — Curriculum Management (L1).**`) |
| `gap-analysis-arm.md` (15 tables) | `Código \| Componente \| Clasif. \| Comentario` | `\| AC096 \| … \| ⚪ \| … \|` | A table *about* rows declared in another note; the value to carry is a symbol the consumer maps to a state |

Not one of the other consumers has a coded table today (PAFE 19 tables, perennialismo 7,
marketing 5 — none with an id column), so the design is driven by this corpus and kept
free of its vocabulary.

## 4. Decisions

**D1 — The feature is the toolkit's, split along its existing seams.** Extraction and
graph shape in `core/lib` (pure); anchors in the `quartz-okf` transformer (rehype);
reading and focus in the explorer; grouping in the panels. No new plugin: a consumer
adopts by ref bump and a marker in its notes (SC-004 of 001 as the bar).
*Rejected*: keeping it as a consumer script — the dock, the focus and the panels cannot
be fixed from outside the toolkit, and a second consumer would copy the Python.

**D2 — A table becomes a catalog by an explicit marker right above it.**
`<!-- okf:rows … -->` as an HTML comment: invisible in Quartz and Obsidian, local to the
table it governs, no YAML nesting, and nothing turns into a node by accident. Note-level
defaults live in frontmatter under one inline mapping (`okf_rows: { id: Código, … }`) so
a note with thirty tables writes the column mapping once.
*Rejected*: selecting tables by header (`herm-arm.md` has a metamodel table whose
`Código` column holds `ADxxx` placeholders — a silent false catalog); a list of catalogs
in frontmatter matched to tables by order (fragile under edits); a `# Rows` section in
the Topology style (a table is where it is read, the declaration must sit next to it).

**D3 — Identity: `slug = <note-slug>#<anchor>`, `anchor = githubSlug(id)`.** One slug
form, unique by construction, regenerable without a corpus-wide registry, and equal to
what Quartz produces for `[[note#ID]]` and to the `id` attribute the row gets — the
three agree with no coordination. The raw id (`AC001`) is registered as an alias, so
`[[AC001]]`, `?focus=AC001` and a `Part of: AP001` cell resolve while the id is unique in
the corpus; a collision makes the short form unresolved, exactly like short note names
today. `url = /<note-slug>#<anchor>`, which federation's `${mount}/${slug}` rewrite
already keeps correct.
*Rejected*: slug = raw id (collides with note slugs and across catalogs; the explorer
would derive `url: /AC001`); slug = `<note>/<id>` (reads as a page that does not exist).

**D4 — The anchor slug is implemented in core, characterised against `github-slugger`.**
Core has no runtime dependencies; the algorithm (lowercase, strip everything that is not
a Unicode letter, number, space, hyphen or underscore, spaces to hyphens) is small and the
tests pin it to the verified outputs in §2. Row anchors are checked against the note's
heading anchors (`catalog/anchor-collision`) because `rehype-slug` de-duplicates among
headings only.

**D5 — Column mapping is by header text; the id cell may need a pattern.** `id`
(required), `label`, `description`, `properties` (`Column`, or `Column=key` to rename)
name columns by their header. `pattern` is a regular expression with named groups `id`
and optional `label`, applied to the id cell's plain text, for tables like the BCM's
`BC002 Curriculum Planning`. Property keys default to the header text; the consumer
renames what its modes read (`colorBy.property`).
*Rejected*: requiring clean id columns (185 BCM rows rewritten for the tool's
convenience); positional columns (a reorder silently changes the meaning).

**D6 — Edges: containment by default, table-wide clauses, and edge-label columns.**
(a) Every row is `Part of` the note that holds it unless the table says `edge=none` or
another label — the containment is a fact of the page and makes the graph connected by
construction. The default label comes from the base profile the consumer inherits and is
validated against its `edgeLabels`, the same precedent 001 set for federation's
`Contains`. (b) Clauses after the key list use the Topology grammar
(`Part of: [[AP001]]`) and apply to every row of the table — this is how a table's parent
that lives in the paragraph above it is declared. (c) A column whose header is an edge
label of the profile declares per-row edges from that cell. All three go through the
Topology resolver, derive inverses and report unresolved targets as today.
*Rejected*: a `parent=` key (one special case of (b), and a word the engine would own);
inferring the parent from the preceding bold paragraph (format-specific magic).

**D7 — A table may annotate nodes declared elsewhere (`ref=` instead of `id=`).** Its
rows resolve to existing nodes (rows or notes); the table contributes `properties` to
them and an edge from the annotating note to each with the label the table names
(`edge` is required for `ref` tables — no default, because the relation is knowledge, not
containment). Unresolved refs and conflicting property values are errors in strict mode.
This replaces the consumer's gap-analysis parser and generalises it: any note that holds
a table *about* catalog entries enriches them. Ordered after all `id` tables so a row can
be annotated in the same build that creates it.

**D8 — The reading dock cuts to the anchored fragment, from knowledge, not guessing.**
With a fragment: a row (`[data-okf-node]`) is shown as its table's `<thead>` plus that
`<tr>`; a heading is shown as its section up to the next heading of equal or higher
level; an unknown anchor falls back to the whole article with a console warning. Pages
are fetched and cached by path, so the 141 rows of one note share one download.

**D9 — Additive contract.** Node `label` (short text the canvas draws; defaults to
`title`), node `row { note, anchor }` marker (a tool can tell rows from notes without a
type convention, like `federated`/`subgraph`), `stats.rows`. `stats.notes` keeps the
meaning federation already gave it — the node count — and `stats.rows` says how many of
them are rows. Nothing existing changes meaning (Constitution VII).

**D10 — Parity across bundle, site and federation.** `convertWikilinks` keeps fragments
(`[[note#ID]]` → `/note.md#anchor`) so the bundle's links reach rows too;
`okf-export` produces the same row nodes as the site; federation needs no change but
gains a test that pins `/mount/note#anchor` and that `preview` may select rows.

**D11 — Out of scope, with the reason.**
- *Citations inferred from prose* (a bare `AC001` in a paragraph becoming an edge): that
  is a domain regex; the engine reads edges from Topology only. The consumer keeps a
  linkifier if it wants one, and declares `Cites` in Topology (the reference profile
  already carries the label).
- *Short `[[ID]]` wikilinks rendered by Quartz*: OFM resolves them per file and has no
  corpus index at parse time; a pre-parse index step is a follow-up. Qualified
  `[[note#ID]]` works today with no toolkit change and is what the spec relies on.
- *Rows from bold paragraphs* (BCM L1): the consumer writes them as a table.
- *Popover previews of row links* and *Quartz's own search* indexing rows.

## 5. Adoption cost for the first consumer (estimate, to be confirmed in the plan)

- `okf.config.mjs`: add the row types to `profile.types`; point the explorer at the site
  graph (drop `graphInput`); modes keep filtering by `edges`/`sourceType`/`colorBy`.
- Notes: one marker per table (≈86 tables), one `okf_rows` default per note, a `pattern`
  for the BCM, the 29 BCM L1 capabilities rewritten as tables, a clean state column in
  the gap analysis with a `ref=` marker, `Cites` lines in the Topology of the transversal
  notes (or generated by the reduced linker).
- Deleted: `herm-to-okf.py`, the graph half of `herm-linker.py`, the anchor script in
  `inject-sidebar.py`, `herm-graph.json` and `herm-okf-graph.json` from `postBuild`,
  `herm-codes.json` once the tables are the source.
