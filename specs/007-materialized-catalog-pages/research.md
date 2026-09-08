# Research: Materialized catalog pages

**Feature**: `007-materialized-catalog-pages` | **Date**: 2026-09-04

## Decisions

### The row is canonical; the page is a representation

The existing row slug is stable and already used by annotations, qualified links and
federated graphs. Replacing it with the page slug would break identity when content is
moved. The graph therefore keeps `<catalog>#<anchor>` and changes only the reading URL.

### The association is an explicit column

`page=Ficha` follows the existing marker grammar and makes optionality visible per row.
Inferring associations from filenames or titles was rejected because it creates silent,
domain-dependent identity decisions.

### Valid associations are one-to-one and type-preserving

Two rows claiming one page or a page changing the row's type would make the symbolic
identity ambiguous. Both are build errors. A row claiming its own catalog note is also
rejected because it creates a self-referential representation.

### Detail-page relations are remapped, not copied

The page node is suppressed. Its declared edges and annotations are emitted directly
with the row slug as source. All resolver forms for the page return the row slug, so
incoming relations need no special-case rewriting.

### Existing row provenance stays compatible

`GraphNode.path` and `row.note` continue to identify the catalog source. The additive
`row.page` field names the detail note, and `url` points to it. This avoids changing the
meaning of an existing `okf-graph/v1` field.

### The panel resolves current pages by node URL

The explorer already opens `node.url`. The neighbourhood panel currently indexes only
by node slug; it must also index the path portion of node URLs so a materialized page
shows the unified row's relations and properties.

### Federation preserves an authored relative URL

The current federation fallback reconstructs every relative URL from `node.slug`, which
only happened to work because row URLs and row slugs matched. Mounting must prefix the
published `node.url` when present, falling back to the slug only when it is absent.
