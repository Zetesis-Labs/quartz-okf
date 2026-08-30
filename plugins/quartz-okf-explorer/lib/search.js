export function matchNode(node, query) {
  const q = query.toLowerCase()
  return node.title.toLowerCase().includes(q) || node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)
}

/** Declared kinds first, in the corpus' order; undeclared kinds after; then by title. */
export function rankResults(nodes, query, { kindOrder = [], limit = 20 } = {}) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const rank = (type) => {
    const i = kindOrder.indexOf(type)
    return i < 0 ? kindOrder.length : i
  }
  return nodes
    .filter((n) => matchNode(n, q))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function scopesFor(graphCount, t) {
  if (graphCount <= 1) return []
  return [
    { id: "graph", label: t("scope.this") },
    { id: "all", label: t("scope.all") },
  ]
}

export function nextScope(current, scopes) {
  if (!scopes.length) return current
  const i = scopes.findIndex((s) => s.id === current)
  return scopes[(i + 1) % scopes.length].id
}

/**
 * One result list over several graphs. The graph on screen goes first, then the others in
 * registry order, each ranked by its own kind order; rows from another graph carry its
 * title as a badge. A graph that could not be loaded is reported, never skipped in silence.
 */
export function searchAcross(graphs, query, { limit = 20 } = {}) {
  const rows = []
  const unavailable = []
  const ordered = [...graphs.filter((g) => g.current), ...graphs.filter((g) => !g.current)]
  for (const g of ordered) {
    if (!g.model) {
      if (g.error) unavailable.push(g.error)
      continue
    }
    for (const node of rankResults([...g.model.nodes.values()], query, { kindOrder: g.kindOrder || [], limit })) {
      rows.push({ node, key: g.key, badge: g.current ? null : g.title })
    }
  }
  return { rows: rows.slice(0, limit), unavailable }
}
