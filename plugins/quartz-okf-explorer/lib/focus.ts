import type { HudModel, HudNode } from "./types.ts"

const normalise = (value: string): string => value.replace(/^\/+|\/+$/g, "").toLowerCase()

/**
 * Forms under which a `?focus=` value may match a node. The bundle normalises slugs and
 * pages do not, so the comparison ignores case; an old link may still arrive
 * percent-encoded, hence the decoded variant.
 */
export function focusKeys(value: string): string[] {
  const forms = [value]
  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) forms.push(decoded)
  } catch {
    /* a stray %: the raw value is the only form */
  }
  return forms.map(normalise)
}

export function findNode<N extends HudNode>(nodes: Iterable<N>, keys: string[], { leaf = true }: { leaf?: boolean } = {}): N | null {
  const list = [...nodes]
  for (const key of keys) {
    const exact = list.find((n) => n.id.toLowerCase() === key)
    if (exact) return exact
  }
  for (const key of keys) {
    const byUrl = list.find((n) => normalise(n.url) === key)
    if (byUrl) return byUrl
  }
  for (const key of keys) {
    const byAlias = list.find((n) => (n.aliases ?? []).some((alias) => alias.toLowerCase() === key))
    if (byAlias) return byAlias
  }
  if (!leaf) return null
  for (const key of keys) {
    const tail = key.split("/").pop()
    const byLeaf = list.find((n) => n.id.toLowerCase().split("/").pop() === tail)
    if (byLeaf) return byLeaf
  }
  return null
}

/**
 * What to look for inside a subgraph being entered: the selected note, if it is on loan from
 * that very subgraph — first by the page url both graphs share, then by its mounted id.
 */
export function carriedFocus(selected: { id: string; url: string; federated: string | null } | null, subgraphId: string): string[] | null {
  if (!selected || selected.federated !== subgraphId) return null
  return [...new Set([normalise(selected.url), selected.id.toLowerCase()])]
}

export interface FocusHit {
  key: string
  node: HudNode
}

/**
 * The root answers first, with its leaf fallback; a subgraph is entered only on an exact
 * id or page-url match — a leaf alone is too weak a reason to change graph.
 */
export function resolveFocus(keys: string[], graphs: { key: string; model: HudModel | null }[]): FocusHit | null {
  for (const [i, g] of graphs.entries()) {
    if (!g.model) continue
    const node = findNode(g.model.nodes.values(), keys, { leaf: i === 0 })
    if (node) return { key: g.key, node }
  }
  return null
}
