import { useHud } from "../context.ts"

/**
 * The door to another graph sits next to its portal on the canvas, always visible: it is the
 * explorer's most important action and cannot depend on a hover or a selection. The
 * buttons are rendered here; the engine moves them on every frame.
 */
export function Portals() {
  const { state, ctl, engine, t } = useHud()
  const portals = state.view.value?.nodes.filter((n) => n.subgraph) ?? []
  return (
    <div id="portals" class="okf-layer tw:absolute tw:inset-0 tw:z-15">
      {portals.map((n) => (
        <button
          key={n.id}
          type="button"
          class="okf-portal-btn"
          hidden
          ref={(el) => engine.registerPortal(n.id, el)}
          title={t("portal.title", { graph: n.subgraph?.title || n.subgraph?.id || "", notes: n.subgraph?.notes ?? 0 })}
          onClick={() => void ctl.enterSubgraph(n)}
        >
          {t("portal.explore")}
        </button>
      ))}
    </div>
  )
}
