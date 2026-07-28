import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Emits the full-page OKF explorer and, optionally, the access widget that opens it in a
 * maximised modal from every note.
 *
 * The engine carries no vocabulary: colours, labels and — above all — the view modes come
 * from the consumer's `explorer` block in `okf.config.mjs`, which is inlined into the page
 * as `window.OKF_EXPLORER`. Two sites sharing this plugin can therefore ask entirely
 * different questions of their corpus.
 */
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
  sourceType?: string
  targetType?: string
  colorBy?: {
    countEdge?: string
    scale?: ExplorerScale[]
    /**
     * Path into the node's `properties` (e.g. `"state"`, `"sla.tier"`). When combined with
     * `map`, it also drives the filter pills: the mode groups by this value instead of by
     * node type — in a mode that already fixes a single type, filtering by type says nothing.
     * Nodes without the property get no pill and stay visible.
     */
    property?: string
    map?: Record<string, string | { color: string; label?: string }>
    /**
     * Colour for nodes the property does not reach — typically aggregators. A plain string
     * paints every one of them; a map keyed by node type paints only those, leaving the
     * rest on their type colour (a synthetic root is not an unclassified node).
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
   * Spring tension per edge label — what actually gives the graph its shape. A hierarchy
   * reads as one when its edges are short and firm while the cross-cutting ones are long
   * and slack. `"*"` sets the default for labels not named.
   */
  layout?: {
    charge?: number
    gravity?: number
    link?: Record<string, { distance?: number; strength?: number }>
    /**
     * Concentric rings by node type — the fraction of the available radius each type
     * settles at (0 centre, 1 edge). A typed graph with hundreds of nodes is unreadable
     * as a ball because every type competes for the middle; in rings the eye reads from
     * the inside out. Types left undeclared keep floating freely.
     */
    radial?: { strength?: number; scale?: number; byType: Record<string, number> }
  }
  /**
   * Node radius. A hierarchical graph is not read by in-degree but by rank: a root is big
   * because it is the root, not because it has many children. `byType` wins over
   * `property` + `map`; without either, the mode's `sizeBy` applies.
   */
  radius?: {
    byType?: Record<string, number>
    property?: string
    map?: Record<string, number>
    default?: number
  }
  /**
   * Second line of the hover card, per node type (`"*"` as the fallback). What is worth
   * counting depends on the corpus — works that cite it, links, capabilities it groups —
   * so the engine ships no wording. `{path}` reads the node (`indeg`, `counts.Cites`,
   * `properties.level`); `{path|singular|plural}` picks the word from the number.
   */
  tooltip?: Record<string, string>
  modes?: ExplorerMode[]
}

const here = path.dirname(fileURLToPath(import.meta.url))

const defaults: Required<Pick<ExplorerOptions, "graphInput" | "output" | "injectAccess" | "accessTitle" | "mountSelector">> = {
  graphInput: "static/okf-graph.json",
  output: "static/explorer.html",
  injectAccess: true,
  accessTitle: "Grafo de conocimiento",
  mountSelector: ".right.sidebar",
}

async function readAsset(name: string): Promise<string> {
  // Works from `src` during development and from `dist` once bundled.
  for (const dir of [path.join(here, "assets"), path.join(here, "..", "src", "assets")]) {
    try {
      return await fs.readFile(path.join(dir, name), "utf8")
    } catch {
      /* try the next location */
    }
  }
  throw new Error(`quartz-okf-explorer: missing asset ${name}`)
}

export const OkfExplorer = (userOpts?: ExplorerOptions) => {
  const opts = { ...defaults, ...userOpts }
  const accessPath = "static/okf-explorer-access.js"

  return {
    name: "OkfExplorer",

    externalResources: () =>
      opts.injectAccess
        ? {
            js: [
              {
                src: "/" + accessPath,
                contentType: "external" as const,
                loadTime: "afterDOMReady" as const,
                // Quartz's SPA router swaps content without reloading: without this the
                // widget would stop mounting after the first navigation.
                spaPreserve: true,
              },
            ],
          }
        : {},

    async emit(ctx: { argv: { output: string } }): Promise<string[]> {
      const out = ctx.argv.output
      const written: string[] = []

      const config = {
        graphUrl: "/" + opts.graphInput,
        title: opts.title ?? opts.accessTitle,
        typeColors: opts.typeColors ?? {},
        typeLabels: opts.typeLabels ?? {},
        edgeColors: opts.edgeColors ?? {},
        knowledgeTypes: opts.knowledgeTypes ?? [],
        typeOrder: opts.typeOrder ?? null,
        layout: opts.layout ?? null,
        radius: opts.radius ?? null,
        tooltip: opts.tooltip ?? null,
        modes: opts.modes ?? [],
      }

      const page = (await readAsset("explorer.html")).replace(
        "<script src=",
        `<script>window.OKF_EXPLORER = ${JSON.stringify(config)}</script>\n<script src=`,
      )
      const pagePath = path.join(out, opts.output)
      await fs.mkdir(path.dirname(pagePath), { recursive: true })
      await fs.writeFile(pagePath, page)
      written.push(pagePath)

      if (opts.injectAccess) {
        const access = (await readAsset("access.js"))
          .replaceAll("__EXPLORER_URL__", "/" + opts.output.replace(/\.html$/, ""))
          .replaceAll("__TITLE__", opts.accessTitle)
          .replaceAll("__MOUNT__", opts.mountSelector)
        const accessFile = path.join(out, accessPath)
        await fs.writeFile(accessFile, access)
        written.push(accessFile)
      }

      return written
    },
  }
}

OkfExplorer.quartzCategory = "emitter"

export default OkfExplorer
