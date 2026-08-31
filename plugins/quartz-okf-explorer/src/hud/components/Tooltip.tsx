import { useLayoutEffect, useRef } from "preact/hooks"
import { fill } from "../../../lib/template.ts"
import { useHud } from "../context.ts"

/** The hover card: title, kind, the line the consumer's template writes, and how to enter a portal. */
export function Tooltip() {
  const { state, engine, t } = useHud()
  const el = useRef<HTMLDivElement>(null)
  const tip = state.tip.value

  // Placed after render, clamped to the canvas: the card's size is only known once it exists.
  useLayoutEffect(() => {
    if (!tip || !el.current) return
    const { width, height } = engine.size()
    const r = el.current.getBoundingClientRect()
    el.current.style.left = `${Math.max(8, Math.min(tip.px + 14, width - r.width - 8))}px`
    el.current.style.top = `${Math.max(8, Math.min(tip.py + 12, height - r.height - 8))}px`
  }, [tip])

  if (!tip) return null
  const n = tip.node
  const display = state.display.value
  const tpl = display.tooltip[n.type] || display.tooltip["*"]
  const line = n.subgraph && !display.tooltip[n.type] ? t("tooltip.portal", n) : tpl ? fill(tpl, n) : t("tooltip.incoming", n)
  return (
    <div
      id="tip"
      ref={el}
      class="tw:pointer-events-none tw:absolute tw:z-50 tw:max-w-[340px] tw:rounded-lg tw:border tw:border-(--hud-border) tw:bg-(--hud-bg) tw:px-2.5 tw:py-2 tw:text-[0.85rem] tw:text-(--hud-fg) tw:shadow-(--hud-shadow)"
    >
      <b>{n.title}</b> <small class="tw:text-(--hud-fg-2)">· {display.labels[n.type] || n.type}</small>
      {n.federated && (
        <>
          {" "}
          <span class="okf-badge">{n.federated}</span>
        </>
      )}
      <br />
      <small class="tw:text-(--hud-fg-2)">{line}</small>
      {n.subgraph && (
        <>
          <br />
          <small class="tw:text-(--hud-fg-2)">{t("tooltip.portal.hint")}</small>
        </>
      )}
      {n.desc && <div class="tw:mt-1.5 tw:border-t tw:border-(--hud-border) tw:pt-1.5 tw:text-[0.78rem] tw:leading-snug tw:text-(--hud-fg-2)">{n.desc}</div>}
    </div>
  )
}
