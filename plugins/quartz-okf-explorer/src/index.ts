import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { explorerConfig } from "../lib/emit-config.ts"

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
import type { ExplorerHud, ExplorerMode, ExplorerOptions, ExplorerScale } from "../../lib/types.ts"

// The options are declared once, in the contract; they are re-exported here so the
// plugin's public surface does not move.
export type { ExplorerHud, ExplorerMode, ExplorerOptions, ExplorerScale }

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
