import { useRef } from "preact/hooks"
import { pinnedTabs } from "../../../lib/dock.ts"
import { trailView } from "../../../lib/hud.ts"
import { useHud } from "../context.ts"

/** The top bar, always on screen: where the reader is, the notes they pinned, and the way out. */
export function TrailBar() {
  const { state, ctl, actions, t } = useHud()
  const v = trailView({ rootTitle: state.rootTitle, trail: state.trail.value, graphCount: ctl.graphCount(), scope: state.scope.value }, t)
  const pins = pinnedTabs(state.dock.value)
  const shown = state.dock.value.active
  return (
    <div id="bar" class="okf-island tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:py-1.5 tw:pr-2 tw:pl-3 tw:max-[900px]:flex-wrap">
      <nav id="trail" class="tw:flex tw:shrink-0 tw:items-center tw:gap-0.5 tw:whitespace-nowrap tw:text-[0.86rem] tw:max-[900px]:min-w-0 tw:max-[900px]:flex-1">
        {v.levels.map((l, i) =>
          l.current ? (
            <b key={l.index} class="tw:min-w-16 tw:shrink tw:overflow-hidden tw:text-ellipsis tw:rounded-md tw:px-1.5 tw:py-0.5 tw:font-semibold tw:text-(--hud-fg)" title={l.text}>
              {l.text}
            </b>
          ) : (
            <span key={l.index} class="tw:contents">
              <button
                type="button"
                class="tw:min-w-12 tw:max-w-72 tw:shrink-[4] tw:cursor-pointer tw:overflow-hidden tw:text-ellipsis tw:rounded-md tw:border-0 tw:bg-transparent tw:px-1.5 tw:py-0.5 tw:text-(--hud-fg-2) tw:hover:bg-(--hud-hover) tw:hover:text-(--hud-fg)"
                title={t("trail.back", { graph: l.text })}
                onClick={() => void ctl.backTo(l.index)}
              >
                {l.text}
              </button>
              {i < v.levels.length - 1 && <span class="tw:text-(--hud-fg-3)">›</span>}
            </span>
          ),
        )}
      </nav>
      {pins.length > 0 && (
        <div
          id="pins"
          // On a narrow screen the pins take a row of their own: a basis of 100% is what
          // makes the flex line break, which `flex-1` (basis 0) would never do.
          class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-1 tw:overflow-x-auto tw:overscroll-x-contain tw:max-[900px]:order-last tw:max-[900px]:w-full tw:max-[900px]:flex-[1_0_100%]"
          style={{ scrollbarWidth: "thin" }}
        >
          {pins.map((tab) => (
            <span
              key={tab.id}
              class={`okf-chip tw:max-w-56 tw:shrink-0 tw:pr-1 ${tab.id === shown ? "tw:border-transparent tw:bg-(--hud-active) tw:font-semibold tw:text-(--hud-fg)" : ""}`}
              role="button"
              tabIndex={0}
              title={tab.title}
              onClick={() => ctl.activateTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  ctl.activateTab(tab.id)
                }
              }}
            >
              <span class="okf-dot" style={{ background: state.display.value.colors[tab.type] || "#888" }} />
              <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">{tab.title}</span>
              <button
                type="button"
                class="tw:cursor-pointer tw:rounded tw:border-0 tw:bg-transparent tw:px-0.5 tw:text-[0.85em] tw:opacity-50 tw:hover:bg-(--hud-hover) tw:hover:opacity-100"
                aria-label={t("dock.tab.close")}
                onClick={(e) => {
                  e.stopPropagation()
                  ctl.closeTab(tab.id)
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <button type="button" class="okf-icon tw:ml-auto tw:shrink-0" title={t("access.close")} aria-label={t("access.close")} onClick={() => actions.close()}>
        ✕
      </button>
    </div>
  )
}

/** The omnibar: a floating capsule under the bar — scope, the search box, and the palette behind `>`. */
export function Omnibar() {
  const { state, ctl, actions, t } = useHud()
  const input = useRef<HTMLInputElement>(null)
  const v = trailView({ rootTitle: state.rootTitle, trail: state.trail.value, graphCount: ctl.graphCount(), scope: state.scope.value }, t)
  const placeholder = state.scope.value === "all" ? t("search.placeholder.all") : t("search.placeholder")
  return (
    <div id="omnibar" class="okf-island okf-omnibar tw:flex tw:w-full tw:items-center tw:gap-1.5 tw:rounded-full tw:py-1 tw:pr-1.5 tw:pl-2.5">
      {v.scopeKey && (
        <button
          type="button"
          class={`tw:shrink-0 tw:cursor-pointer tw:rounded-full tw:border tw:px-2 tw:font-mono tw:text-[0.68rem] tw:font-semibold tw:leading-relaxed tw:tracking-wide ${v.scopeKey.active ? "tw:border-transparent tw:bg-(--accent-soft) tw:text-(--accent)" : "tw:border-(--hud-border) tw:bg-transparent tw:text-(--hud-fg-2) tw:hover:bg-(--hud-active)"}`}
          title={t("scope.toggle")}
          onClick={() => {
            ctl.toggleScope()
            input.current?.focus()
          }}
        >
          ⇥ {v.scopeKey.text}
        </button>
      )}
      <input
        id="q"
        ref={input}
        type="search"
        autocomplete="off"
        spellcheck={false}
        class="tw:min-w-20 tw:flex-1 tw:border-0 tw:bg-transparent tw:px-1.5 tw:py-1 tw:text-[0.9rem] tw:text-inherit tw:outline-none tw:placeholder:text-(--hud-fg-3)"
        placeholder={placeholder}
        title={t("search.hint")}
        value={state.query.value}
        onInput={(e) => {
          state.query.value = (e.currentTarget as HTMLInputElement).value
          ctl.search()
        }}
        onFocus={() => ctl.showResults()}
        onKeyDown={(e) => actions.omnibarKeydown(e, e.currentTarget as HTMLInputElement)}
      />
      {state.query.value && (
        <button
          type="button"
          class="okf-icon"
          title={t("search.clear")}
          onClick={() => {
            ctl.clearSearch({ restore: true })
            input.current?.focus()
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
