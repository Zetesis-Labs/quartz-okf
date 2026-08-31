import type { FederatedFrom } from "../../lib/types.ts"
import type { ExplorerUrlState } from "./url-state.ts"

/** Where the reader was when they entered a subgraph: enough to land back exactly there. */
export interface Level {
  url: string
  selectedId: string | null
  title: string | null
  modeId: string
  id: string | null
}

/** The stack of graphs left behind, and the id of the one on screen (null at the root). */
export interface Levels {
  stack: Level[]
  currentId: string | null
}

export interface TrailEntry {
  id: string
  title: string | null
}

export const ROOT_LEVELS: Levels = { stack: [], currentId: null }

export const inSubgraph = (levels: Levels): boolean => levels.stack.length > 0

export const currentKey = (levels: Levels): string => levels.currentId ?? ""

export function enterLevel(levels: Levels, from: Level, targetId: string): Levels {
  return { stack: [...levels.stack, from], currentId: targetId }
}

export function backTo(levels: Levels, level: number): { levels: Levels; destination: Level } | null {
  if (level < 0 || level >= levels.stack.length) return null
  const destination = levels.stack[level]
  return { levels: { stack: levels.stack.slice(0, level), currentId: destination.id }, destination }
}

/** The graphs below the root, the one on screen last; the root is the trail's own first level. */
export function trailFor(levels: Levels, currentTitle: string): TrailEntry[] {
  if (!inSubgraph(levels)) return []
  const above = levels.stack.slice(1).map((l) => ({ id: l.id ?? "", title: l.title }))
  return [...above, { id: levels.currentId ?? "", title: currentTitle }]
}

export const currentPath = (levels: Levels): string[] =>
  inSubgraph(levels) ? [...levels.stack.slice(1).map((l) => l.id ?? ""), levels.currentId ?? ""] : []

/** The stack index holding a graph id (the root is null), or -1 when it is not behind us. */
export function levelOf(levels: Levels, id: string | null): number {
  return levels.stack.findIndex((l) => (l.id ?? null) === (id ?? null))
}

/** Opened straight inside a subgraph: the root is a synthetic level, completed once the child says where it came from. */
export function directEntry(rootUrl: string, rootModeId: string, id: string): Levels {
  return { stack: [{ url: rootUrl, selectedId: null, title: null, modeId: rootModeId, id: null }], currentId: id }
}

export function withRootContext(levels: Levels, from: FederatedFrom | null | undefined): Levels {
  const [root, ...rest] = levels.stack
  if (!root) return levels
  return { ...levels, stack: [{ ...root, selectedId: from?.node ?? null, title: from?.title ?? null }, ...rest] }
}

export type PopAction = { close: true } | { none: true } | { back: number } | { enter: string }

/** What a history entry asks of the explorer: close it, go back to a level behind, or enter a graph. */
export function popAction(levels: Levels, url: ExplorerUrlState): PopAction {
  if (!url.open) return { close: true }
  const id = url.graph
  if ((id ?? null) === (levels.currentId ?? null)) return { none: true }
  const level = levelOf(levels, id)
  if (level >= 0) return { back: level }
  if (id) return { enter: id }
  return { none: true }
}
