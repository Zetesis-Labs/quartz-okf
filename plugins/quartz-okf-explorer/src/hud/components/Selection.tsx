import { selectionView } from "../../../lib/hud.ts"
import { useHud } from "../context.ts"

/** The selected node's capsule: type, title, its relations grouped by label, the door to its subgraph. */
export function Selection() {
  const { state, ctl, t } = useHud()
  const view = state.view.value
  const v = view ? selectionView(state.selected.value, view.links, view.idx, { edgeLabel: {}, t }) : null
  if (!v || !view) return null
  const selected = state.selected.value
  return (
    <div id="sel" class="okf-island tw:max-h-[32vh] tw:overflow-y-auto tw:overscroll-contain tw:px-2.5 tw:py-2 tw:text-[0.78rem] tw:leading-relaxed">
      <div class="tw:flex tw:items-center tw:gap-2">
        <span class="okf-dot" style={{ background: state.display.value.colors[v.type] || "#888" }} />
        <span class="tw:min-w-0 tw:flex-1 tw:font-bold" title={v.title}>
          {v.title}
        </span>
        {v.explore && selected && (
          <button type="button" class="okf-chip mini tw:shrink-0" onClick={() => void ctl.enterSubgraph(selected)}>
            {t("selection.explore")}
          </button>
        )}
        <button type="button" class="okf-icon" title={t("selection.close")} onClick={() => ctl.deselect()}>
          ✕
        </button>
      </div>
      {v.groups.length > 0 && (
        <div class="tw:text-(--hud-fg-2)">
          {v.groups.map((g, gi) => (
            <span key={g.text}>
              {gi > 0 && <span class="tw:mx-1.5 tw:text-(--hud-fg-3)">·</span>}
              <b class="tw:font-semibold tw:text-(--hud-fg)">{g.text}</b>{" "}
              {g.nodes.map((n, ni) => (
                <span key={n.id}>
                  {ni > 0 && ", "}
                  <a
                    class="tw:cursor-pointer tw:text-(--accent) tw:no-underline tw:hover:underline"
                    onClick={() => {
                      const node = view.idx.get(n.id)
                      if (node) ctl.openNote(node)
                    }}
                  >
                    {n.title}
                  </a>
                </span>
              ))}
              {g.more > 0 && ` +${g.more}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
