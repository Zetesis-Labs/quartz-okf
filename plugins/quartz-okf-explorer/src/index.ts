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
    property?: string
    map?: Record<string, string | { color: string; label?: string }>
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
