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

// Profiles may declare flat authored fields, their validation constraints, and
// their projection into the additive graph node `properties` object. The core
// executes this data without knowing the domain semantics of any field.
export const PROPERTY_GROUPS = Object.freeze([
  {
    id: "node-platform",
    label: "Platform",
    appliesTo: ["node", "router"],
    rule: "hygiene/node-kind-recommended",
    fields: [
      {
        source: "node_kind",
        label: "Node kind",
        required: true,
        type: "string",
        enum: ["physical", "vm", "vps", "external"],
        graphPath: ["node_kind"],
      },
      {
        source: "os_family",
        label: "Operating system",
        required: true,
        type: "string",
        graphPath: ["os", "family"],
      },
      {
        source: "os_version",
        label: "OS version",
        type: "string",
        graphPath: ["os", "version"],
      },
      {
        source: "hardware_model",
        label: "Hardware model",
        type: "string",
        graphPath: ["hardware", "model"],
      },
      {
        source: "hardware_architecture",
        label: "Architecture",
        type: "string",
        graphPath: ["hardware", "architecture"],
      },
      {
        source: "hardware_cpu",
        label: "CPU",
        type: "string",
        graphPath: ["hardware", "cpu"],
      },
      {
        source: "hardware_memory",
        label: "Memory",
        type: "string",
        graphPath: ["hardware", "memory"],
      },
      {
        source: "hardware_storage",
        label: "Storage",
        type: "string",
        graphPath: ["hardware", "storage"],
      },
    ],
  },
])

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
  "hygiene/node-kind-recommended": "warn",
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
