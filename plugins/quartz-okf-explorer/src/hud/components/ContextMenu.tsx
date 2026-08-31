import { useLayoutEffect, useRef } from "preact/hooks"
import { useHud } from "../context.ts"

/** One menu element for nodes and background alike; its items are data, clamped to the canvas. */
export function ContextMenu() {
  const { state, actions, engine } = useHud()
  const el = useRef<HTMLDivElement>(null)
  const menu = state.contextMenu.value

  useLayoutEffect(() => {
    if (!menu || !el.current) return
    const { width, height } = engine.size()
    const r = el.current.getBoundingClientRect()
    el.current.style.left = `${Math.max(8, Math.min(menu.x, width - r.width - 8))}px`
    el.current.style.top = `${Math.max(8, Math.min(menu.y, height - r.height - 8))}px`
    el.current.querySelector<HTMLButtonElement>("button")?.focus()
  }, [menu])

  if (!menu) return null
  return (
    <div id="ctx" ref={el} class="okf-island tw:absolute tw:z-60 tw:min-w-52 tw:rounded-xl tw:p-1" role="menu">
      {menu.items.map((item, i) =>
        item.sep ? (
          <div key={`sep-${i}`} class="tw:mx-2 tw:my-1 tw:h-px tw:bg-(--hud-border)" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            class={`okf-row tw:text-[0.8rem] ${item.danger ? "tw:text-(--warn)" : "tw:text-(--hud-fg-2)"}`}
            onClick={() => actions.run(item.id ?? "", menu.node)}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
