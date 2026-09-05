import type { ExplorerMode, TreeOptions } from "./types.ts"

/**
 * A mode drawn as a hierarchy. The consumer names the edge; here the links under it are
 * read into a forest and the forest into places on rings by depth. Pure and deterministic:
 * the same view gives the same drawing.
 */
interface HasId {
  id: string
}

interface LinkLike {
  source: string | HasId
  target: string | HasId
  kind: string
}

export interface Hierarchy {
  edge: string
  roots: string[]
  parent: Map<string, string>
  /** In the order the view gives its nodes. */
  children: Map<string, string[]>
  /** Distance from the nearest root; roots at 0. */
  depth: Map<string, number>
  /** On screen, not in the hierarchy (cyclic nodes included). */
  loose: string[]
  /** Several parents under the edge; placed under the first. */
  shared: string[]
  /** Under the edge, but no root reaches them. */
  cyclic: string[]
}

export interface Placement {
  x: number
  y: number
  ring: number
  radius: number
}

export interface RadialOptions {
  cx: number
  cy: number
  /** The arc one leaf needs on the outer ring. */
  spacing: number
  /** The least distance between two rings. */
  step?: number
}

export interface RadialResult {
  positions: Map<string, Placement>
  rings: number[]
}

const idOf = (end: string | HasId): string => (typeof end === "string" ? end : end.id)

export function treeOf(mode: ExplorerMode): TreeOptions | null {
  if (!mode.tree) return null
  if (typeof mode.tree === "string") return { edge: mode.tree, layout: "radial" }
  return { edge: mode.tree.edge, layout: mode.tree.layout ?? "radial" }
}

function parentsBy(pairs: [string, string][], childEnd: 0 | 1): Map<string, Set<string>> {
  const parents = new Map<string, Set<string>>()
  for (const pair of pairs) {
    const child = pair[childEnd]
    const parent = pair[childEnd === 0 ? 1 : 0]
    let set = parents.get(child)
    if (!set) parents.set(child, (set = new Set()))
    set.add(parent)
  }
  return parents
}

const multiParents = (parents: Map<string, Set<string>>): number => [...parents.values()].filter((set) => set.size > 1).length

export function hierarchyOf(nodes: HasId[], links: LinkLike[], edge: string): Hierarchy | null {
  const order = nodes.map((node) => node.id)
  const known = new Set(order)
  const pairs: [string, string][] = []
  for (const link of links) {
    if (link.kind !== edge) continue
    const source = idOf(link.source)
    const target = idOf(link.target)
    if (source !== target && known.has(source) && known.has(target)) pairs.push([source, target])
  }
  if (pairs.length === 0) return null

  // The edge may be declared from either side of the pair; a tree is the orientation in
  // which fewer nodes have several parents. A tie keeps the declared direction.
  const declared = parentsBy(pairs, 0)
  const reversed = parentsBy(pairs, 1)
  const parents = multiParents(reversed) < multiParents(declared) ? reversed : declared

  const parent = new Map<string, string>()
  const shared: string[] = []
  for (const [child, set] of parents) {
    const [first] = set
    parent.set(child, first)
    if (set.size > 1) shared.push(child)
  }
  const inTree = new Set([...parent.keys(), ...parent.values()])
  const roots = order.filter((id) => inTree.has(id) && !parent.has(id))
  const children = new Map<string, string[]>()
  for (const id of order) {
    const up = parent.get(id)
    if (up === undefined) continue
    children.set(up, [...(children.get(up) ?? []), id])
  }
  const depth = new Map<string, number>()
  const queue = [...roots]
  for (const root of roots) depth.set(root, 0)
  while (queue.length) {
    const id = queue.shift() as string
    for (const child of children.get(id) ?? []) {
      if (depth.has(child)) continue
      depth.set(child, (depth.get(id) ?? 0) + 1)
      queue.push(child)
    }
  }
  const cyclic = order.filter((id) => inTree.has(id) && !depth.has(id))
  for (const id of cyclic) {
    parent.delete(id)
    children.delete(id)
  }
  const loose = order.filter((id) => !depth.has(id))
  return { edge, roots, parent, children, depth, loose, shared, cyclic }
}

export function radialLayout(hierarchy: Hierarchy, { cx, cy, spacing, step = 70 }: RadialOptions): RadialResult {
  const offset = hierarchy.roots.length > 1 ? 1 : 0
  const leaves = new Map<string, number>()
  const countLeaves = (id: string): number => {
    const kids = hierarchy.children.get(id) ?? []
    const count = kids.length ? kids.reduce((sum, kid) => sum + countLeaves(kid), 0) : 1
    leaves.set(id, count)
    return count
  }
  const total = hierarchy.roots.reduce((sum, root) => sum + countLeaves(root), 0)
  const deepest = Math.max(0, ...hierarchy.depth.values()) + offset
  const outer = deepest === 0 ? 0 : Math.max((total * spacing) / (2 * Math.PI), step * deepest)
  const rings = Array.from({ length: deepest + 1 }, (_, ring) => (deepest === 0 ? 0 : (outer * ring) / deepest))
  const positions = new Map<string, Placement>()

  const place = (id: string, start: number, span: number): void => {
    const ring = (hierarchy.depth.get(id) ?? 0) + offset
    const radius = rings[ring]
    const angle = start + span / 2 - Math.PI / 2
    positions.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), ring, radius })
    let cursor = start
    for (const kid of hierarchy.children.get(id) ?? []) {
      const share = span * ((leaves.get(kid) ?? 1) / (leaves.get(id) ?? 1))
      place(kid, cursor, share)
      cursor += share
    }
  }
  let cursor = 0
  for (const root of hierarchy.roots) {
    const share = total ? (2 * Math.PI * (leaves.get(root) ?? 1)) / total : 0
    place(root, cursor, share)
    cursor += share
  }
  return { positions, rings }
}

export function centroidOf(points: { x: number; y: number }[]): { x: number; y: number } | null {
  if (points.length === 0) return null
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}
