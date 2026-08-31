import { modeById } from "../../../lib/display.ts"
import { filterRows } from "../../../lib/hud.ts"
import { useHud } from "../context.ts"

/** The side menu beside the stack: every type or relation with dot, count and checkbox; all / none; the mode's legend. */
export function SideMenu() {
  const { state, ctl, t } = useHud()
  const menu = state.sideMenu.value
  const view = state.view.value
  if (!menu || !view) return null
  const types = menu === "types"
  const display = state.display.value
  const counts = types ? view.groups.counts : view.edgeCounts
  const meta = types ? view.groups.meta : Object.fromEntries(Object.keys(counts).map((k) => [k, { color: display.edgeColors[k], label: k }]))
  const checked = types ? state.checkedTypes.value : state.checkedEdges.value
  const { rows, allChecked, noneChecked } = filterRows(counts, meta, checked)
  const mode = modeById(display, state.modeId.value)
  const legend = (menu === "edges" || !view.edgesFilterable) && mode.colorBy?.scale ? mode.colorBy.scale : null
  const apply = (set: Set<string> | null) => ctl.applyFilter(menu, set)

  return (
    <div id="side" class="okf-island tw:absolute tw:bottom-3 tw:left-[calc(18rem+1.4rem)] tw:z-30 tw:flex tw:w-64 tw:max-h-[min(60vh,calc(100%-1.6rem))] tw:flex-col tw:max-[900px]:top-[calc(var(--bar-h)+var(--omni-h)+1.6rem)] tw:max-[900px]:right-3 tw:max-[900px]:bottom-auto tw:max-[900px]:left-3 tw:max-[900px]:w-auto tw:max-[900px]:max-h-[50vh]">
      <div class="tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-(--hud-border) tw:py-1.5 tw:pr-2 tw:pl-3 tw:text-[0.8rem] tw:font-semibold">
        <span>{t(types ? "filters.types" : "filters.edges")}</span>
        <span class="tw:flex-1" />
        <button type="button" class="okf-chip mini" disabled={allChecked} onClick={() => apply(null)}>
          {t("filters.all")}
        </button>
        <button type="button" class="okf-chip mini" disabled={noneChecked} onClick={() => apply(new Set())}>
          {t("filters.none")}
        </button>
        <button
          type="button"
          class="okf-icon"
          title={t("filters.close")}
          onClick={() => {
            state.sideMenu.value = null
          }}
        >
          ✕
        </button>
      </div>
      <div class="tw:overflow-y-auto tw:overscroll-contain tw:p-1">
        {rows.map((r) => (
          <label key={r.id} class="tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1 tw:text-[0.8rem] tw:hover:bg-(--hud-hover)">
            <input
              type="checkbox"
              class="tw:m-0 tw:h-3.5 tw:w-3.5 tw:shrink-0 tw:accent-(--accent)"
              checked={r.checked}
              onChange={(e) => {
                const set = new Set(rows.filter((x) => x.checked).map((x) => x.id))
                if ((e.currentTarget as HTMLInputElement).checked) set.add(r.id)
                else set.delete(r.id)
                apply(set.size === rows.length ? null : set)
              }}
            />
            <span class="okf-dot" style={{ background: r.color }} />
            <span class={`tw:min-w-0 tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap ${r.checked ? "" : "tw:text-(--hud-fg-3)"}`}>{r.label}</span>
            <span class="tw:font-mono tw:text-[0.7rem] tw:text-(--hud-fg-3)">{r.count}</span>
          </label>
        ))}
      </div>
      {legend && (
        <div class="tw:flex tw:flex-col tw:gap-0.5 tw:border-t tw:border-(--hud-border) tw:px-3 tw:pt-1.5 tw:pb-2 tw:text-[0.76rem] tw:text-(--hud-fg-2)">
          <span class="tw:font-semibold tw:text-(--hud-fg)">{mode.legendTitle || mode.label}</span>
          {legend.map((s) => (
            <span key={s.label} class="tw:flex tw:items-center tw:gap-1.5">
              <span class="okf-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
