export interface ExplorerUrlState {
  open: boolean
  graph: string | null
  focus: string | null
}

const OWN = ["explorer", "graph", "focus"]

export function stateFromSearch(search: string): ExplorerUrlState {
  const params = new URLSearchParams(search)
  return { open: params.has("explorer"), graph: params.get("graph") || null, focus: params.get("focus") || null }
}

/** The page's own parameters stay; the explorer's are rewritten after them, `explorer` as a bare flag. */
export function searchWithState(search: string, state: ExplorerUrlState): string {
  const params = new URLSearchParams(search)
  for (const key of OWN) params.delete(key)
  const parts = [params.toString(), ...ownParts(state)].filter(Boolean)
  return parts.length ? "?" + parts.join("&") : ""
}

function ownParts(state: ExplorerUrlState): string[] {
  if (!state.open) return []
  const parts = ["explorer"]
  if (state.graph) parts.push(`graph=${encodeURIComponent(state.graph)}`)
  if (state.focus) parts.push(`focus=${encodeURIComponent(state.focus)}`)
  return parts
}

/** Where a link to the old standalone page lands now: the same graph and focus, inside `target`. */
export function legacyRedirect(search: string, target = "/"): string {
  const { graph, focus } = stateFromSearch(search)
  return target + "?" + ownParts({ open: true, graph, focus }).join("&")
}
