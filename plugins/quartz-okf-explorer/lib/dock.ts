export interface DockTab {
  id: string
  title: string
  type: string
  url: string
  pinned: boolean
}

export interface DockState {
  tabs: DockTab[]
  active: string | null
}

export type DockNote = Pick<DockTab, "id" | "title" | "type" | "url">

export const EMPTY_DOCK: DockState = { tabs: [], active: null }

export const dockOpen = (dock: DockState): boolean => dock.tabs.length > 0

/**
 * A note opens as the dock's one temporary tab: it takes the place of the previous
 * temporary tab, or goes after the pinned ones. A note already open is only activated.
 */
export function openTab(dock: DockState, note: DockNote): DockState {
  if (dock.tabs.some((t) => t.id === note.id)) return { tabs: dock.tabs, active: note.id }
  const tab: DockTab = { id: note.id, title: note.title, type: note.type, url: note.url, pinned: false }
  const temp = dock.tabs.findIndex((t) => !t.pinned)
  const tabs = temp >= 0 ? dock.tabs.map((t, i) => (i === temp ? tab : t)) : [...dock.tabs, tab]
  return { tabs, active: note.id }
}

export function pinTab(dock: DockState, id: string, pinned = true): DockState {
  if (!dock.tabs.some((t) => t.id === id)) return dock
  return { tabs: dock.tabs.map((t) => (t.id === id ? { ...t, pinned } : t)), active: dock.active }
}

export function activateTab(dock: DockState, id: string): DockState {
  if (!dock.tabs.some((t) => t.id === id)) return dock
  return { tabs: dock.tabs, active: id }
}

/** Closing a tab activates the one that takes its place; closing the last one empties the dock. */
export function closeTab(dock: DockState, id: string): DockState {
  const i = dock.tabs.findIndex((t) => t.id === id)
  if (i < 0) return dock
  const tabs = dock.tabs.filter((t) => t.id !== id)
  if (!tabs.length) return { tabs: [], active: null }
  if (dock.active !== id) return { tabs, active: dock.active }
  return { tabs, active: tabs[Math.min(i, tabs.length - 1)].id }
}
