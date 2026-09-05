# Research: Tree layout for hierarchical modes

**Feature**: `008-tree-layout` | **Date**: 2026-09-05

## 1. What the engine does today

- `plugins/quartz-okf-explorer/src/hud/canvas/engine.ts:208-227` builds one d3-force
  simulation per view: `forceLink` with per-label tensions from the consumer's
  `layout.link`, `forceManyBody` (`charge`), `forceX/Y` (`gravity`), `forceCollide`, and
  an optional `forceRadial` keyed by node **type** (`layout.radial.byType`).
- `seed()` (`:173-191`) inherits positions from the previous view and spirals the new
  nodes around the centre. `recentre()` (`:146-161`) shifts `x/y` and `fx/fy` on resize.
- Drag (`:524-555`) pins the node with `fx/fy` while dragging and nulls them on release.
- `buildView` (`lib/view.ts`) keeps the edges a mode names and the nodes those edges
  touch; declared and derived inverse edges both reach the view.
- Singular Solving's `okf.config.mjs` carries the evidence of the problem: `charge: -55`,
  `gravity: 0.045`, `link["*"] = { distance: 30, strength: 0.65 }` and long slack springs
  for `Cites`/`About`, with the comment "sin esto los 420 códigos salen como una maraña".

## 2. Decisions

### The mode declares the edge; the engine detects orientation

`tree: "Part of"` is data in the consumer's config (Constitution IV). The engine does
not know whether the label runs child→parent or parent→child, and the view carries both
the declared edge and its derived inverse. The orientation is chosen as the one in which
fewer nodes have several parents: a tree under `Part of` has zero in child→parent and
many in parent→child. A consumer may therefore declare either label of the pair.

Alternative rejected: autodetecting the label that forms a forest. Convenient, but a
mode with two hierarchies would pick one in silence.

### Radial tidy tree, implemented in `lib/`

Angles by leaf-proportional sectors (each subtree owns an angular sector proportional to
its leaf count; a node sits at the middle of its sector), rings by depth. It is the
classic radial tree, ~60 lines, deterministic, and it runs under `node --test` with no
build. `d3-hierarchy` was rejected: it would be the first runtime dependency of a pure
module and its tidy algorithm optimises for a different reading (the dendrogram).

### Pinned by default, rings as the softer option

The owner chose both. Pinning (`fx/fy`) makes the tree the truth: cross-links and
collisions do not distort it, and a release after a drag snaps the node back. Rings by
depth keep nodes free on their ring so the springs still express siblings and
cross-links. They share the computation; `rings` only swaps a pin for a `forceRadial`.

### Loose nodes start at the centroid of what they touch

The notes that cite entries are not in the hierarchy. Seeding them at the centroid of
their placed neighbours puts a note about one capability next to it and a note about the
whole standard in the middle, which is what a reader expects; the springs then settle
them and `forceCollide` keeps them off the rings. An outer ring reserved for loose nodes
was considered and rejected: longer edges, and it would pretend the notes have a depth.

### No progressive disclosure

Rejected by the owner on 2026-09-05: every node of a mode stays on screen. Legibility
comes from placement and from the camera the reader already has.

### Spacing derives from drawn sizes

The arc a leaf needs on the outer ring is twice its drawn radius plus a gap; the outer
radius follows from the leaf count. The consumer writes no number. Interior rings are
evenly spaced between centre and outer ring; a very unbalanced tree may crowd an inner
ring, which is visible and acceptable for a first version.

## 3. Verified facts

- `ViewLink.source/target` are strings when `setView` receives the view and node objects
  after d3 binds the links (`lib/types.ts:98-104`); the hierarchy is computed before the
  simulation is created, so it reads strings, and accepts either for safety.
- `ViewNode` objects are new on every `buildView`, so `fx/fy` never leak from a tree mode
  into a force mode; positions are inherited explicitly by `seed()`.
- `HudDisplay.modes` comes from the consumer options or, inside a subgraph, from the
  child's `display.modes` (`lib/display.ts:25,58`): an additive mode field travels
  through federation with no change.
- The label rules (`lib/canvas-rules.ts`) decide visibility by zoom, focus and size, so
  the spacing need not reserve room for labels.

## 4. Found while proving it on a consumer

- **Framing a selection put the node at the edge of the frame.** `frame()` fitted the
  bounding box of the node and its neighbours; in a tree the neighbours lie to one side,
  so the selected node landed off-centre. `aroundNode` (`lib/viewport.ts`) frames a
  square centred on the node instead. In a force layout the two coincide closely.
- **The frame was computed before the selection card existed.** `select()` sets the
  signal and framed at once; the card joins the island stack on the next render and
  shrinks the free hole the frame is centred in. On a phone the node ended 60px below
  the centre. The old build passed the HUD audit only because a force layout leaves a
  dimmed node under any tap; the tree leaves that spot empty. The frame now waits one
  animation frame (`controller.ts`, `select`).
- **A corpus may give the standard two containers.** In Singular Solving, `analisis/herm`
  is contained by the `analisis` folder note and by the organisation that publishes it,
  so in the mode that keeps every note it has two parents under `Part of` and is placed
  under the first, with the warning naming it. The consumer decides whether that mode is
  a tree at all.
- **`rings` reads worse than the pinned tree on 484 nodes**: cross-links drag whole
  subtrees around their ring. It stays as the softer option; the consumer's hierarchical
  modes use the pinned tree.
