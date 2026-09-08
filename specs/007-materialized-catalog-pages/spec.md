# Feature Specification: Materialized catalog pages

**Feature Branch**: `007-materialized-catalog-pages`
**Created**: 2026-09-04
**Status**: Implemented
**Input**: A catalog row may have a real authored Markdown page. The row and the page
must be one symbolic graph node: the row owns identity and structured catalog data;
the page supplies long-form reading and authored relations.

## User Scenarios & Testing

### User Story 1 - Open a catalog entity as a full page (Priority: P1)

An author adds `page=Ficha` to an `okf:rows` marker and places one internal link in
that column for selected rows. A reader opens such a row from the explorer and reads
the linked Markdown page. Rows with an empty cell still open their catalog fragment.

**Independent Test**: build a catalog with two rows, only one linked to a typed detail
note, and assert that both rows remain nodes while their URLs point respectively to the
detail page and the catalog fragment.

**Acceptance Scenarios**:

1. **Given** `page=Ficha` and `[[controls/inventory]]` in a row, **When** the graph is
   built, **Then** the row keeps slug `standards/cis#cis-01`, its URL is
   `/controls/inventory`, and its row marker records `page: controls/inventory`.
2. **Given** another row with an empty `Ficha`, **When** built, **Then** its URL remains
   `/standards/cis#cis-02`.
3. **Given** the materialized row in the explorer, **When** opened in the dock or a new
   tab, **Then** the authored detail page is loaded.

---

### User Story 2 - Treat row and page as one graph identity (Priority: P1)

Graph users must never see both a catalog row and its detail note. Links to the row id,
the qualified row, the detail page slug, its short name or its aliases all resolve to
the row slug. Relations authored on the detail page belong to that row.

**Independent Test**: give the page a topology edge and link another note to its page
slug; assert one node, both relations targeting or originating at the row slug, and no
edge mentioning the suppressed page slug.

**Acceptance Scenarios**:

1. **Given** a row backed by `controls/inventory.md`, **When** built, **Then** there is
   no graph node whose slug is `controls/inventory`.
2. **Given** topology authored in that page, **When** built, **Then** its source is the
   row slug.
3. **Given** a relation or annotation targeting `[[controls/inventory]]`, **When**
   built, **Then** its target is the row slug.
4. **Given** tags, aliases and a description on the detail page, **When** built, **Then**
   its description replaces the catalog summary and its tags and aliases augment the
   row node; the row still owns type, title, label and catalog properties.

---

### User Story 3 - Reject ambiguous materializations (Priority: P2)

An invalid association must stop a strict build with the file, table and row that made
the claim. It must never silently produce two identities or open the wrong page.

**Independent Test**: validate unresolved targets, multiple links, a page claimed by
two rows, a row claiming its own catalog note, and a page whose type differs from the
row; assert named `catalog/page-*` violations.

**Acceptance Scenarios**:

1. A non-empty page cell with zero or several internal targets is an error.
2. A target that is missing, reserved or ambiguous is an error.
3. Two rows may not claim the same page; a row may not claim its containing note.
4. The page must declare the same type as the row.
5. In non-strict mode an invalid association is ignored: the row keeps its catalog URL
   and the page remains an independent node, with a named warning.

### Edge Cases

- A blank page cell means that row deliberately has no materialized page.
- A materialized page may itself contain catalogs; its child rows remain graph nodes.
- A page URL with a heading fragment still resolves to the materialized row in graph
  topology, while browser navigation keeps the authored fragment.
- Federation prefixes the materialized page URL, not the row slug, when mounting a
  child graph.

## Requirements

### Functional Requirements

- **FR-001**: `page` is an additive reserved `okf:rows` key naming a table column and
  is valid only for an `id` catalog.
- **FR-002**: Each non-empty page cell MUST contain exactly one resolvable internal page
  target; empty cells are allowed.
- **FR-003**: The row slug remains canonical. A valid target page is omitted as an
  independent graph node and every graph resolution of that page maps to the row.
- **FR-004**: The row owns type, title, label, catalog properties and catalog location.
  The page contributes its description, tags, aliases and authored edges.
- **FR-005**: Page and row types MUST match; one page MUST NOT back multiple rows; a row
  MUST NOT use its containing catalog note as its page.
- **FR-006**: `GraphNode.row` MAY carry an additive `page` slug. Existing rows without
  pages and existing consumers remain byte-for-byte compatible apart from ordering-free
  graph metadata.
- **FR-007**: Relative URLs of materialized pages MUST survive federation mounting.
- **FR-008**: All invalid associations MUST be named `catalog/page-*` diagnostics and
  MUST fail strict builds.

### Key Entities

- **Catalog row**: canonical symbolic identity and structured record.
- **Materialized page**: authored Markdown representation associated one-to-one with a
  catalog row.
- **Materialization index**: validated row-to-page and page-to-row mappings used by the
  resolver and graph builder.

## Success Criteria

- **SC-001**: A mixed catalog can expose detail pages for selected rows without changing
  the identity or behavior of the remaining rows.
- **SC-002**: The emitted graph contains exactly one node for every valid row-page pair.
- **SC-003**: No emitted edge uses a suppressed page slug as source or target.
- **SC-004**: Every invalid association is caught by an automated regression test.
- **SC-005**: Singular Solving materializes AP012 and its complete site passes the graph
  invariant check with zero unresolved edges.

## Assumptions

- Markdown files remain the only authored content store; the table stores a link, not
  the page body.
- V1 associations are explicit in a column. Filename or title similarity is never used.
- The physical page remains renderable and addressable by Quartz even though OKF emits
  no independent graph node for it.
