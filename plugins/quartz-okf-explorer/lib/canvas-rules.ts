/**
 * What the draw loop decides per node and per frame, without a canvas: how faint a node
 * is, whether it is drawn on its own, whether its label shows, and what is on screen.
 */
export interface FocusContext {
  focused: boolean
  near: boolean
  hit: boolean
  selected: boolean
  hasFocus: boolean
  hasQuery: boolean
}

export function nodeAlpha(c: FocusContext): number {
  if (c.hasFocus) return c.focused || c.near ? 1 : 0.12
  if (c.hasQuery) return c.hit ? 1 : 0.12
  return 1
}

/** Ordinary nodes are batched by colour; those with a state or a marker are drawn one by one. */
export function drawnAlone(c: FocusContext, { portal, federated }: { portal: boolean; federated: boolean }): boolean {
  return c.focused || c.hit || c.selected || nodeAlpha(c) !== 1 || portal || federated
}

export interface LabelContext extends FocusContext {
  portal: boolean
  size: number
  k: number
  dimming: boolean
}

export function labelVisible(c: LabelContext): boolean {
  if (c.dimming && !(c.focused || c.near || c.hit || c.selected)) return false
  const always = c.focused || c.hit || c.selected || c.size > 8 || c.portal
  const big = c.size > 7
  return always || (c.near && c.k > 0.6) || c.k > 2.2 || (big && c.k > 0.9)
}

export const labelIsBold = (c: LabelContext): boolean => c.focused || c.hit || c.selected || c.size > 8 || c.portal

export function linkAlpha({ hasFocus, hasQuery }: { hasFocus: boolean; hasQuery: boolean }): number {
  if (hasFocus) return 0.05
  if (hasQuery) return 0.1
  return 0.34
}

export const labelText = (label: string, max = 42): string => (label.length > max ? label.slice(0, max - 1) + "…" : label)

export interface WorldRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The part of the world on screen, with a margin, so nodes just outside still get drawn while panning. */
export function viewportOf({ x, y, k }: { x: number; y: number; k: number }, width: number, height: number, pad = 80): WorldRect {
  const p = pad / k
  return { x0: -x / k - p, y0: -y / k - p, x1: (width - x) / k + p, y1: (height - y) / k + p }
}

export function inViewport(vp: WorldRect, x: number, y: number, r = 0): boolean {
  return x >= vp.x0 - r && x <= vp.x1 + r && y >= vp.y0 - r && y <= vp.y1 + r
}
