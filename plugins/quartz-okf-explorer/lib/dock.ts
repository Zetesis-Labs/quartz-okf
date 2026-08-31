export interface DockTab {
  id: string
  title: string
  type: string
  url: string
  pinned: boolean
}

/**
 * The reading dock shows one note at a time (`active`); the pinned ones live in the bar and
 * come back on a click. There is at most one temporary tab: the note being looked at now.
 */
export interface DockState {
  tabs: DockTab[]
  active: string | null
}

export type DockNote = Pick<DockTab, "id" | "title" | "type" | "url">

export const EMPTY_DOCK: DockState = { tabs: [], active: null }

export const dockOpen = (dock: DockState): boolean => dock.active !== null && dock.tabs.some((t) => t.id === dock.active)

export const pinnedTabs = (dock: DockState): DockTab[] => dock.tabs.filter((t) => t.pinned)

export function openTab(dock: DockState, note: DockNote): DockState {
  if (dock.tabs.some((t) => t.id === note.id)) return { tabs: dock.tabs, active: note.id }
  const tab: DockTab = { id: note.id, title: note.title, type: note.type, url: note.url, pinned: false }
  return { tabs: [...pinnedTabs(dock), tab], active: note.id }
}

/** Pinning moves the note to the bar; unpinning makes it the one temporary tab. */
export function pinTab(dock: DockState, id: string, pinned = true): DockState {
  if (!dock.tabs.some((t) => t.id === id)) return dock
  const tabs = dock.tabs.filter((t) => t.pinned || t.id === id).map((t) => (t.id === id ? { ...t, pinned } : t))
  return { tabs, active: pinned ? dock.active : id }
}

export function activateTab(dock: DockState, id: string): DockState {
  if (!dock.tabs.some((t) => t.id === id)) return dock
  return { tabs: dock.tabs, active: id }
}

/** Closing the shown note hides the dock; closing a pinned one takes it off the bar. */
export function closeTab(dock: DockState, id: string): DockState {
  if (!dock.tabs.some((t) => t.id === id)) return dock
  const tabs = dock.tabs.filter((t) => t.id !== id)
  return { tabs, active: dock.active === id ? null : dock.active }
}

export function hideDock(dock: DockState): DockState {
  if (!dock.active && !dock.tabs.some((t) => !t.pinned)) return dock
  return { tabs: pinnedTabs(dock), active: null }
}
