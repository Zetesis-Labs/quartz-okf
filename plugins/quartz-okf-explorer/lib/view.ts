import { readPath } from "./template.ts"
import type { ExplorerMode, GroupMeta, HudDisplay, HudEdge, HudModel, View, ViewLink, ViewNode } from "./types.ts"

export interface ViewFilters {
  types?: Set<string> | null
  edges?: Set<string> | null
}

/**
 * What the canvas draws for a mode and the reader's filters: the edges the mode keeps,
 * narrowed by the checked relations when the mode leaves more than one; the nodes those
 * edges touch, grouped by type — or by the property the mode colours by — and narrowed by
 * the checked groups. `types` and `edges` are sets of checked ids, or null for all.
 */
export function buildView(model: HudModel, display: HudDisplay, mode: ExplorerMode, { types = null, edges = null }: ViewFilters = {}): View {
  const N = model.nodes
  const wanted = mode.edges === "*" || !mode.edges ? null : new Set(Array.isArray(mode.edges) ? mode.edges : [mode.edges])

  let kept: HudEdge[] = []
  for (const e of model.edges) {
    if (wanted && !wanted.has(e.k)) continue
    if (mode.sourceType && N.get(e.s)?.type !== mode.sourceType) continue
    if (mode.targetType && N.get(e.t)?.type !== mode.targetType) continue
    kept.push(e)
  }
  const edgeCounts: Record<string, number> = {}
  for (const e of kept) edgeCounts[e.k] = (edgeCounts[e.k] || 0) + 1
  const edgesFilterable = !wanted || wanted.size > 1
  if (edgesFilterable && edges) kept = kept.filter((e) => edges.has(e.k))

  const keep = new Set<string>()
  for (const e of kept) {
    keep.add(e.s)
    keep.add(e.t)
  }

  const cb = mode.colorBy || {}
  const byProperty = Boolean(cb.property && cb.map)
  const groupOf = (id: string): string | null => {
    const node = N.get(id)
    if (!node) return null
    if (!byProperty) return node.type
    const value = readPath(node.properties, cb.property ?? "")
    return value == null ? null : String(value)
  }

  const counts: Record<string, number> = {}
  for (const id of keep) {
    const g = groupOf(id)
    if (g == null) continue
    counts[g] = (counts[g] || 0) + 1
  }
  const meta: Record<string, GroupMeta> = {}
  for (const g of Object.keys(counts)) {
    const v = byProperty && cb.map ? cb.map[g] : undefined
    meta[g] = byProperty
      ? { color: (typeof v === "string" ? v : v?.color) || "#888", label: (typeof v === "object" && v?.label) || g }
      : { color: display.colors[g] || "#888", label: display.labels[g] || g }
  }
  const active = types ?? new Set(Object.keys(counts))

  const idx = new Map<string, ViewNode>()
  const nodes: ViewNode[] = []
  for (const id of keep) {
    const g = groupOf(id)
    if (g != null && !active.has(g)) continue
    const source = N.get(id)
    if (!source) continue
    const n: ViewNode = { ...source }
    idx.set(id, n)
    nodes.push(n)
  }
  const links: ViewLink[] = kept
    .filter((e) => idx.has(e.s) && idx.has(e.t))
    .map((e) => ({ source: e.s, target: e.t, kind: e.k, derived: e.derived }))
  const adj = new Map<string, Set<string>>()
  const touch = (a: string, b: string): void => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a)?.add(b)
  }
  for (const l of links) {
    touch(l.source as string, l.target as string)
    touch(l.target as string, l.source as string)
  }
  return { nodes, links, adj, idx, groups: { counts, meta, byProperty }, edgeCounts, edgesFilterable }
}
