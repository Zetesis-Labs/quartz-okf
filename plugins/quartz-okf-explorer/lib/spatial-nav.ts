/**
 * Keyboard walk over the canvas, as graphacker does it: arrows go to the nearest node in
 * that direction, Tab walks the list in order. Nodes the simulation has not placed yet
 * are skipped.
 */
export type Direction = "left" | "right" | "up" | "down"

export interface NavNode {
  id: string
  x?: number
  y?: number
}

function directionScore(cx: number, cy: number, c: NavNode, dir: Direction): number | null {
  if (c.x === undefined || c.y === undefined) return null
  const dx = c.x - cx
  const dy = c.y - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return null
  let primary = 0
  let lateral = 0
  switch (dir) {
    case "left":
      if (dx >= -2) return null
      primary = -dx
      lateral = Math.abs(dy)
      break
    case "right":
      if (dx <= 2) return null
      primary = dx
      lateral = Math.abs(dy)
      break
    case "up":
      if (dy >= -2) return null
      primary = -dy
      lateral = Math.abs(dx)
      break
    case "down":
      if (dy <= 2) return null
      primary = dy
      lateral = Math.abs(dx)
      break
  }
  // Drift across the axis costs more than distance along it: the eye reads a straight line.
  return primary + lateral * 2.5 + dist * 0.2
}

export function nearestInDirection<T extends NavNode>(current: T, candidates: T[], dir: Direction): T | null {
  const cx = current.x
  const cy = current.y
  if (cx === undefined || cy === undefined) return null
  let best: T | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    if (c.id === current.id) continue
    const score = directionScore(cx, cy, c, dir)
    if (score !== null && score < bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

export function nextSequential<T extends NavNode>(current: T | null, candidates: T[], reverse = false): T | null {
  if (!candidates.length) return null
  if (!current) return reverse ? candidates[candidates.length - 1] : candidates[0]
  const idx = candidates.findIndex((c) => c.id === current.id)
  if (idx < 0) return candidates[0]
  return candidates[(idx + (reverse ? -1 : 1) + candidates.length) % candidates.length]
}
