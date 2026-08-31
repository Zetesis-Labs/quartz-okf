import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "@quartz-community/types"
import type { ExplorerOptions } from "../../../lib/types.ts"
import { explorerConfig } from "../../lib/emit-config.ts"
import type { ExplorerEmitConfig } from "../../lib/types.ts"
import style from "./styles/explorer.css"
// @ts-expect-error - the tsup loader turns the inline script into a bundled string
import script from "./scripts/explorer.inline.ts"

/**
 * The explorer as a Quartz component: the access widget in the sidebar and, on every
 * page, the configuration the browser script needs to open the explorer in place. The
 * engine carries no vocabulary — colours, labels and view modes come from the consumer's
 * `explorer` block, resolved once per site locale and inlined as `data-cfg`.
 */
const resolved = new Map<string, ExplorerEmitConfig>()

function configFor(opts: ExplorerOptions, siteLocale: string | undefined): ExplorerEmitConfig {
  const key = siteLocale ?? ""
  const cached = resolved.get(key)
  if (cached) return cached
  const { config, problems } = explorerConfig(opts, siteLocale)
  for (const problem of problems) console.warn(`[quartz-okf-explorer] warning: ${problem}`)
  resolved.set(key, config)
  return config
}

const preview = (
  <svg viewBox="0 0 200 96" aria-hidden="true">
    <line x1="46" y1="30" x2="100" y2="48" />
    <line x1="46" y1="30" x2="70" y2="72" />
    <line x1="100" y1="48" x2="70" y2="72" />
    <line x1="100" y1="48" x2="152" y2="26" />
    <line x1="100" y1="48" x2="150" y2="72" />
    <line x1="152" y1="26" x2="150" y2="72" />
    <circle cx="46" cy="30" r="6" class="n1" />
    <circle cx="100" cy="48" r="9" class="n2" />
    <circle cx="70" cy="72" r="5" class="n3" />
    <circle cx="152" cy="26" r="6" class="n4" />
    <circle cx="150" cy="72" r="5" class="n5" />
  </svg>
)

export default ((userOpts?: ExplorerOptions) => {
  const opts: ExplorerOptions = { ...userOpts }
  if (userOpts && "mountSelector" in userOpts) {
    console.warn("[quartz-okf-explorer] warning: `mountSelector` is ignored since 004 — the layout places the widget (layout.position: right)")
  }
  const showWidget = opts.injectAccess !== false

  const OkfExplorer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const config = configFor(opts, cfg.locale)
    const w = config.wording
    return (
      <div class={["okf-explorer", displayClass].filter(Boolean).join(" ")} data-cfg={JSON.stringify(config)}>
        {showWidget && (
          <div class="okf-explorer-access tw:flex tw:flex-col tw:gap-2">
            <h3 class="tw:m-0">{config.accessTitle}</h3>
            <button
              class="okf-explorer-preview tw:relative tw:block tw:w-full tw:cursor-pointer tw:rounded-lg tw:border tw:border-(--lightgray) tw:bg-(--light) tw:p-1 tw:hover:border-(--secondary) tw:focus-visible:border-(--secondary)"
              type="button"
              aria-label={w["access.open"]}
              data-open={w["access.open"]}
            >
              {preview}
            </button>
            <button
              class="okf-explorer-open tw:cursor-pointer tw:rounded-md tw:border tw:border-(--lightgray) tw:bg-(--light) tw:px-2.5 tw:py-1 tw:text-[0.85rem] tw:text-inherit tw:hover:bg-(--lightgray)"
              type="button"
            >
              {w["access.open"]}
            </button>
            <div class="tw:text-[0.72rem] tw:text-(--gray)" data-okf-stats>
              {w["access.stats.loading"]}
            </div>
          </div>
        )}
      </div>
    )
  }
  OkfExplorer.css = style
  OkfExplorer.afterDOMLoaded = script
  return OkfExplorer
}) satisfies QuartzComponentConstructor<ExplorerOptions | undefined>
