import { readPath } from "./template.js"

/**
 * What the canvas draws for a mode and the reader's filters: the edges the mode keeps,
 * narrowed by the checked relations when the mode leaves more than one; the nodes those
 * edges touch, grouped by type — or by the property the mode colours by — and narrowed by
 * the checked groups. `types` and `edges` are sets of checked ids, or null for all.
 */
export function buildView(model, display, mode, { types = null, edges = null } = {}) {
  const N = model.nodes
  const wanted = mode.edges === "*" || !mode.edges ? null : new Set([].concat(mode.edges))

  let kept = []
  for (const e of model.edges) {
    if (wanted && !wanted.has(e.k)) continue
    if (mode.sourceType && N.get(e.s).type !== mode.sourceType) continue
    if (mode.targetType && N.get(e.t).type !== mode.targetType) continue
    kept.push(e)
  }
  const edgeCounts = {}
  for (const e of kept) edgeCounts[e.k] = (edgeCounts[e.k] || 0) + 1
  const edgesFilterable = !wanted || wanted.size > 1
  if (edgesFilterable && edges) kept = kept.filter((e) => edges.has(e.k))

  const keep = new Set()
  for (const e of kept) {
    keep.add(e.s)
    keep.add(e.t)
  }

  const cb = mode.colorBy || {}
  const byProperty = Boolean(cb.property && cb.map)
  const groupOf = (id) => (byProperty ? readPath(N.get(id).properties, cb.property) : N.get(id).type)

  const counts = {}
  for (const id of keep) {
    const g = groupOf(id)
    if (g == null) continue
    counts[g] = (counts[g] || 0) + 1
  }
  const meta = {}
  for (const g of Object.keys(counts)) {
    const v = byProperty ? cb.map[g] : null
    meta[g] = byProperty
      ? { color: (v && (v.color || v)) || "#888", label: (v && v.label) || g }
      : { color: display.colors[g] || "#888", label: display.labels[g] || g }
  }
  const active = types ?? new Set(Object.keys(counts))

  const idx = new Map()
  const nodes = []
  for (const id of keep) {
    const g = groupOf(id)
    if (g != null && !active.has(g)) continue
    const n = { ...N.get(id) }
    idx.set(id, n)
    nodes.push(n)
  }
  const links = kept
    .filter((e) => idx.has(e.s) && idx.has(e.t))
    .map((e) => ({ source: e.s, target: e.t, kind: e.k, derived: e.derived }))
  const adj = new Map()
  const touch = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a).add(b)
  }
  for (const l of links) {
    touch(l.source, l.target)
    touch(l.target, l.source)
  }
  return { nodes, links, adj, idx, groups: { counts, meta, byProperty }, edgeCounts, edgesFilterable }
}
