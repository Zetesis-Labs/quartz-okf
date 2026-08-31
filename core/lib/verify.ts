import type { PageFloor, Problem, SiteFacts, VerifyFloors } from "./types.ts"

export const GRAPH_DOCUMENT = "static/okf-graph.json"
export const EXPLORER_PAGE = "static/explorer.html"

const problem = (id: string, code: string, message: string): Problem => ({ id, code, message })

const floor = (id: string, what: string, got: number, min: number): Problem[] =>
  got >= min ? [] : [problem(id, "verify/below-floor", `${what}: ${got}, below the declared floor of ${min}`)]

function graphProblems(facts: SiteFacts, floors: VerifyFloors): Problem[] {
  if (!facts.graph) {
    return [problem(GRAPH_DOCUMENT, "verify/no-graph", `${GRAPH_DOCUMENT} is missing or does not parse: the site publishes no graph`)]
  }
  const { nodes, edges } = facts.graph
  if (nodes === 0) {
    return [problem(GRAPH_DOCUMENT, "verify/empty-graph", "the graph came out empty: no note reached the exporter")]
  }
  if (edges === 0) {
    return [problem(GRAPH_DOCUMENT, "verify/no-edges", "the graph has no edges: check the notes' `# Topology` sections")]
  }
  return [
    ...floor(GRAPH_DOCUMENT, "graph nodes", nodes, floors.minNodes ?? 0),
    ...floor(GRAPH_DOCUMENT, "graph edges", edges, floors.minEdges ?? 0),
  ]
}

function explorerProblems(facts: SiteFacts): Problem[] {
  if (!facts.explorer) {
    return [problem(EXPLORER_PAGE, "verify/no-explorer", "the explorer's page was not emitted: check the `output` it declares")]
  }
  return facts.explorer.assets
    .filter((asset) => !asset.present)
    .map((asset) =>
      problem(asset.name, "verify/missing-asset", `the explorer references /static/${asset.name} and it was not emitted: the canvas would come up blank`),
    )
}

function componentProblems(facts: SiteFacts): Problem[] {
  if (!facts.page) {
    return [problem("index.html", "verify/no-page", "no page could be read to check the explorer's widget")]
  }
  const { path, widget, config } = facts.page
  if (!widget) {
    return [problem(path, "verify/no-component", `${path} does not carry the explorer component: check its \`layout\` in quartz.config.yaml`)]
  }
  if (!config) {
    return [problem(path, "verify/no-component-config", `${path} carries the explorer without its configuration (data-cfg)`)]
  }
  return []
}

function pageFloorProblems(facts: SiteFacts, floors: PageFloor[]): Problem[] {
  return floors.flatMap((declared) => {
    const counted = facts.counts.find((entry) => entry.glob === declared.glob)
    if (!counted) {
      return [problem(declared.glob, "verify/uncounted", `no page was counted for \`${declared.glob}\`: the floor could not be judged`)]
    }
    return floor(declared.glob, `pages matching \`${declared.glob}\``, counted.count, declared.min)
  })
}

/** `libros/*.html` and `**` for a whole tree: the only shapes a page floor needs. */
export function matchesGlob(glob: string, relativePath: string): boolean {
  const segments = glob.split("/")
  const pattern = segments
    .map((segment, index) => {
      const last = index === segments.length - 1
      if (segment === "**") return last ? ".*" : "(?:[^/]+/)*"
      const literal = segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*")
      return last ? literal : `${literal}/`
    })
    .join("")
  return new RegExp(`^${pattern}$`).test(relativePath)
}

/** Every reason this built site should not be published, in the order a reader would look. */
export function verifySite(facts: SiteFacts, floors: VerifyFloors): Problem[] {
  return [
    ...(facts.index ? [] : [problem("index.html", "verify/no-index", "the build produced no index.html")]),
    ...graphProblems(facts, floors),
    ...explorerProblems(facts),
    ...(floors.component === false ? [] : componentProblems(facts)),
    ...pageFloorProblems(facts, floors.pages ?? []),
  ]
}
