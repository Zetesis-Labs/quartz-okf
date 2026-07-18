export const OKF_VERSION = "0.1"
export const GRAPH_SCHEMA = "okf-graph/v1"
export const PROFILE_ID = "https://zetesis-labs.github.io/okf/profiles/typed-topology/v1"

export const TYPES = Object.freeze([
  "application",
  "service",
  "component",
  "cluster",
  "node",
  "router",
  "network",
  "datastore",
  "technology",
  "runbook",
  "decision",
  "incident",
  "concept",
  "report",
])

export const STRUCTURAL_TYPES = Object.freeze([
  "application",
  "service",
  "component",
  "cluster",
  "node",
  "router",
  "network",
  "datastore",
  "technology",
])

// Consumer profiles may replace this with declarative frontmatter constraints
// and graph projections. The reference profile deliberately remains neutral.
export const PROPERTY_GROUPS = Object.freeze([])

export const EDGE_LABELS = Object.freeze([
  "Part of",
  "Contains",
  "Runs on",
  "Hosts",
  "Member of",
  "Uses",
  "State in",
  "Backed by",
  "Depends on",
  "Consumed by",
  "Peers with",
  "Watches",
  "Reached via",
  "About",
  "Affects",
])

// Relations are declared once; the mirrored direction is derived by tooling.
// Labels absent here (Member of, Depends on, About, ...) have no mirror and
// surface on the target through inbound-edge views instead.
export const INVERSE_LABELS = Object.freeze({
  "Part of": "Contains",
  Contains: "Part of",
  "Runs on": "Hosts",
  Hosts: "Runs on",
  Uses: "Consumed by",
  "Consumed by": "Uses",
  "Peers with": "Peers with",
})

export const KNOWLEDGE_LABELS = Object.freeze(["About", "Affects"])

export const EDGE_IRIS = Object.freeze(
  Object.fromEntries(
    EDGE_LABELS.map((label) => [
      label,
      `${PROFILE_ID}#${label.toLowerCase().replaceAll(" ", "-")}`,
    ]),
  ),
)

export const DEFAULT_RULE_LEVELS = Object.freeze({
  "core/frontmatter-parse": "error",
  "core/type-required": "error",
  "core/index-frontmatter": "error",
  "core/log-frontmatter": "error",
  "core/log-date": "error",
  "profile/type-closed": "error",
  "profile/folder-note-alias": "error",
  "profile/edge-label-closed": "warn",
  "hygiene/title-recommended": "warn",
  "hygiene/description-recommended": "warn",
  "hygiene/tags-shape": "warn",
  "hygiene/unresolved-edge": "off",
  "hygiene/redundant-inverse": "warn",
  "hygiene/knowledge-edges-recommended": "warn",
})

export const PROFILE = Object.freeze({
  id: PROFILE_ID,
  okfVersion: OKF_VERSION,
  graphSchema: GRAPH_SCHEMA,
  types: TYPES,
  structuralTypes: STRUCTURAL_TYPES,
  propertyGroups: PROPERTY_GROUPS,
  edgeLabels: EDGE_LABELS,
  edgeIris: EDGE_IRIS,
  inverseLabels: INVERSE_LABELS,
  knowledgeLabels: KNOWLEDGE_LABELS,
  topologyHeading: "Topology",
  ruleLevels: DEFAULT_RULE_LEVELS,
})

// Reference branding. A consumer overrides this through its own okf.config.js;
// the toolkit itself must not name any specific consumer.
export const BRANDING = Object.freeze({
  site: undefined,
  bundleTitle: "Knowledge bundle",
  indexTitle: "Knowledge bundle",
})
