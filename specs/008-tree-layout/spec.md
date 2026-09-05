# Feature Specification: Tree layout for hierarchical modes

**Feature Branch**: `008-tree-layout`
**Created**: 2026-09-05
**Status**: Implemented
**Input**: User description: "A mode whose edges form a hierarchy — a standard's
taxonomy, an organisation chart, a folder of catalogues — is drawn today with the same
springs as a citation network, and the consumer tunes `charge`, `gravity` and per-label
tensions by eye until the 420 codes stop looking like a tangle. The explorer should know
a tree when the mode declares one: place it on rings by depth, deterministically, with no
numbers to tune, and keep the notes that are not part of the hierarchy near what they
cite. Every node stays on screen: no progressive disclosure." Research and decisions:
[research.md](research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declare the hierarchy and read it as a radial tree (Priority: P1)

A consumer writes `tree: "Part of"` on a mode. The explorer draws that mode as a radial
tree: the root at the centre, one ring per depth, leaves evenly spaced on the outer ring,
siblings side by side in the order the corpus gives them, each subtree inside the angular
sector of its parent. Nodes on screen that are not part of the hierarchy — the notes that
cite entries of the standard — are born near the entries they touch and settle freely.
The reader may drag a tree node to look behind it; on release it returns to its place.

**Why this priority**: it is the feature. Without it the consumer keeps tuning springs and
the client keeps seeing a tangle.

**Independent Test**: build a view whose links under one label form a three-level tree,
run the layout and assert: the root sits at the centre, every node's radius equals its
depth's ring, leaves on the outer ring are equidistant in angle, children fall inside the
parent's sector, the same input yields the same output; in the engine, a node with a
placement is pinned and a node without one is seeded at the centroid of its placed
neighbours.

**Acceptance Scenarios**:

1. **Given** a mode with `tree: "Part of"` whose `Part of` links form a tree with one
   root, **When** the view is set, **Then** the root is at the canvas centre, nodes at
   depth `d` sit on ring `d`, and the outer ring holds the leaves at equal angular steps.
2. **Given** siblings appearing in the corpus as `AP021, AP001, AP004`, **When** laid
   out, **Then** they are placed in that order along their parent's sector, contiguous.
3. **Given** a note that cites three entries of the tree and no `Part of` edge, **When**
   the view is set, **Then** it starts at the centroid of those three entries and is not
   pinned.
4. **Given** a pinned node dragged away, **When** the pointer is released, **Then** the
   node is back at its layout position.
5. **Given** the same forest reached through two modes (the taxonomy alone, then the
   taxonomy with the notes that cite it), **When** the mode changes, **Then** the tree
   nodes keep their positions and only the notes move.

---

### User Story 2 - Rings by depth as the softer layout (Priority: P2)

A consumer prefers the organic look, or the hierarchy is imperfect. With
`tree: { edge: "Part of", layout: "rings" }` the nodes settle on the same rings by depth
but move freely along them; the springs still pull siblings together and cross-links
still bend the drawing.

**Why this priority**: same computation as the tree, one force instead of a pin; it is
the layout for hierarchies that a strict tree would misrepresent.

**Independent Test**: set a view with the rings layout and assert that no tree node is
pinned and that the radial force targets each node's depth ring.

**Acceptance Scenarios**:

1. **Given** `layout: "rings"`, **When** the view is set, **Then** tree nodes have no
   `fx`/`fy` and the simulation carries a radial force whose target for a node is its
   depth's ring radius.
2. **Given** a consumer that also declares `layout.radial.byType`, **When** a mode has a
   `tree`, **Then** the depth ring wins for hierarchy nodes and the type ring still
   applies to the rest.

---

### User Story 3 - Honest degradation (Priority: P3)

The declared edge does not always form a tree. A node may sit under two parents, a
subtree may be cut away by the reader's filters, a cycle may exist, or the mode may keep no
edge of that label at all. The explorer draws the best it can and says what it did.

**Why this priority**: Constitution V. A layout that silently falls back to springs
hides an authoring error the consumer would want to fix.

**Independent Test**: feed the hierarchy builder a node with two parents, a cycle and a
label absent from the links; assert the shared node is placed under its first parent and
reported, the cyclic nodes are reported and left loose, and the absent label yields no
hierarchy.

**Acceptance Scenarios**:

1. **Given** a node with two parents under the edge, **When** the hierarchy is built,
   **Then** it is placed under the parent that appears first and listed in `shared`; the
   engine logs one warning naming the mode, the edge and the node count.
2. **Given** a cycle under the edge, **When** built, **Then** its nodes are listed in
   `cyclic`, left out of the tree and seeded like any loose node; the engine warns.
3. **Given** a mode whose kept links carry no edge of that label, **When** the view is
   set, **Then** the mode is drawn as a force graph and the engine warns once.
4. **Given** a filter that removes a parent, **When** the view is rebuilt, **Then** its
   children become roots of their own subtrees and share the centre ring.

---

### Edge Cases

- One node and no links: the node sits at the centre.
- Several roots: a virtual centre; the roots share the first ring by their leaf counts.
- The edge is declared from parent to child (`Contains`) instead of child to parent
  (`Part of`): the orientation is chosen as the one in which fewer nodes have several
  parents; a tree reads the same either way.
- Derived inverse edges are in the view alongside the declared ones: only the links whose
  kind is the declared edge are read.
- A resize recentres pinned positions with the rest.
- `prefers-reduced-motion` changes nothing here: positions are computed, not animated.
- Federation: `tree` travels with the child's `display.modes`, so a subgraph explored from
  the parent is drawn as its own consumer declared it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `ExplorerMode` gains an optional `tree`: either the edge label as a string
  or `{ edge, layout? }` with `layout` in `radial` (default) or `rings`. The option is
  additive; modes without it behave as today.
- **FR-002**: The hierarchy and the placement are pure functions in
  `plugins/quartz-okf-explorer/lib/tree.ts`, tested with `node --test`, with no
  dependency beyond the view types: `hierarchyOf(nodes, links, edge)` and
  `radialLayout(hierarchy, options)`.
- **FR-003**: `hierarchyOf` reads only the links whose kind is the declared edge, picks
  the orientation with fewer multi-parent nodes, assigns each node its first parent,
  computes depth as the distance from the nearest root, and reports `shared` (several
  parents), `cyclic` (unreachable from any root) and `loose` (on screen, not in the
  hierarchy). It returns `null` when no link carries the edge.
- **FR-004**: `radialLayout` places the single root at the centre (or several roots on
  the first ring around a virtual centre), one ring per depth at equal distances, and
  angles by leaf-proportional sectors so leaves are equidistant on the outer ring and
  siblings keep the order of the view. The outer radius is the larger of what the leaf
  spacing needs and a minimum ring step times the depth; the spacing derives from the
  nodes' drawn sizes, never from a consumer number.
- **FR-005**: With `layout: "radial"` the engine pins hierarchy nodes (`fx`/`fy`) at
  their placement; a drag moves the node and its release restores the pin. With
  `layout: "rings"` nothing is pinned and a radial force targets each node's depth ring,
  taking precedence over `layout.radial.byType` for hierarchy nodes.
- **FR-006**: A node without a placement and without a previous position is seeded at
  the centroid of its placed neighbours in the view's adjacency; with none, as today.
- **FR-007**: Every degradation logs one `console.warn` naming the mode and the edge:
  no hierarchy, shared parents (with the count), cycles (with the count).
- **FR-008**: The engine names no consumer, type or label; the hierarchy edge comes from
  the mode.
- **FR-009**: `plugins/quartz-okf-explorer/README.md` documents `tree` under Shape and
  `CLAUDE.md` records the pinning and its degradation paths.
- **FR-010**: The harness fixture declares a tree mode so the smoke build exercises the
  option end to end; a real consumer build is verified in a browser before the ref bump.

### Key Entities

- **Hierarchy**: the forest a mode's links form under one edge — roots, parent, children
  in view order, depth, plus what did not fit (`shared`, `cyclic`, `loose`).
- **Placement**: a node's ring and angle, resolved to canvas coordinates.
- **Tree option**: the consumer's declaration on a mode — the edge and the layout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Singular Solving's taxonomy mode shows its 424 nodes on five rings with no
  layout numbers written for it, and the coverage mode keeps its colouring on the same
  tree.
- **SC-002**: Every path of FR-003 and FR-007 is covered by a test; the layout is
  deterministic under test.
- **SC-003**: The HUD audit on a consumer build reports no explorer warning in the
  console for the tree modes, and mobile and keyboard checks still pass.
- **SC-004**: `npm test` and `npm run typecheck` stay green; the fixture smoke build
  stays green with a tree mode declared.

## Assumptions

- A hierarchy worth a tree has one dominant containment edge; a mode with two competing
  hierarchies declares one and reads the other as cross-links.
- Every node of the mode stays on screen; legibility comes from placement and the
  camera, not from hiding (decision of the repository owner, 2026-09-05).
- Sibling order is the order the view gives, which follows the graph document and thus
  the order the corpus wrote its rows and notes; the engine sorts nothing.
- Labels are unaffected: the existing visibility rules by zoom and focus apply.
