import { dockOpen } from "../../../lib/dock.ts"
import { useHud } from "../context.ts"

/** The reading dock: one note over the canvas — the site's own article, fetched — with pin, open and close. */
export function Dock() {
  const { state, ctl, actions, t } = useHud()
  const dock = state.dock.value
  if (!dockOpen(dock)) return null
  const tab = dock.tabs.find((x) => x.id === dock.active)
  if (!tab) return null
  const node = state.view.value?.idx.get(tab.id)
  const content = state.dockContent.value.get(tab.id)
  return (
    <aside
      id="dock"
      // Wide: the dock hangs under the bar, beside the search capsule. Narrow: it spans the whole
      // width, so it starts under the capsule as well — otherwise the capsule hides this header.
      class="okf-island tw:absolute tw:top-[calc(var(--bar-h)+1.1rem)] tw:right-3 tw:bottom-3 tw:z-25 tw:flex tw:w-(--dock-w) tw:flex-col tw:overflow-hidden tw:max-[900px]:top-[calc(var(--bar-h)+var(--omni-h)+1.6rem)] tw:max-[900px]:right-0 tw:max-[900px]:bottom-0 tw:max-[900px]:left-0 tw:max-[900px]:w-auto tw:max-[900px]:rounded-b-none"
    >
      <header class="tw:flex tw:min-h-8 tw:items-center tw:gap-2 tw:border-b tw:border-(--hud-border) tw:py-1.5 tw:pr-2 tw:pl-3">
        <span class="okf-dot" style={{ background: state.display.value.colors[tab.type] || "#888" }} />
        <span class={`tw:min-w-0 tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:text-[0.84rem] tw:font-semibold ${tab.pinned ? "" : "tw:italic"}`} title={tab.pinned ? tab.title : t("dock.tab.temp", { title: tab.title })}>
          {tab.title}
        </span>
        <button
          type="button"
          class="okf-icon"
          aria-pressed={tab.pinned}
          title={tab.pinned ? t("dock.tab.unpin") : t("dock.tab.pin")}
          aria-label={tab.pinned ? t("dock.tab.unpin") : t("dock.tab.pin")}
          onClick={() => ctl.pinNote(tab.id)}
        >
          {tab.pinned ? "📌" : "📍"}
        </button>
        {node?.subgraph && (
          <button type="button" class="okf-chip mini" onClick={() => void ctl.enterSubgraph(node)}>
            {t("selection.explore")}
          </button>
        )}
        <a
          class="okf-chip mini tw:no-underline"
          href={tab.url}
          onClick={(e) => {
            e.preventDefault()
            actions.navigate(tab.url)
          }}
        >
          {t("dock.open")} ↗
        </a>
        <button type="button" class="okf-icon tw:text-[1.05rem] tw:leading-none" title={t("dock.close")} aria-label={t("dock.close")} onClick={() => ctl.closeDock()}>
          »
        </button>
      </header>
      <div class="okf-note tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain tw:px-6 tw:pt-4 tw:pb-12">
        {!content || content.kind === "loading" ? (
          <p class="tw:py-4 tw:text-[0.85rem] tw:text-(--hud-fg-2)">{t("stats.loading")}</p>
        ) : content.kind === "error" ? (
          <p class="tw:py-4 tw:text-[0.85rem] tw:text-(--hud-fg-2)">
            {content.message}{" "}
            <a class="tw:text-(--accent)" href={tab.url}>
              {t("dock.open")} ↗
            </a>
          </p>
        ) : (
          // The note's own article, as the site published it (scripts stripped): reading, not running.
          <article dangerouslySetInnerHTML={{ __html: content.html }} />
        )}
      </div>
    </aside>
  )
}
