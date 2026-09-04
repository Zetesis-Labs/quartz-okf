# Data Model: Catalog rows as nodes

**Feature**: `006-catalog-rows` | **Date**: 2026-09-04

All additions to `okf-graph/v1` are additive (Constitution VII).

## 1. The marker

```markdown
<!-- okf:rows type=component id=Código label=Componente properties="Glosa=gloss, Ejemplos=products" -->

| Código | Componente | Glosa | Ejemplos |
|---|---|---|---|
| AC001 | Student Recruitment | … | … |
```

Grammar: `<!-- okf:rows [key=value]* [; Label: targets]* -->`. Values are bare (no
spaces) or double-quoted. Clauses are separated by `;` and follow the Topology line
grammar (`Label: [[target]], [[target]]`). The marker sits on the line above the table;
blank lines between them are allowed, prose is not.

| Key | Meaning | Default |
|---|---|---|
| `type` | Node type of every row | required (or inherited) |
| `id` | Header of the identifier column — makes the table *create* rows | one of `id`/`ref` required |
| `ref` | Header of the column naming an existing node — makes the table *annotate* | — |
| `label` | Header of the column that names the row | none (title is the id alone) |
| `description` | Header of the description column | none |
| `properties` | Comma-separated headers; `Header=key` renames | none |
| `pattern` | Regular expression over the identifier cell with named groups `id` and optional `label` | none |
| `edge` | Containment edge row → note (`none` suppresses it); for `ref` tables, the edge note → target | `Part of`; required for `ref` |

Note-level defaults, one inline mapping (the core's YAML subset):

```yaml
okf_rows: { type: component, id: Código, label: Componente }
```

A marker's key overrides the note's default; `properties` and clauses do not merge —
the nearest declaration wins.

## 2. Core contracts (pure)

```ts
// core/lib/anchor.ts
anchorSlug(value: string): string          // github-slugger's algorithm; "" when nothing survives

// core/lib/catalog.ts
parseMarker(line: string): MarkerDeclaration | null      // { keys, clauses }
findCatalogs(body: string): FoundCatalog[]               // { keys, clauses, header, rows, index, line }
cellText(cell: string): string                           // plain text of a markdown cell
cellTargets(cell: string): string[]                      // wikilinks, else comma-separated tokens
catalogsOf(document: Document, options: CatalogOptions): CatalogResult
```

```ts
interface CatalogOptions {
  /** Frontmatter defaults (`okf_rows`), already parsed. */
  defaults?: Record<string, string>
  /** Column headers that declare edges: the profile's labels. */
  edgeLabels?: readonly string[]
  /** Anchors already taken by the note's headings, to report collisions. */
  headingAnchors?: readonly string[]
}

interface CatalogResult {
  rows: CatalogRow[]
  annotations: CatalogAnnotation[]
  problems: CatalogProblem[]          // { code, message } — rules.ts gives them a level
  tables: number                      // marked tables seen, for the skipped-tables summary
}

interface CatalogRow {
  id: string                          // raw, as written in the cell
  anchor: string                      // anchorSlug(id)
  slug: string                        // `${document.id}#${anchor}`
  type: string
  title: string                       // `${id} — ${label}` or the id alone
  label: string                       // the id: what the canvas draws
  description?: string
  properties?: Record<string, unknown>
  edges: TopologyEdge[]               // containment, clauses, column edges
  table: number                       // 1-based position among the note's tables
}

interface CatalogAnnotation {
  ref: string                         // the cell as written
  edge: string
  properties: Record<string, unknown>
  table: number
}
```

`catalogsOf` never throws: everything it cannot do becomes a `CatalogProblem`.

## 3. Rules

Reported through the existing violation machinery (`rules.ts`), `error` by default,
message naming file, table (1-based) and row where each applies:

| Rule | When |
|---|---|
| `catalog/marker-invalid` | the comment is not parseable, or declares neither `id` nor `ref`, or both |
| `catalog/table-missing` | a marker with no table under it |
| `catalog/type-missing` | no `type` in the marker or the note's defaults (creating tables) |
| `catalog/column-unknown` | a declared header (`id`, `ref`, `label`, `description`, a property) is not in the table |
| `catalog/id-empty` | an identifier cell is empty, or slugs to nothing |
| `catalog/id-duplicate` | two rows of the same note produce the same anchor |
| `catalog/pattern-invalid` | `pattern` does not compile, or has no `id` group |
| `catalog/pattern-nomatch` | a cell does not match `pattern` |
| `catalog/anchor-collision` | a row anchor equals one of the note's heading anchors |
| `catalog/edge-required` | a `ref` table without `edge` |
| `catalog/ref-unresolved` | an annotation's ref resolves to no node (cross-document) |
| `catalog/property-conflict` | two annotations write different values to one property (cross-document) |

`type` and edge labels reuse `profile/type-closed` and `profile/edge-label-closed`.

## 4. Document and graph additions

`ValidatedDocument` gains `rows: CatalogRow[]` and `annotations: CatalogAnnotation[]`.

Row node in `okf-graph/v1`:

```json
{
  "slug": "standards/arm#ac001",
  "title": "AC001 — Student Recruitment",
  "label": "AC001",
  "type": "component",
  "description": "Attracting and engaging prospective students.",
  "path": "standards/arm.md",
  "aliases": ["AC001"],
  "properties": { "gloss": "…", "state": "core" },
  "url": "/standards/arm#ac001",
  "row": { "note": "standards/arm", "anchor": "ac001" }
}
```

- `label` (new): short text for the canvas; absent when equal to `title`.
- `row` (new): the page a node lives inside and its anchor there.
- `stats.rows` (new): how many nodes are rows. `stats.notes` keeps its meaning (the node
  count) as federation already left it.

Edges are ordinary edges: `standards/arm#ac001 → Part of → standards/arm` with the
derived `Contains`, plus whatever the clauses and columns declare. Annotations add
`analysis/gap → About → standards/arm#ac001` and merge properties into the target node.

## 5. Resolution

`buildResolver` registers, for every row: the exact slug `note#anchor`, the alias `id`
(short map, `null` on collision) and `note#id` in any case spelling. A target carrying a
fragment resolves as `<resolved note>#<anchorSlug(fragment)>` when that row exists, and
falls back to the note when it does not (today's behaviour). `convertWikilinks` writes
`/note.md#anchor` for a target with a fragment.

## 6. Rendering

The transformer's html phase walks the document's tables in order and takes the `i`-th for
the rows the core numbered `i`. Inside it, each row is matched by the identifier it must be
holding, scanning forward from the last match, so a row the core dropped (an empty id, a
duplicate) shifts nothing; the matched `<tr>` gets `id="<anchor>"` and
`data-okf-node="<slug>"`, and the table is marked `data-okf-catalog`. A row that cannot be
found is a warning naming the note, the table and the id. The
plugin ships one CSS rule so `:target` rows are visibly highlighted.
