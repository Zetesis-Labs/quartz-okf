import type { Translator } from "./types.ts"

/** A command the palette lists: the shell runs it by id. */
export interface CommandEntry {
  id: string
  label: string
  keywords: string[]
}

/** A row of the context menu; a separator has no id. */
export interface MenuItem {
  id?: string
  label?: string
  danger?: boolean
  sep?: true
}

export interface CommandContext {
  modes: { id: string; label: string }[]
  modeId: string
  portals: { id: string; title: string }[]
  inSubgraph: boolean
  parentTitle: string | null
  selected: { id: string; title: string; subgraph: boolean } | null
  dockOpen: boolean
}

export const isPaletteQuery = (query: string): boolean => query.trimStart().startsWith(">")

const words = (...texts: string[]): string[] => texts.join(" ").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Every command the graph on screen allows, in a stable order; the active mode is not offered. */
export function commandList(ctx: CommandContext, t: Translator): CommandEntry[] {
  const list: CommandEntry[] = [
    { id: "fit", label: t("fit.title"), keywords: words("fit", t("fit")) },
    { id: "clear", label: t("clear.title"), keywords: words("clear", "reset", t("clear")) },
  ]
  for (const m of ctx.modes) {
    if (m.id === ctx.modeId) continue
    list.push({ id: `mode:${m.id}`, label: t("cmd.mode", { label: m.label }), keywords: words("mode", "view", m.id, m.label) })
  }
  for (const p of ctx.portals) {
    list.push({ id: `enter:${p.id}`, label: t("cmd.enter", { graph: p.title }), keywords: words("enter", "explore", "subgraph", p.title) })
  }
  if (ctx.inSubgraph) list.push({ id: "back", label: t("trail.back", { graph: ctx.parentTitle ?? "" }), keywords: words("back", "up", "parent") })
  if (ctx.selected) {
    list.push({ id: "open-selected", label: t("cmd.open"), keywords: words("open", "note", ctx.selected.title) })
    list.push({ id: "pin-selected", label: t("cmd.pin"), keywords: words("pin", "dock", ctx.selected.title) })
    if (ctx.selected.subgraph) list.push({ id: "explore-selected", label: t("cmd.explore"), keywords: words("explore", "subgraph", ctx.selected.title) })
  }
  if (ctx.dockOpen) list.push({ id: "close-dock", label: t("cmd.close.dock"), keywords: words("close", "dock", "panel") })
  list.push({ id: "copy-link", label: t("cmd.copy"), keywords: words("copy", "link", "url", "share") })
  return list
}

/** The palette's rows for a query: the `>` is dropped; nothing typed lists everything. */
export function matchCommands(commands: CommandEntry[], query: string): CommandEntry[] {
  const clean = query.trimStart().replace(/^>/, "").trim().toLowerCase()
  if (!clean) return commands
  return commands.filter((c) => c.label.toLowerCase().includes(clean) || c.keywords.some((k) => k.includes(clean)))
}

export function nodeMenuItems({ portal }: { portal: boolean }, t: Translator): MenuItem[] {
  const items: MenuItem[] = [
    { id: "open", label: t("menu.open") },
    { id: "open-new", label: t("menu.open.new") },
    { id: "pin", label: t("menu.pin") },
    { id: "frame", label: t("menu.frame") },
  ]
  if (portal) items.push({ id: "explore", label: t("selection.explore") })
  items.push({ sep: true }, { id: "copy-link", label: t("menu.copy") })
  return items
}

export function backgroundMenuItems(t: Translator): MenuItem[] {
  return [
    { id: "fit", label: t("fit.title") },
    { id: "clear", label: t("clear.title") },
  ]
}
