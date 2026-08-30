# Feature Specification: Subgraph portals and open-node federation

**Feature Branch**: `001-subgraph-federation`  
**Created**: 2026-08-30  
**Status**: Draft  
**Input**: User description: "A knowledge graph can contain a special node that
represents another, separately maintained graph (for example, a CERN graph holding a
node for the CERN IT governance graph). The child graph marks some of its notes as
open, and those notes are previewed in the parent graph around the special node. The
feature belongs to the toolkit so every consumer gets it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish a portal to another corpus with its open notes (Priority: P1)

A corpus author maintains a broad graph (the parent) and wants one of its notes to
stand for a whole other graph (the child) that lives in its own repository and its own
site. The author writes an ordinary note for the portal, declares in `okf.config.mjs`
which published child graph it stands for and which of the child's notes count as
open, and rebuilds the site. The parent's graph now shows the portal node with the
child's open notes hanging from it; every one of those previewed nodes opens the
child's own page when clicked.

**Why this priority**: it is the whole feature. Without the build-time composition
there is nothing to explore or to keep in sync.

**Independent Test**: build a fixture parent corpus that federates a local child
bundle file and assert the emitted graph: the portal node is marked, the open child
nodes are present with namespaced identifiers and absolute URLs, the closed ones are
absent, and the edges between portal and previews exist in both directions.

**Acceptance Scenarios**:

1. **Given** a parent corpus with a note `it-governance` and a federation entry
   pointing at a child bundle where 3 of 10 notes carry `visibility: open`, **When**
   the site is built, **Then** the parent graph contains exactly 3 federated nodes,
   each with identifier `it-governance:<child-slug>`, an absolute `url` on the child's
   site and a `federated: "it-governance"` marker, and the portal node carries a
   `subgraph` marker with the child's statistics.
2. **Given** the same setup, **When** the graph is built, **Then** for each federated
   node there is a declared edge `it-governance → <node>` with the configured label and
   the derived inverse edge, exactly as if the edges had been written in a `Topology`
   section.
3. **Given** two open child notes linked to each other in the child's topology,
   **When** the parent is built, **Then** that edge is preserved between the two
   federated nodes; edges from an open note to a closed note are dropped.
4. **Given** a federation entry whose `node` does not exist in the parent corpus or
   whose `edge` label is not in the parent's `edgeLabels`, **When** the site is built in
   strict mode, **Then** the build fails with a message naming the subgraph id and the
   offending value.
5. **Given** a child bundle that cannot be fetched, **When** the site is built in strict
   mode, **Then** the build fails naming the subgraph id and the URL; in non-strict mode
   the portal is emitted without previews and a warning names what is missing.

---

### User Story 2 - Explore a subgraph from the parent and come back (Priority: P2)

A reader browsing the parent's explorer sees the portal node drawn differently from
ordinary notes and, hovering it, learns how many notes the child holds and how many are
previewed. From the portal's reading panel the reader enters the child graph in place,
explores it with the usual filters, and returns to the parent with one action, landing
where they left.

**Why this priority**: the composition is useful on its own (the previews already link
to the child site), but the in-place dive is what makes a federation feel like one
graph.

**Independent Test**: build a fixture parent with a federated child, open the explorer
in a browser, and walk portal → enter subgraph → back, checking the graph swaps, the
breadcrumb names both graphs and the previous selection is restored.

**Acceptance Scenarios**:

1. **Given** the explorer of a parent with one portal, **When** the reader hovers the
   portal, **Then** the tooltip's second line reads the child's note count and the number
   previewed.
2. **Given** the portal's reading panel is open, **When** the reader activates "Explore
   subgraph", **Then** the canvas shows the child graph loaded from the parent's own
   site (no cross-origin request), with the child's types as filter pills, and the
   breadcrumb shows `<parent> › <child>`.
3. **Given** the reader is inside the child graph, **When** they activate the back
   action, **Then** the parent graph is shown again with the portal selected.
4. **Given** a federated node in the parent, **When** the reader clicks it, **Then** the
   reading panel opens the child's page; modifier-click opens it in a new tab.

---

### User Story 3 - Notice drift between parent and child (Priority: P3)

A maintainer of a parent corpus wants to know when the child graph moved on since the
parent was last built, because the previews are baked at build time.

**Why this priority**: the coupling is inherent to build-time federation; making it
visible is cheap and prevents stale previews from passing unnoticed.

**Independent Test**: federate a child bundle with `pin` set to a different
`source_head` than the bundle's and assert a warning naming the subgraph id, the pinned
head and the actual head.

**Acceptance Scenarios**:

1. **Given** a federation entry with `pin: "abc123"` and a child bundle whose
   `source_head` is `def456`, **When** the parent builds, **Then** a warning names
   `abc123`, `def456` and the subgraph id, and the build succeeds.
2. **Given** an entry without `pin`, **When** the parent builds, **Then** no drift check
   runs and the child's `source_head` is recorded on the portal's `subgraph` marker.

---

### Edge Cases

- A child slug that, once prefixed, would still collide with a parent slug (only
  possible if a parent note is literally named `<id>:<slug>`): the build fails naming
  both.
- A child bundle with no node matching the open filter: the portal is emitted with
  `previewed: 0`, no error; a warning names the subgraph so an empty preview is never
  silent.
- A child graph that itself contains portals: its `subgraph` markers are dropped in
  the parent (depth 1); nested federation is out of scope.
- A child note whose `url` is already absolute (a future child that publishes URLs):
  kept as is, never re-prefixed.
- The parent declares a topology edge from an ordinary note to a federated node
  (`[[it-governance:sso]]`): stays unresolved in v1 (see Assumptions).
- The explorer is opened directly on a subgraph URL (`?graph=it-governance`): loads the
  child graph with a back action to the parent.

## Clarifications

### Session 2026-08-30

- Q: Which corpus is the first parent to adopt the feature — a new umbrella
  `cern-graph`, or an existing corpus split into subgraphs? → A: a new umbrella
  `cern-graph` repository, with `cern-it-governance-graph` as its first child.

### Session 2026-08-30 (b) — after the first local demo

- Q: The demo fetched the child's graph from the child's site and linked previewed
  notes to that site — two independent services. Is that acceptable? → A: **No.** The
  composition must not require a second running service: the parent site mounts the
  child's corpus (notes and graph) inside itself, obtained from the child's repository
  at a pinned commit, the same way consumers pin the toolkit. Nothing at runtime
  depends on the child's site; the child does not even need to be deployed.
- Q: Is the navigation intuitive? → A: Not enough. Entering a subgraph must be
  discoverable from the node itself (double-click, and an action wherever the portal
  is shown), the camera must land on the child graph immediately, the child graph must
  be explored with the child's own colours and view modes, and the browser's back
  button must return to the parent.

Revision (b) supersedes FR-001, FR-003, FR-006, FR-007's role, FR-008's codes and
FR-010; the superseded wording is kept in `research.md` for the record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** *(rev. b)*: A consumer MUST be able to declare, in `okf.config.mjs`, a
  list of subgraphs; each entry names a local note (`node`), the child's repository
  (`repo`: a git URL or a local path), the commit to mount (`ref`, required for a
  remote repository), the child's corpus directory (`content`, default `content`),
  the edge label used from portal to previews (`edge`, default `Contains`) and the
  open-note filter (`preview.property` + `preview.equals`). The subgraph id defaults
  to the last segment of `node` and names the mount path `/<id>/`.
- **FR-002**: The build MUST mark the portal node with a `subgraph` object carrying the
  subgraph id, the mount path, the child's `source_head`, its note count, the number
  previewed and the same-origin path of the copied child graph.
- **FR-003** *(rev. b)*: The build MUST add every child node that matches the open
  filter as a node of the parent graph, with slug `<id>/<child-slug>` (its page in the
  parent site), a `federated` marker equal to the subgraph id, `url: /<id>/<child-slug>`,
  and the child's `type`, `title`, `description`, `tags` and `properties` untouched.
- **FR-004**: The build MUST add a declared edge from the portal to each federated
  node with the configured label, and derive its inverse with the parent's
  `inverseLabels`, using the same derivation as topology edges.
- **FR-005**: The build MUST keep child edges whose two ends are both federated,
  with their label preserved, and drop every other child edge.
- **FR-006** *(rev. b)*: A mount step (`okf-federate`, run by the site build before
  Quartz) MUST obtain each child at `ref`, export its corpus with the child's own
  profile, refuse a child that fails its own validation, write its notes under
  `content/<id>/` with bundle links rewritten inside the mount and frontmatter marked
  `okf_federated: <id>`, generate an index page for the mount, and write the child
  graph plus a manifest (head, remote head, display configuration) as build artifacts.
  The build MUST then copy the child graph to `static/okf-subgraphs/<id>.json` with
  every node `url` inside the mount and the child's display attached, so the explorer
  can load it same-origin.
- **FR-007**: The build MUST record `baseUrl` (the site's canonical origin) and
  `source_head` (the corpus commit, handed in by the harness) in every emitted
  `okf-graph.json`.
- **FR-008** *(rev. b)*: Configuration problems (unknown `node`, missing `repo`,
  missing `ref` for a remote repository, edge label outside the parent's vocabulary,
  duplicate subgraph ids, a mount path already used by the parent corpus) MUST fail
  the build in strict mode with a message naming the subgraph id and the value;
  missing mount artifacts MUST do the same, pointing at `okf-federate`.
- **FR-009** *(rev. b)*: When the mounted head differs from `ref` (`ref-drift`) or the
  child's remote moved past `ref` (`ref-behind`), the build MUST emit a warning naming
  the subgraph id and both heads, and MUST NOT fail.
- **FR-010** *(rev. b)*: The explorer MUST draw portal nodes distinguishably from
  ordinary nodes of the same type, label them always, say in their tooltip how to
  enter, and enter the child graph on double-click and from an action shown wherever
  the portal is selected (relation bar, reading panel). Entering MUST reset the camera
  and fit the child graph as soon as its layout takes shape, apply the child's colours,
  labels and view modes for as long as the reader stays, push a browser-history entry
  (`?graph=<id>`) so the browser's back button returns to the parent, and restore the
  parent with the portal selected and the previous mode.
- **FR-016** *(rev. b)*: While inside a subgraph the explorer MUST show, at the top of
  the canvas and before the relation bar of the selected node, the trail of graphs
  entered (`‹ parent › … › current`); every earlier level MUST be a link that returns
  to that graph in one action, and `‹` MUST go one level up. The trail MUST NOT be
  shown in the root graph.
- **FR-011**: The explorer MUST render federated nodes with a visible mark and route
  clicks to their absolute `url` through the existing reading panel and modifier-click
  behavior.
- **FR-012**: Per-corpus bundles produced by `okf-export` MUST remain unfederated;
  federation is a composition performed when a site is built.
- **FR-013**: Engine code MUST NOT depend on a specific node type or edge label name
  for any of the above; a consumer chooses to model portals with a `graph` type, or
  any other, in its profile.
- **FR-014** *(rev. b)*: Mounted notes are pages of the parent site but speak the
  child's vocabulary: the parent build MUST NOT validate them against its own profile
  nor include them in its own graph; their graph arrives through the mount artifacts.
- **FR-015** *(rev. b)*: The federated parent graph MUST carry, as a fallback, the
  union of its children's display configuration (type colours and labels, edge
  colours) so previewed notes read with the child's vocabulary where the parent
  declares none; the consumer's own declarations always win.

### Key Entities

- **Subgraph declaration**: the consumer's description of one child — id (derived from
  `node` unless given), portal note, graph location, site origin, edge label, open
  filter, pin.
- **Portal node**: an ordinary parent note that carries a `subgraph` marker in the
  graph after federation.
- **Federated node**: a copy of one open child node inside the parent graph,
  namespaced, marked and absolutely addressed.
- **Subgraph copy**: the child's whole graph republished under the parent site with
  absolute node URLs, the explorer's source when diving in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parent corpus federating a child with N open notes builds with exactly
  N federated nodes, 2N portal edges (declared + derived) and 0 unresolved edges added.
- **SC-002**: Every failure path in FR-008 is exercised by a test and produces a
  message containing the subgraph id; no failure path is silent.
- **SC-003**: From the parent explorer, reaching the child graph and returning takes
  two actions and no page load.
- **SC-004**: Adopting the feature in an existing consumer requires only a ref bump,
  one config block, one portal note and one line in its `quartz.ts`; no engine or
  corpus rewrite.
- **SC-005**: `npm test` stays green and needs no network: child bundles in tests are
  local files or injected fetchers.

## Assumptions

- *(rev. b)* Child repositories are reachable by git at build time (public GitHub, or
  a local path). A child that is also deployed as its own site stays independent; the
  parent never reads from it.
- *(rev. b)* Mounting publishes the whole child corpus under the parent site; the open
  filter governs what is previewed in the parent graph, not what is published. A
  parent must therefore only mount corpora it may publish.
- Federation depth is 1: a child's own portals are not followed.
- Parent notes cannot declare topology edges to federated nodes in v1; the only edges
  reaching them are the portal edges and preserved child edges. Qualified wikilinks
  (`[[id:slug]]`) are a candidate follow-up.
- The first parent consumer is a new umbrella corpus, `cern-graph`, holding a portal
  to `cern-it-governance-graph` (the child). The child is the first corpus to publish
  `baseUrl` and `visibility: open` notes. The PAFE wiki adopts later, with no
  federation declared at first.
- A database-backed federation (bundles ingested into a queryable store so the parent
  no longer needs rebuilding when the child moves) is a separate feature; this spec
  keeps federation at build time and makes drift visible instead (US3).
