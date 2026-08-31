/**
 * The HUD's own model: what the pure modules compute from an `okf-graph/v1` document and
 * the consumer's explorer options. The contract itself comes from core (`../../lib/types.ts`).
 */
import type {
  Display,
  ExplorerMode,
  ExplorerOptions,
  FederatedFrom,
  GraphNode,
  RadiusOptions,
  SubgraphMarker,
} from "../../lib/types.ts"

export type { Display, ExplorerMode, ExplorerOptions, RadiusOptions, SubgraphMarker }

/** `vars` is anything `fill()` can read a path from: a flat bag or a node. */
export type Translator = (key: string, vars?: unknown) => string

/** A node as the bundle writes it, plus the older spellings the model still accepts. */
export type RawNode = Partial<GraphNode> & { id?: string; label?: string; desc?: string }

export interface RawEdge {
  source: string
  target?: string | null
  label: string
  derived?: boolean
}

export interface RawGraph {
  nodes?: RawNode[]
  edges?: RawEdge[]
  site?: string
  stats?: { notes?: number; edges?: number }
  federatedFrom?: FederatedFrom | null
  display?: Display | null
  types?: readonly string[]
  edgeLabels?: readonly string[]
}

export interface HudNode {
  id: string
  type: string
  title: string
  label: string
  desc: string
  url: string
  properties: Record<string, unknown>
  subgraph: SubgraphMarker | null
  federated: string | null
  counts: Record<string, number>
  indeg: number
}

export interface HudEdge {
  s: string
  t: string
  k: string
  derived: boolean
}

export interface HudModel {
  nodes: Map<string, HudNode>
  edges: HudEdge[]
  title: string
  federatedFrom: FederatedFrom | null
  display: Display | null
  types: readonly string[]
  edgeLabels: readonly string[]
}

/** The vocabulary the canvas draws with, resolved for the graph on screen. */
export interface HudDisplay {
  colors: Record<string, string>
  labels: Record<string, string>
  edgeColors: Record<string, string>
  modes: ExplorerMode[]
  kindOrder: readonly string[]
  knowledgeTypes: readonly string[]
  tooltip: Record<string, string>
}

/** A node on the canvas: the model's node plus the fields the force simulation owns. */
export interface ViewNode extends HudNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

/** d3 replaces the string ends with node objects once the simulation binds the links. */
export interface ViewLink {
  source: string | ViewNode
  target: string | ViewNode
  kind: string
  derived: boolean
}

export interface GroupMeta {
  color: string
  label: string
}

export interface View {
  nodes: ViewNode[]
  links: ViewLink[]
  adj: Map<string, Set<string>>
  idx: Map<string, ViewNode>
  groups: { counts: Record<string, number>; meta: Record<string, GroupMeta>; byProperty: boolean }
  edgeCounts: Record<string, number>
  edgesFilterable: boolean
}

export interface RegistryEntry {
  key: string
  title: string
  url: string
  path: string[]
  model: HudModel | null
  error: string | null
}

export type Registry = Map<string, RegistryEntry>

export interface SearchGraph {
  key: string
  title: string
  current: boolean
  model: HudModel | null
  error?: string | null
  kindOrder?: readonly string[]
}

export interface SearchRow {
  node: HudNode
  key: string
  badge: string | null
}

export type RouteStep = { back: number } | { dive: string }

export interface Scope {
  id: string
  label: string
}

export interface TrailLevel {
  text: string
  index: number
  current: boolean
}

export interface Chip {
  id: string
  text: string
  active?: boolean
  desc?: string
  title?: string
}

/** What the emitter inlines into the page: the options as declared plus what it resolved. */
export interface ExplorerEmitConfig {
  graphUrl: string
  title: string
  accessTitle: string
  typeColors: Record<string, string>
  typeLabels: Record<string, string>
  edgeColors: Record<string, string>
  knowledgeTypes: string[]
  typeOrder: string[] | null
  layout: ExplorerOptions["layout"] | null
  radius: RadiusOptions | null
  tooltip: Record<string, string> | null
  backTo: ExplorerOptions["backTo"] | null
  modes: ExplorerMode[]
  locale: string
  wording: Record<string, string>
  hud: { surfaces: "flat" | "glass"; tokens: Record<string, string>; ground: "flat" | "dots" }
}
