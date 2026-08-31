import { useEffect, useRef } from "preact/hooks"
import { dockOpen } from "../../lib/dock.ts"
import { Omnibar, TrailBar } from "./components/Bar.tsx"
import { ContextMenu } from "./components/ContextMenu.tsx"
import { Dock } from "./components/Dock.tsx"
import { Filters } from "./components/Filters.tsx"
import { Portals } from "./components/Portals.tsx"
import { Results } from "./components/Results.tsx"
import { SideMenu } from "./components/SideMenu.tsx"
import { Selection } from "./components/Selection.tsx"
import { Toast } from "./components/Toast.tsx"
import { Tooltip } from "./components/Tooltip.tsx"
import { Views } from "./components/Views.tsx"
import { useHud } from "./context.ts"

export interface HudProps {
  initial: { graph: string | null; focus: string | null }
}

/** The explorer's root: the canvas, and every island floating over it. */
export function Hud({ initial }: HudProps) {
  const { state, ctl, engine, actions, t, cfg } = useHud()
  const canvas = useRef<HTMLCanvasElement>(null)
  const north = useRef<HTMLDivElement>(null)
  const stack = useRef<HTMLElement>(null)
  const dockIsOpen = dockOpen(state.dock.value)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    // The bar is always on screen; on narrow viewports the dock sits under it, so its height
    // is published as a custom property whenever it changes.
    const bar = north.current?.querySelector<HTMLElement>("#bar")
    const root = el.parentElement
    const barSize = new ResizeObserver(() => {
      if (bar && root) root.style.setProperty("--bar-h", `${bar.offsetHeight}px`)
    })
    if (bar) barSize.observe(bar)
    engine.mount(el, {
      onHover: (node, px, py) => {
        state.tip.value = node ? { node, px, py } : null
      },
      // Click on a node opens its note; the neighbourhood highlight is the hover's job and the
      // persistent selection the search's, so a click never moves the camera by surprise.
      onClick: (node, ev) => {
        if (!node) {
          if (state.selected.value) ctl.deselect()
          return
        }
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey) {
          window.open(node.url, "_blank")
          return
        }
        ctl.openNote(node)
      },
      onDblClick: (node) => {
        if (node.subgraph) {
          void ctl.enterSubgraph(node)
          return
        }
        ctl.openNote(node)
        ctl.pinNote(node.id, true)
      },
      onContextMenu: (node, x, y) => actions.openMenu(node, x, y),
      onCameraTouched: () => {},
    })
    engine.setFreeRects(() => ({
      north: north.current?.getBoundingClientRect() ?? null,
      stack: stack.current?.getBoundingClientRect() ?? null,
      dock: document.getElementById("dock")?.getBoundingClientRect() ?? null,
    }))
    const onKey = (ev: KeyboardEvent) => actions.keydown(ev)
    const onPointer = (ev: PointerEvent) => actions.pointerdown(ev)
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer, true)
    void ctl.start(initial)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer, true)
      barSize.disconnect()
      engine.destroy()
    }
  }, [])

  return (
    <div class="tw:relative tw:h-full tw:w-full" style={{ "--bar-h": "3rem" }}>
      <canvas ref={canvas} class="okf-canvas tw:absolute tw:inset-0 tw:block tw:h-full tw:w-full" />
      <div class="okf-layer tw:absolute tw:inset-0">
        <Portals />
        <div ref={north} class="okf-layer tw:absolute tw:top-2.5 tw:right-3 tw:left-3 tw:z-30 tw:flex tw:flex-col tw:items-center tw:gap-2 tw:max-[900px]:right-2 tw:max-[900px]:left-2">
          <TrailBar />
          {/* The omnibar centres on the canvas the dock leaves free; the bar above spans the whole width. */}
          <div class={`tw:flex tw:justify-center tw:transition-[width] tw:duration-200 tw:max-[900px]:w-full ${dockIsOpen ? "tw:w-[calc(100%-var(--dock-w)-1rem)] tw:self-start" : "tw:w-full"}`}>
            <div class="tw:flex tw:w-[min(40rem,100%)] tw:flex-col tw:gap-2">
              <Omnibar />
              <Results />
            </div>
          </div>
        </div>
        <aside ref={stack} class="okf-layer tw:absolute tw:bottom-3 tw:left-3 tw:z-20 tw:flex tw:max-h-[calc(100%-1.6rem)] tw:w-72 tw:flex-col tw:justify-end tw:gap-2 tw:max-[900px]:w-[calc(100%-1.6rem)]">
          <Selection />
          <Views />
          <Filters />
        </aside>
        <SideMenu />
        <Dock />
        <Tooltip />
        <ContextMenu />
        <Toast />
        {!dockIsOpen && (
          <div class="okf-island tw:pointer-events-none tw:absolute tw:bottom-3.5 tw:left-1/2 tw:z-20 tw:-translate-x-1/2 tw:whitespace-nowrap tw:rounded-full tw:px-3 tw:py-0.5 tw:text-[0.7rem] tw:text-(--hud-fg-3) tw:max-[900px]:hidden">
            {t("keyboard.hint")} · {cfg.title}
          </div>
        )}
      </div>
    </div>
  )
}
