// The fixture's own vocabulary. The engine ships none: what a note may be and how notes
// may relate is declared here, exactly as a consumer declares it.
export const branding = {
  site: "OKF fixture",
  bundleTitle: "OKF fixture corpus",
  indexTitle: "OKF fixture",
}

export const profile = {
  types: ["concept", "tool", "source"],
  edgeLabels: ["Part of", "Contains", "Uses", "Used by", "About", "Cites"],
  inverseLabels: {
    "Part of": "Contains",
    "Contains": "Part of",
    "Uses": "Used by",
    "Used by": "Uses",
  },
  propertyGroups: [
    {
      id: "provenance",
      label: "Provenance",
      rule: "provenance-valid",
      appliesTo: ["source"],
      fields: [{ source: "url", graphPath: ["url"], type: "string" }],
    },
  ],
  ruleLevels: { "provenance-valid": "error" },
}

export const explorer = {
  title: "Fixture graph",
  knowledgeTypes: ["concept", "tool"],
  typeColors: { concept: "#4c7ecf", tool: "#4caf7c", source: "#8a8a8a" },
  typeLabels: { concept: "concept", tool: "tool", source: "source" },
  edgeColors: { "Part of": "#9a6fbf", Contains: "#9a6fbf", Uses: "#4caf7c", "Used by": "#4caf7c", About: "#7f93ad", Cites: "#8a8a8a" },
  modes: [{ id: "full", label: "Full graph", desc: "Every note and every typed relationship.", edges: "*" }],
}

// The floors this corpus must clear; the smoke build fails below any of them.
export const build = {
  verify: {
    minNodes: 8,
    minEdges: 8,
    pages: [{ glob: "concepts/*.html", min: 2 }],
  },
}
