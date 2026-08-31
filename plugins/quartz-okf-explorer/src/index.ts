import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { explorerConfig } from "../lib/emit-config.js"

/**
 * Emits the full-page OKF explorer and, optionally, the access widget that opens it in a
 * maximised modal from every note.
 *
 * The engine carries no vocabulary: colours, labels and — above all — the view modes come
 * from the consumer's `explorer` block in `okf.config.mjs`, which is inlined into the page
 * script itself. Two sites sharing this plugin can therefore ask entirely different
 * questions of their corpus. Every visible word comes from a locale catalogue chosen by the
 * site's language and overridable per key.
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
  /** Another  document this mode asks about, instead of the shared one. */
  graph?: string
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

export interface ExplorerHud {
  /** `flat` (default) or `glass` — blurred surfaces, always flat under `prefers-reduced-transparency`. */
  surfaces?: "flat" | "glass"
  /** CSS custom properties applied on `:root` (`--accent`, `--hud-bg`, `--hud-radius`, …). */
  tokens?: Record<string, string>
}

export interface ExplorerOptions {
  /** Where `@zetesis/quartz-okf` wrote the `okf-graph/v1` document. */
  graphInput?: string
  /** Path of the emitted explorer page. */
  output?: string
  /** Add the preview + modal to every page. */
  injectAccess?: boolean
  /** Heading of the access widget and of the modal. Defaults to the catalogue's. */
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
  /** Where the back link returns to, and what that place is called. */
  backTo?: { href?: string; label?: string }
  modes?: ExplorerMode[]
  /** Wording catalogue (`es`, `en`). Defaults to the site's Quartz locale. */
  locale?: string
  /** Per-key overrides of the engine wording (see README § Wording). */
  wording?: Record<string, string>
  hud?: ExplorerHud
}

const here = path.dirname(fileURLToPath(import.meta.url))

const defaults: Required<Pick<ExplorerOptions, "graphInput" | "output" | "injectAccess" | "mountSelector">> = {
  graphInput: "static/okf-graph.json",
  output: "static/explorer.html",
  injectAccess: true,
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

// `String.replace` interprets `$&`, `$1`… in the replacement: a bundle, a JSON document or
// a title with a `$` inside would come out corrupted. Split/join inserts it verbatim, everywhere.
const inject = (page: string, slot: string, text: string) => page.split(slot).join(text)

interface EmitContext {
  argv: { output: string }
  cfg?: { configuration?: { locale?: string } }
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

    async emit(ctx: EmitContext): Promise<string[]> {
      const out = ctx.argv.output
      const written: string[] = []

      const { config, problems } = explorerConfig(opts, ctx.cfg?.configuration?.locale)
      for (const problem of problems) console.warn(`[quartz-okf-explorer] warning: ${problem}`)

      // Configuración y código van en el MISMO script del documento: el router SPA de
      // Quartz reemplaza el cuerpo con micromorph sin re-ejecutar sus scripts, así que un
      // `<script>` aparte con la configuración se pierde al llegar navegando desde otra
      // página y el explorador arrancaba con los valores por defecto.
      let page = await readAsset("explorer.html")
      page = inject(page, "__OKF_LANG__", config.locale)
      page = inject(page, "__OKF_EXPLORER_CONFIG__", JSON.stringify(config))
      page = inject(page, "__OKF_EXPLORER_HUD__", await readAsset("hud.js"))
      const pagePath = path.join(out, opts.output)
      await fs.mkdir(path.dirname(pagePath), { recursive: true })
      await fs.writeFile(pagePath, page)
      written.push(pagePath)

      if (opts.injectAccess) {
        const w = config.wording
        const wording = {
          open: w["access.open"],
          expand: w["access.expand"],
          reduce: w["access.reduce"],
          close: w["access.close"],
          loading: w["access.loading"],
          stats: w["access.stats"],
          statsLoading: w["access.stats.loading"],
        }
        let access = await readAsset("access.js")
        access = inject(access, "__OKF_WORDING__", JSON.stringify(wording))
        access = inject(access, "__EXPLORER_URL__", "/" + opts.output.replace(/\.html$/, ""))
        access = inject(access, "__TITLE__", config.accessTitle)
        access = inject(access, "__MOUNT__", opts.mountSelector)
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
