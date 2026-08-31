import type { HudNode, Scope, SearchGraph, SearchRow, Translator } from "./types.ts"

export function matchNode(node: HudNode, query: string): boolean {
  const q = query.toLowerCase()
  return node.title.toLowerCase().includes(q) || node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)
}

/** Declared kinds first, in the corpus' order; undeclared kinds after; then by title. */
export function rankResults(nodes: HudNode[], query: string, { kindOrder = [], limit = 20 }: { kindOrder?: readonly string[]; limit?: number } = {}): HudNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const rank = (type: string): number => {
    const i = kindOrder.indexOf(type)
    return i < 0 ? kindOrder.length : i
  }
  return nodes
    .filter((n) => matchNode(n, q))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function scopesFor(graphCount: number, t: Translator): Scope[] {
  if (graphCount <= 1) return []
  return [
    { id: "graph", label: t("scope.this") },
    { id: "all", label: t("scope.all") },
  ]
}

export function nextScope(current: string, scopes: Scope[]): string {
  if (!scopes.length) return current
  const i = scopes.findIndex((s) => s.id === current)
  return scopes[(i + 1) % scopes.length].id
}

export interface SearchResults {
  rows: SearchRow[]
  unavailable: string[]
}

/**
 * One result list over several graphs. The graph on screen goes first, then the others in
 * registry order, each ranked by its own kind order; rows from another graph carry its
 * title as a badge. A graph that could not be loaded is reported, never skipped in silence.
 */
export function searchAcross(graphs: SearchGraph[], query: string, { limit = 20 }: { limit?: number } = {}): SearchResults {
  const rows: SearchRow[] = []
  const unavailable: string[] = []
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
