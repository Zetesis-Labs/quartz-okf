import { backgroundMenuItems, commandList, matchCommands, nodeMenuItems, type CommandContext, type CommandEntry } from "../../lib/commands.ts"
import { dockOpen } from "../../lib/dock.ts"
import { dismissOrder } from "../../lib/hud.ts"
import { currentKey } from "../../lib/navigation.ts"
import { nearestInDirection, type Direction } from "../../lib/spatial-nav.ts"
import type { ExplorerEmitConfig, Translator, ViewNode } from "../../lib/types.ts"
import { searchWithState } from "../../lib/url-state.ts"
import type { Engine } from "./canvas/engine.ts"
import type { Controller } from "./controller.ts"
import type { HudState } from "./state.ts"

/**
 * One dispatcher for everything the reader can ask: command and menu ids, the keyboard,
 * the pointer's dismissals. Which items exist and what they are called is decided in
 * `lib/commands.ts`; here each id is wired to the controller and the engine.
 */
export interface Actions {
  run(id: string, node?: ViewNode | null): void
  commands(): CommandEntry[]
  paletteRows(): CommandEntry[]
  openMenu(node: ViewNode | null, x: number, y: number): void
  closeMenu(): void
  keydown(ev: KeyboardEvent): void
  omnibarKeydown(ev: KeyboardEvent, input: HTMLInputElement): void
  pointerdown(ev: PointerEvent): void
  escape(): void
  close(): void
  navigate(url: string): void
  focusOmnibar(): void
}

export interface ActionsOptions {
  cfg: ExplorerEmitConfig
  t: Translator
  state: HudState
  ctl: Controller
  engine: Engine
  close(): void
  navigate(url: string): void
  omnibar(): HTMLInputElement | null
  canvasRect(): DOMRect | null
}

const typing = (el: Element | null): boolean =>
  Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable))

const DIRECTIONS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }
// Tab is not here on purpose: it moves between the HUD's controls, like anywhere else on the
// web. The graph is walked with the arrows, which read the layout instead of a list order.
const WALK_KEYS = new Set(["Enter", " ", ...Object.keys(DIRECTIONS)])

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

const stageOf = (): HTMLElement | null => document.querySelector<HTMLElement>(".okf-explorer-stage")

function focusables(stage: HTMLElement): HTMLElement[] {
  return [...stage.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  )
}

/**
 * The explorer covers the page, so the focus must not walk behind it: Tab cycles inside the
 * stage. Without this the next Tab lands on a control nobody can see.
 */
function trapTab(ev: KeyboardEvent, active: Element | null): void {
  const stage = stageOf()
  if (!stage) return
  const list = focusables(stage)
  if (list.length === 0) return
  const inside = active instanceof HTMLElement && stage.contains(active)
  const index = inside ? list.indexOf(active) : -1
  const next = ev.shiftKey ? index - 1 : index + 1
  if (inside && next >= 0 && next < list.length) return
  ev.preventDefault()
  ;(ev.shiftKey ? list[list.length - 1] : list[0]).focus()
}

export function createActions({ t, state, ctl, engine, close, navigate, omnibar, canvasRect }: ActionsOptions): Actions {
  function commandContext(): CommandContext {
    const sel = state.selected.value
    const trail = state.trail.value
    const parentTitle = trail.length > 1 ? (trail[trail.length - 2].title ?? null) : state.rootTitle
    return {
      modes: state.display.value.modes.map((m) => ({ id: m.id, label: m.label })),
      modeId: state.modeId.value,
      portals: [...state.data.value.nodes.values()].filter((n) => n.subgraph).map((n) => ({ id: n.id, title: n.subgraph?.title || n.subgraph?.id || n.title })),
      inSubgraph: state.inSubgraph.value,
      parentTitle,
      selected: sel ? { id: sel.id, title: sel.title, subgraph: Boolean(sel.subgraph) } : null,
      dockOpen: dockOpen(state.dock.value),
    }
  }

  const commands = () => commandList(commandContext(), t)
  const paletteRows = () => matchCommands(commands(), state.query.value)

  function copyLink(node?: ViewNode | null): void {
    const graph = currentKey(state.levels.value) || null
    const focus = node?.id ?? state.selected.value?.id ?? null
    const url = location.origin + location.pathname + searchWithState(location.search, { open: true, graph, focus })
    navigator.clipboard?.writeText(url).then(
      () => ctl.toast(t("menu.copied")),
      (err: unknown) => console.warn(`[quartz-okf-explorer] clipboard: ${err instanceof Error ? err.message : String(err)}`),
    )
  }

  function run(id: string, node?: ViewNode | null): void {
    const n = node ?? state.selected.value
    state.contextMenu.value = null
    if (id === "fit") return engine.fit()
    if (id === "clear") return ctl.clearAll()
    if (id.startsWith("mode:")) return void ctl.changeMode(id.slice(5))
    if (id.startsWith("enter:")) {
      const portal = state.view.value?.idx.get(id.slice(6)) ?? (state.data.value.nodes.get(id.slice(6)) as ViewNode | undefined)
      if (portal) void ctl.enterSubgraph(portal)
      return
    }
    if (id === "back") return void ctl.backTo(state.levels.value.stack.length - 1)
    if (id === "close-dock") return ctl.closeDock()
    if (id === "copy-link") return copyLink(node)
    if (!n) return
    if (id === "open" || id === "open-selected") return ctl.openNote(n)
    if (id === "open-new") return void window.open(n.url, "_blank")
    if (id === "pin" || id === "pin-selected") {
      ctl.openNote(n)
      ctl.pinNote(n.id, true)
      return
    }
    if (id === "frame") return ctl.frame(n)
    if (id === "explore" || id === "explore-selected") return void ctl.enterSubgraph(n)
    console.warn(`[quartz-okf-explorer] unknown command "${id}"`)
  }

  function openMenu(node: ViewNode | null, x: number, y: number): void {
    const items = node ? nodeMenuItems({ portal: Boolean(node.subgraph) }, t) : backgroundMenuItems(t)
    state.contextMenu.value = { x, y, items, node }
  }

  const closeMenu = () => {
    state.contextMenu.value = null
  }

  function escape(): void {
    if (state.contextMenu.value) return closeMenu()
    const step = dismissOrder({ menu: state.sideMenu.value, results: state.resultsOpen.value, selected: state.selected.value, dock: dockOpen(state.dock.value) })
    if (step === "menu") state.sideMenu.value = null
    else if (step === "results") ctl.hideResults()
    else if (step === "selection") ctl.deselect()
    else if (step === "dock") ctl.closeDock()
    else if (state.keyboardFocus.value) state.keyboardFocus.value = null
    else close()
  }

  function focusOmnibar(): void {
    const q = omnibar()
    if (q) {
      q.focus()
      q.select()
    }
  }

  function walk(next: ViewNode | null): void {
    if (!next) return
    state.keyboardFocus.value = next
    engine.fit([next], 2.6)
  }

  function keydown(ev: KeyboardEvent): void {
    // A handler on the element ran first and already answered (the omnibar's own Tab, say).
    if (ev.defaultPrevented) return
    const active = document.activeElement
    if (ev.key === "Escape") {
      if (active === omnibar()) return
      escape()
      return
    }
    if (ev.key === "Tab") {
      trapTab(ev, active)
      return
    }
    if (ev.key === "/" && !typing(active)) {
      ev.preventDefault()
      focusOmnibar()
      return
    }
    if (typing(active)) return
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return
    // Reading in the dock keeps its own keyboard: Space scrolls the article and Enter follows
    // its links; the canvas's walk only answers when nothing on the HUD has the focus.
    if (active?.closest("#dock")) return
    const onCanvas = !active || active === document.body || active.tagName === "CANVAS"
    if (!onCanvas) {
      if (WALK_KEYS.has(ev.key)) return
      // A letter typed on a control belongs to that control, not to the search box.
      if (active.tagName === "BUTTON" || active.tagName === "A" || active.tagName === "LABEL") return
    }
    const nodes = state.view.value?.nodes.filter((n) => n.x !== undefined) ?? []
    const focused = state.keyboardFocus.value
    if (ev.key in DIRECTIONS && nodes.length) {
      ev.preventDefault()
      walk(nearestInDirection(focused ?? nodes[0], nodes, DIRECTIONS[ev.key]))
      return
    }
    if (ev.key === "Enter" && focused) {
      ev.preventDefault()
      if (focused.subgraph) void ctl.enterSubgraph(focused)
      else ctl.openNote(focused)
      return
    }
    if (ev.key === " " && focused) {
      ev.preventDefault()
      const tf = engine.transform()
      openMenu(focused, tf.applyX(focused.x ?? 0), tf.applyY(focused.y ?? 0))
      return
    }
    // A printable key anywhere goes to the omnibar: it is focused before the browser inserts
    // the character, and the character lands in the box.
    if (ev.key.length === 1) omnibar()?.focus()
  }

  function omnibarKeydown(ev: KeyboardEvent, input: HTMLInputElement): void {
    if (ev.key === "Tab" && !state.palette.value) {
      ev.preventDefault()
      ctl.toggleScope()
      return
    }
    const rows = state.palette.value ? paletteRows().length : state.hits.value.length
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!rows) return
      ev.preventDefault()
      state.highlight.value = (state.highlight.value + (ev.key === "ArrowDown" ? 1 : rows - 1)) % rows
      return
    }
    if (ev.key === "Enter") {
      ev.preventDefault()
      if (state.palette.value) {
        const cmd = paletteRows()[state.highlight.value]
        if (cmd) {
          ctl.clearSearch()
          input.blur()
          run(cmd.id)
        }
        return
      }
      if (state.hits.value.length) void ctl.activateHit(state.hits.value[state.highlight.value])
      else if (state.searchQuery.value) {
        const q = state.searchQuery.value
        const matches = state.view.value?.nodes.filter((n) => n.title.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) ?? []
        engine.fit(matches, 2.6)
      }
      return
    }
    if (ev.key === "Escape") {
      ev.preventDefault()
      if (input.value) ctl.clearSearch({ restore: true })
      else input.blur()
    }
  }

  function pointerdown(ev: PointerEvent): void {
    const target = ev.target as Element | null
    if (state.contextMenu.value && !target?.closest("#ctx")) closeMenu()
    if (state.sideMenu.value && !target?.closest("#side, #filters")) state.sideMenu.value = null
    if (state.resultsOpen.value && !target?.closest("#omnibar, #results")) ctl.hideResults()
    void canvasRect
  }

  return { run, commands, paletteRows, openMenu, closeMenu, keydown, omnibarKeydown, pointerdown, escape, close, navigate, focusOmnibar }
}
