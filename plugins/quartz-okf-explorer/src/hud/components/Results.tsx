import { useEffect, useRef } from "preact/hooks"
import { useHud } from "../context.ts"

/** The list under the omnibar: notes of this graph or of every graph, or the palette's commands. */
export function Results() {
  const { state, ctl, actions, t } = useHud()
  const box = useRef<HTMLDivElement>(null)
  const hi = state.highlight.value
  const palette = state.palette.value
  const open = state.resultsOpen.value && (palette || Boolean(state.searchQuery.value))

  useEffect(() => {
    box.current?.querySelector(".hi")?.scrollIntoView({ block: "nearest" })
  }, [hi, open])

  if (!open) return null

  if (palette) {
    const rows = actions.paletteRows()
    return (
      <div id="results" ref={box} class="okf-island tw:max-h-[min(22rem,50vh)] tw:overflow-y-auto tw:overscroll-contain tw:p-1">
        {rows.length === 0 && <div class="tw:px-2 tw:py-1 tw:text-[0.72rem] tw:text-(--hud-fg-3)">{t("palette.none")}</div>}
        {rows.map((c, i) => (
          <button
            key={c.id}
            type="button"
            class={`okf-row ${i === hi ? "hi" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault()
              ctl.clearSearch()
              actions.run(c.id)
            }}
            onMouseOver={() => {
              state.highlight.value = i
            }}
          >
            <span class="tw:font-mono tw:text-[0.8rem] tw:text-(--accent)">›</span>
            <span class="tw:font-semibold">{c.label}</span>
            <span class="tw:ml-auto tw:whitespace-nowrap tw:text-[0.72rem] tw:text-(--hud-fg-3)">{t("palette.label")}</span>
          </button>
        ))}
      </div>
    )
  }

  const hits = state.hits.value
  return (
    <div id="results" ref={box} class="okf-island tw:max-h-[min(22rem,50vh)] tw:overflow-y-auto tw:overscroll-contain tw:p-1">
      {state.loadingGraphs.value ? (
        <div class="tw:px-2 tw:py-1 tw:text-[0.72rem] tw:text-(--hud-fg-3)">{t("results.loading")}</div>
      ) : (
        state.unavailable.value.map((u) => (
          <div key={u} class="tw:px-2 tw:py-1 tw:text-[0.72rem] tw:text-(--warn)">
            {t("results.unavailable", { graph: u })}
          </div>
        ))
      )}
      {hits.map((h, i) => {
        const d = ctl.displayOf(h.key)
        return (
          <button
            key={`${h.key}:${h.node.id}`}
            type="button"
            class={`okf-row ${i === hi ? "hi" : ""}`}
            onMouseDown={(e) => {
              // A repaint inside `mouseenter` would detach the row before the click lands.
              e.preventDefault()
              void ctl.activateHit(h)
            }}
            onMouseOver={() => {
              state.highlight.value = i
            }}
          >
            <span class="okf-dot" style={{ background: d.colors[h.node.type] || "#888" }} />
            <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:font-semibold">{h.node.title}</span>
            {h.badge ? <span class="okf-badge">{h.badge}</span> : h.node.federated ? <span class="okf-badge">{h.node.federated}</span> : null}
            <span class="tw:ml-auto tw:whitespace-nowrap tw:text-[0.72rem] tw:text-(--hud-fg-3)">{d.labels[h.node.type] || h.node.type}</span>
          </button>
        )
      })}
      {!hits.length && !state.loadingGraphs.value && <div class="tw:px-2 tw:py-1 tw:text-[0.72rem] tw:text-(--hud-fg-3)">{t("results.none")}</div>}
    </div>
  )
}
