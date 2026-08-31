import { filtersIsland } from "../../../lib/hud.ts"
import { useHud } from "../context.ts"

/** The filters island: types and relations as side menus, the stats line, fit and clear. */
export function Filters() {
  const { state, ctl, engine, t } = useHud()
  const view = state.view.value
  if (!view) return null
  const v = filtersIsland(
    {
      groups: view.groups,
      checkedTypes: state.checkedTypes.value,
      edgeCounts: view.edgeCounts,
      edgesFilterable: view.edgesFilterable,
      checkedEdges: state.checkedEdges.value,
      nodeCount: view.nodes.length,
      linkCount: view.links.length,
    },
    t,
  )
  if (v.hidden) return null
  const menu = state.sideMenu.value
  const toggle = (which: "types" | "edges") => {
    state.sideMenu.value = menu === which ? null : which
  }
  const chip = (which: "types" | "edges", c: { text: string; sub: string; warn: boolean }) => (
    <button type="button" class={`okf-chip ${c.warn ? "warn" : ""}`} aria-pressed={menu === which} onClick={() => toggle(which)}>
      <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">{c.text}</span>
      <span class="okf-sub">{c.sub}</span>
      <span class="tw:text-(--hud-fg-3)">›</span>
    </button>
  )
  return (
    <section id="filters" class="okf-island tw:flex tw:flex-col tw:gap-1.5 tw:px-2 tw:py-2">
      <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-1">
        {chip("types", v.types)}
        {!v.edges.hidden && chip("edges", v.edges)}
      </div>
      <div class="tw:flex tw:items-center tw:gap-1.5 tw:px-1 tw:text-[0.72rem] tw:text-(--hud-fg-3)">
        <span id="stats" class="tw:flex-1 tw:font-mono">
          {state.status.value || v.stats}
        </span>
        <button type="button" class="okf-chip mini" title={t("fit.title")} onClick={() => engine.fit()}>
          {t("fit")}
        </button>
        <button type="button" class="okf-chip mini" title={t("clear.title")} onClick={() => ctl.clearAll()}>
          {t("clear")}
        </button>
      </div>
    </section>
  )
}
