/**
 * The contract, declared once: the consumer configuration (`okf.config.*`), the documents
 * the exporter reads, the emitted graph (`okf-graph/v1`) and the federation model. Every
 * plugin and every consumer types against this file. Vocabulary — node types, edge labels,
 * property names, mode ids — is always `string`: the engine ships none.
 */

export type RuleLevel = "off" | "warn" | "error"

export interface PropertyField {
  source: string
  graphPath: string[]
  label?: string
  type?: "string" | "number" | "boolean"
  required?: boolean
  enum?: unknown[]
}

export interface PropertyGroup {
  id: string
  label?: string
  rule: string
  appliesTo?: string[]
  fields?: PropertyField[]
}

export interface Profile {
  id: string
  okfVersion: string
  graphSchema: string
  types: readonly string[]
  structuralTypes: readonly string[]
  propertyGroups: readonly PropertyGroup[]
  edgeLabels: readonly string[]
  edgeIris: Readonly<Record<string, string>>
  inverseLabels: Readonly<Record<string, string>>
  knowledgeLabels: readonly string[]
  topologyHeading: string
  ruleLevels: Readonly<Record<string, RuleLevel>>
}

/** What a consumer writes under `profile`: any subset of the reference profile. */
export type ProfileOverlay = Partial<Profile>

export interface Branding {
  site?: string
  bundleTitle?: string
  indexTitle?: string
}

// ---- documents ----------------------------------------------------------------------------

/** Parsed frontmatter: the keys the engine reads are named, the rest is the author's. */
export interface Frontmatter {
  [key: string]: unknown
  type?: string
  title?: string
  description?: string
  tags?: unknown
  aliases?: unknown
  diagram?: string
  timestamp?: unknown
  okf_generated_frontmatter?: boolean
}

export interface TopologyEdge {
  label: string
  target: string
  alias?: string
}

export interface Violation {
  level: RuleLevel
  rule: string
  message: string
  edge?: TopologyEdge
}

export interface Document {
  id: string
  path: string
  source: string
  body: string
  frontmatter: Frontmatter | null
  parseError: Error | null
  reserved: boolean
}

export interface ValidatedDocument extends Document {
  edges: TopologyEdge[]
  violations: Violation[]
}

// ---- the emitted graph: okf-graph/v1 ----------------------------------------------------------

export interface GraphNode {
  slug: string
  title: string
  type: string
  tags?: string[]
  description?: string
  path?: string
  aliases?: string[]
  properties?: Record<string, unknown>
  url?: string
  /** A portal: this node stands for a whole other graph. */
  subgraph?: SubgraphMarker
  /** A preview of a child's note, mounted from the subgraph with this id. */
  federated?: string
}

export interface GraphEdge {
  source: string
  target: string | null
  label: string
  iri?: string
  derived?: boolean
  targetRaw?: string
  federated?: string
}

export interface UnresolvedEdge {
  source: string
  target: string
  label: string
}

export interface GraphStats {
  notes: number
  edges: number
  declaredEdges: number
  derivedEdges: number
  unresolvedEdges: number
  federatedNodes?: number
  federatedEdges?: number
}

export interface GraphPropertyGroup {
  id: string
  label: string
  appliesTo: string[]
  fields: { path: string[]; label: string }[]
}

export interface SubgraphMarker {
  id: string
  title?: string
  site?: string
  mount: string
  graph: string
  source_head?: string
  notes: number
  previewed: number
}

export interface FederatedFrom {
  site?: string
  node?: string
  title?: string
}

export interface RadiusOptions {
  byType?: Record<string, number>
  property?: string
  map?: Record<string, number>
  default?: number
}

/** The part of a child's explorer configuration that travels with its graph. */
export interface Display {
  typeColors?: Record<string, string>
  typeLabels?: Record<string, string>
  edgeColors?: Record<string, string>
  typeOrder?: string[]
  knowledgeTypes?: string[]
  radius?: RadiusOptions
  tooltip?: Record<string, string>
  modes?: ExplorerMode[]
}

export interface OkfGraph {
  schema: string
  okf_version: string
  okf_profile: string
  source_head?: string
  last_maintained_head?: string | null
  stale: boolean
  site?: string
  baseUrl?: string
  types: readonly string[]
  edgeLabels: readonly string[]
  propertyGroups: GraphPropertyGroup[]
  stats: GraphStats
  nodes: GraphNode[]
  edges: GraphEdge[]
  unresolved: UnresolvedEdge[]
  display?: Display
  federatedFrom?: FederatedFrom
}

// ---- the explorer's options (the consumer's `explorer` block) -------------------------------

export interface ExplorerScale {
  max?: number
  color: string
  label: string
}

export interface ExplorerMode {
  id: string
  label: string
  desc?: string
  legendTitle?: string
  /** `"*"` (default) or the edge labels this mode keeps. */
  edges?: "*" | string[]
  /** Another document this mode asks about, instead of the shared one. */
  graph?: string
  sourceType?: string
  targetType?: string
  colorBy?: {
    countEdge?: string
    scale?: ExplorerScale[]
    /**
     * Path into the node's `properties` (e.g. `"state"`, `"sla.tier"`). Combined with
     * `map`, it also drives the filter pills: the mode groups by this value instead of by
     * node type. Nodes without the property get no pill and stay visible.
     */
    property?: string
    map?: Record<string, string | { color: string; label?: string }>
    /**
     * Colour for nodes the property does not reach. A string paints every one of them; a
     * map keyed by node type paints only those, leaving the rest on their type colour.
     */
    fallback?: string | Record<string, string>
  }
  sizeBy?: { indegree?: boolean; countEdge?: string }
}

export interface ExplorerOptions {
  /** Where `@zetesis/quartz-okf` wrote the `okf-graph/v1` document. */
  graphInput?: string
  /** Path of the emitted explorer page. */
  output?: string
  /** Add the preview + modal to every page. */
  injectAccess?: boolean
  /** Heading of the access widget and of the modal. */
  accessTitle?: string
  /** Where the access widget mounts. */
  mountSelector?: string
  title?: string
  typeColors?: Record<string, string>
  typeLabels?: Record<string, string>
  edgeColors?: Record<string, string>
  knowledgeTypes?: string[]
  /** Priority of node types in the search results. Falls back to `knowledgeTypes`. */
  typeOrder?: string[]
  /**
   * Spring tension per edge label — what gives the graph its shape. `"*"` sets the default
   * for labels not named.
   */
  layout?: {
    charge?: number
    gravity?: number
    link?: Record<string, { distance?: number; strength?: number }>
    /** Concentric rings by node type: the fraction of the radius each type settles at. */
    radial?: { strength?: number; scale?: number; byType: Record<string, number> }
  }
  /** Node radius: `byType` wins over `property` + `map`; without either, the mode's `sizeBy`. */
  radius?: RadiusOptions
  /** Second line of the hover card, per node type (`"*"` as the fallback); `{path|one|many}`. */
  tooltip?: Record<string, string>
  /** Where the back link returns to, and what that place is called. */
  backTo?: { href?: string; label?: string }
  modes?: ExplorerMode[]
  /** Wording catalogue (`es`, `en`). Defaults to the site's Quartz locale. */
  locale?: string
  /** Per-key overrides of the engine wording. */
  wording?: Record<string, string>
  hud?: ExplorerHud
}

export interface ExplorerHud {
  /** `flat` (default) or `glass` — blurred surfaces, always flat under `prefers-reduced-transparency`. */
  surfaces?: "flat" | "glass"
  /** CSS custom properties applied on `:root` (`--accent`, `--hud-bg`, `--hud-radius`, …). */
  tokens?: Record<string, string>
}

// ---- federation: a site composes corpora -------------------------------------------------------

export interface SubgraphPreview {
  property: string
  equals: unknown
}

/**
 * One mounted corpus, as the consumer writes it. Its source is `path` (a corpus directory in
 * this code) or `repo` + `ref` (a git repository at a commit); a local path in `repo` is the
 * 001 spelling of `path`.
 */
export interface SubgraphEntry {
  id?: string
  node: string
  path?: string
  repo?: string
  ref?: string
  content?: string
  preview: SubgraphPreview
  edge?: string
}

export interface Federation {
  subgraphs?: SubgraphEntry[]
}

export type CorpusSource =
  | { kind: "path"; path: string }
  | { kind: "git"; repo: string; ref: string }

export interface Problem {
  id: string
  code: string
  message: string
}

/** One line of the mount manifest (`okf-federation/manifest.json`). */
export interface MountRecord {
  id: string
  node: string
  /** Where the corpus came from; for a path source, the resolved absolute directory. */
  source: CorpusSource
  repo?: string
  ref?: string
  /** The head of the repository the corpus belongs to; absent outside any repository. */
  head?: string
  remoteHead?: string
  mount: string
  display?: Display
  notes: number
}

/** The whole `okf.config.*` of a corpus. */
export interface OkfConfig {
  branding?: Branding
  profile?: ProfileOverlay
  explorer?: ExplorerOptions
  federation?: Federation
}
