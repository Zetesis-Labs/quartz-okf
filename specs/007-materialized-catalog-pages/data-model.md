# Data Model: Materialized catalog pages

**Feature**: `007-materialized-catalog-pages` | **Date**: 2026-09-04

## Marker

```markdown
<!-- okf:rows type=control id=ID label=Name page=Ficha -->

| ID | Name | Ficha |
|---|---|---|
| CIS-01 | Inventory | [[controls/inventory]] |
| CIS-02 | Software | |
```

`page` names a column. A non-empty cell yields one raw internal target on `CatalogRow`.

## Core additions

```ts
interface CatalogRow {
  // existing fields
  page?: string
  row?: number
}

interface RowMarker {
  note: string
  anchor: string
  page?: string
}

interface Materialization {
  row: CatalogRow
  catalog: ValidatedDocument
  page: ValidatedDocument
}

interface MaterializationIndex {
  byRow: Map<string, Materialization>
  byPage: Map<string, Materialization>
  problems: MaterializationProblem[]
}
```

The row's source row number is retained for corpus-wide diagnostics. `byRow` selects the
page while building the row node; `byPage` suppresses the physical note node and remaps
its outgoing relations.

## Emitted node

```json
{
  "slug": "standards/arm#ap012",
  "type": "arm",
  "title": "AP012 — Digital Identity",
  "url": "/standards/arm/digital-identity",
  "path": "standards/arm.md",
  "row": {
    "note": "standards/arm",
    "anchor": "ap012",
    "page": "standards/arm/digital-identity"
  }
}
```

There is no node with slug `standards/arm/digital-identity`.

## Diagnostics

| Code | Meaning |
|---|---|
| `catalog/page-multiple` | one cell names more than one target |
| `catalog/page-unresolved` | target is missing, reserved, ambiguous or not a note |
| `catalog/page-duplicate` | two rows claim the same note |
| `catalog/page-self` | a row claims its containing catalog note |
| `catalog/page-type-conflict` | page type differs from row type |
