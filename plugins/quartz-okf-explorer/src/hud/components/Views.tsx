import { viewsIsland } from "../../../lib/hud.ts"
import { useHud } from "../context.ts"

/** The views island: the way back up, the modes of this graph, the doors to its subgraphs. */
export function Views() {
  const { state, ctl, t } = useHud()
  const v = viewsIsland(
    { trail: state.trail.value, rootTitle: state.rootTitle, modes: state.display.value.modes, modeId: state.modeId.value, portals: state.data.value.nodes.values() },
    t,
  )
  if (v.hidden) return null
  const active = v.chips.find((c) => c.active)
  const hasDesc = v.chips.some((c) => c.desc)
  const about = state.aboutOpen.value
  return (
    <section id="views" class="okf-island tw:flex tw:max-h-[40vh] tw:flex-col tw:gap-1.5 tw:overflow-y-auto tw:overscroll-contain tw:px-2 tw:py-2 tw:max-[900px]:max-h-none">
      {v.portals.length > 0 && (
        <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:max-[900px]:flex-nowrap tw:max-[900px]:overflow-x-auto tw:max-[900px]:overscroll-x-contain">
          {v.portals.map((p) => (
            <button
              key={p.id}
              type="button"
              class="okf-chip door tw:max-[900px]:shrink-0"
              title={p.title}
              onClick={() => {
                const n = state.view.value?.idx.get(p.id) ?? state.data.value.nodes.get(p.id)
                if (n) void ctl.enterSubgraph(n)
              }}
            >
              <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">{p.text}</span>
            </button>
          ))}
        </div>
      )}
      <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:max-[900px]:flex-nowrap tw:max-[900px]:overflow-x-auto tw:max-[900px]:overscroll-x-contain">
        {v.back && (
          <button type="button" class="okf-chip" onClick={() => void ctl.backTo(v.back?.level ?? 0)}>
            <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">{v.back.text}</span>
          </button>
        )}
        {v.chips.map((c) => (
          <button key={c.id} type="button" class="okf-chip tw:max-[900px]:shrink-0" aria-pressed={c.active} onClick={() => void ctl.changeMode(c.id)}>
            <span class="tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">{c.text}</span>
          </button>
        ))}
        {hasDesc && (
          <button
            type="button"
            class="okf-icon"
            title={t("views.about")}
            aria-pressed={about}
            onClick={() => {
              state.aboutOpen.value = !about
            }}
          >
            ?
          </button>
        )}
      </div>
      {about && active?.desc && (
        // The mode's description is the consumer's own markup (`okf.config`), shown as they wrote it.
        <div class="tw:px-1 tw:text-[0.76rem] tw:leading-snug tw:text-(--hud-fg-2) tw:[&_b]:text-(--hud-fg)" dangerouslySetInnerHTML={{ __html: active.desc }} />
      )}
    </section>
  )
}
