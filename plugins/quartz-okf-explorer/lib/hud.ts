import type { Chip, ExplorerMode, GroupMeta, HudNode, TrailLevel, Translator, ViewLink, ViewNode } from "./types.ts"

export interface TrailInput {
  rootTitle: string
  trail: { title?: string | null }[]
  graphCount: number
  scope: string
}

export interface TrailViewResult {
  levels: TrailLevel[]
  scopeKey: { text: string; active: boolean } | null
}

/** The omnibar's left side: where the reader is, and how to go back up. */
export function trailView({ rootTitle, trail, graphCount, scope }: TrailInput, t: Translator): TrailViewResult {
  const levels: TrailLevel[] = [{ text: rootTitle, index: 0, current: trail.length === 0 }]
  trail.forEach((g, i) => {
    levels.push({ text: g.title || t("trail.subgraph"), index: i + 1, current: i === trail.length - 1 })
  })
  const scopeKey =
    graphCount > 1 ? { text: scope === "all" ? t("scope.all") : t("scope.this"), active: scope === "all" } : null
  return { levels, scopeKey }
}

/** A portal is the door to a whole graph: it gets its own chip, always, whatever the mode hides. */
export function portalChips(nodes: Iterable<HudNode>, t: Translator): Chip[] {
  return [...nodes]
    .filter((n) => n.subgraph)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((n) => {
      const graph = n.subgraph?.title || n.subgraph?.id || ""
      return { id: n.id, text: t("portal.enter", { graph }), title: t("portal.title", { graph, notes: n.subgraph?.notes ?? 0 }) }
    })
}

export interface ViewsInput {
  trail: { title?: string | null }[]
  rootTitle: string
  modes: ExplorerMode[]
  modeId: string
  portals?: Iterable<HudNode>
}

export interface ViewsIslandResult {
  hidden: boolean
  back: { text: string; level: number } | null
  chips: Chip[]
  portals: Chip[]
}

export function viewsIsland({ trail, rootTitle, modes, modeId, portals = [] }: ViewsInput, t: Translator): ViewsIslandResult {
  const parentTitle = trail.length > 1 ? trail[trail.length - 2].title || "" : rootTitle
  const back = trail.length ? { text: t("views.back", { graph: parentTitle }), level: trail.length - 1 } : null
  const chips: Chip[] = modes.map((m) => ({ id: m.id, text: m.label, active: m.id === modeId, desc: m.desc || "" }))
  const doors = portalChips(portals, t)
  return { hidden: !back && modes.length <= 1 && !doors.length, back, chips, portals: doors }
}

interface CheckedSummary {
  sub: string
  warn: boolean
  total: number
}

function checkedOf(counts: Record<string, number>, checked: Set<string> | null | undefined): CheckedSummary {
  const total = Object.keys(counts).length
  if (!checked) return { sub: String(total), warn: false, total }
  const n = [...checked].filter((k) => k in counts).length
  return { sub: `${n}/${total}`, warn: total > 0 && n === 0, total }
}

export interface FiltersState {
  groups: { counts: Record<string, number> }
  checkedTypes: Set<string> | null
  edgeCounts: Record<string, number>
  checkedEdges: Set<string> | null
  edgesFilterable: boolean
  nodeCount: number
  linkCount: number
}

export interface FiltersIslandResult {
  hidden: boolean
  types: { text: string; sub: string; warn: boolean }
  edges: { hidden: boolean; text: string; sub: string; warn: boolean }
  stats: string
}

export function filtersIsland(state: FiltersState, t: Translator): FiltersIslandResult {
  const types = checkedOf(state.groups.counts, state.checkedTypes)
  const edges = checkedOf(state.edgeCounts, state.checkedEdges)
  return {
    hidden: types.total === 0 && !state.edgesFilterable,
    types: { text: t("filters.types"), sub: types.sub, warn: types.warn },
    edges: { hidden: !state.edgesFilterable, text: t("filters.edges"), sub: edges.sub, warn: edges.warn },
    stats: statsText(state.nodeCount, state.linkCount, t),
  }
}

export interface FilterRow {
  id: string
  label: string
  color: string
  count: number
  checked: boolean
}

export function filterRows(counts: Record<string, number>, meta: Record<string, Partial<GroupMeta>>, checked: Set<string> | null): { rows: FilterRow[]; allChecked: boolean; noneChecked: boolean } {
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      label: (meta[id] && meta[id].label) || id,
      color: (meta[id] && meta[id].color) || "#888",
      count,
      checked: checked ? checked.has(id) : true,
    }))
  return {
    rows,
    allChecked: rows.every((r) => r.checked),
    noneChecked: rows.length > 0 && rows.every((r) => !r.checked),
  }
}

const idOf = (end: string | ViewNode): string => (typeof end === "object" && end !== null ? end.id : end)
const shorten = (title: string): string => (title.length > 34 ? title.slice(0, 33) + "…" : title)

export interface SelectionGroup {
  text: string
  nodes: { id: string; title: string }[]
  more: number
}

export interface SelectionViewResult {
  title: string
  type: string
  explore: boolean
  groups: SelectionGroup[]
}

/** The selection capsule: the node's relations grouped by label, incoming ones marked. */
export function selectionView(
  selected: ViewNode | null,
  links: ViewLink[],
  idx: Map<string, ViewNode>,
  { edgeLabel, t, limit = 6 }: { edgeLabel: Record<string, string>; t: Translator; limit?: number },
): SelectionViewResult | null {
  if (!selected) return null
  const groups = new Map<string, { text: string; all: { id: string; title: string }[] }>()
  for (const l of links) {
    const out = idOf(l.source) === selected.id
    const inc = idOf(l.target) === selected.id
    if (!out && !inc) continue
    const other = idx.get(out ? idOf(l.target) : idOf(l.source))
    if (!other) continue
    const label = edgeLabel[l.kind] || l.kind
    const key = (out ? "" : "←") + label
    if (!groups.has(key)) groups.set(key, { text: out ? label : t("selection.incoming", { label }), all: [] })
    groups.get(key)?.all.push({ id: other.id, title: shorten(other.title) })
  }
  return {
    title: selected.title,
    type: selected.type,
    explore: Boolean(selected.subgraph),
    groups: [...groups.values()].map((g) => ({
      text: g.text,
      nodes: g.all.slice(0, limit),
      more: Math.max(0, g.all.length - limit),
    })),
  }
}

export function statsText(nodes: number, links: number, t: Translator): string {
  return t("stats", { nodes, links })
}

/** What `Escape` closes next: the open menu, then the results, the selection, the dock. */
export function dismissOrder({ menu, results, selected, dock }: { menu: unknown; results: boolean; selected: unknown; dock: boolean }): "menu" | "results" | "selection" | "dock" | null {
  if (menu) return "menu"
  if (results) return "results"
  if (selected) return "selection"
  if (dock) return "dock"
  return null
}
