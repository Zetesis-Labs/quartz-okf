# Data Model: Tree layout for hierarchical modes

**Feature**: `008-tree-layout` | **Date**: 2026-09-05

## Contract (`core/lib/types.ts`)

```ts
export interface TreeOptions {
  /** The edge whose links form the hierarchy, in either direction of the pair. */
  edge: string
  /** `radial` (default) pins the tree; `rings` keeps nodes free on their depth ring. */
  layout?: "radial" | "rings"
}

export interface ExplorerMode {
  // existing fields
  tree?: string | TreeOptions
}
```

## Pure module (`plugins/quartz-okf-explorer/lib/tree.ts`)

```ts
interface Hierarchy {
  edge: string
  roots: string[]
  parent: Map<string, string>
  children: Map<string, string[]>   // in view order
  depth: Map<string, number>        // roots at 0
  loose: string[]                   // on screen, not in the hierarchy
  shared: string[]                  // several parents; placed under the first
  cyclic: string[]                  // unreachable from any root
}

interface Placement { x: number; y: number; ring: number; radius: number }

treeOf(mode): TreeOptions | null
hierarchyOf(nodes, links, edge): Hierarchy | null
radialLayout(hierarchy, { cx, cy, spacing, step }): { positions: Map<string, Placement>; rings: number[] }
centroidOf(points): { x: number; y: number } | null
```

## Engine state

- `pinned: Map<string, { x: number; y: number }>` — restored on drag end, shifted on
  resize, rebuilt on every `setView`.
- The radial force's target: the node's depth ring when the mode has a tree with
  `layout: "rings"`, else the type ring from `layout.radial.byType`, else none.
