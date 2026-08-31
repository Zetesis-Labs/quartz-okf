import { readPath } from "./template.ts"
import type { ExplorerMode, HudNode, RadiusOptions } from "./types.ts"

export interface ScaleStep {
  max?: number
  color: string
  label: string
}

export function scaleOf(value: number, scale: ScaleStep[]): ScaleStep | undefined {
  return scale.find((s) => value <= (s.max ?? Infinity)) || scale[scale.length - 1]
}

/**
 * Node radius. A hierarchical graph is read by rank, not by in-degree: the consumer's
 * `radius` fixes it by type or by a property; the mode's `sizeBy` comes next; the
 * in-degree is the resource for corpora without a declared hierarchy.
 */
export function sizeOf(node: HudNode, { radius, mode }: { radius?: RadiusOptions | null; mode?: ExplorerMode | null }): number {
  if (radius) {
    if (radius.byType && radius.byType[node.type] != null) return radius.byType[node.type]
    if (radius.property && radius.map) {
      const v = readPath(node.properties, radius.property)
      if (v != null && radius.map[String(v)] != null) return radius.map[String(v)]
    }
    if (radius.default != null) return radius.default
  }
  const sb = mode && mode.sizeBy
  if (sb) {
    if (sb.countEdge) return 4 + Math.min(9, (node.counts[sb.countEdge] || 0) * 0.8)
    if (sb.indegree) return 4.5 + Math.min(9, (node.indeg || 0) * 0.22)
  }
  return 4.2 + Math.min(6, (node.indeg || 0) * 0.22)
}

export interface FillContext {
  mode?: ExplorerMode | null
  colors: Record<string, string>
  knowledgeTypes: readonly string[]
}

export function fillOf(node: HudNode, { mode, colors, knowledgeTypes }: FillContext): string {
  const cb = mode && mode.colorBy
  if (cb) {
    if (cb.countEdge && (!knowledgeTypes.length || knowledgeTypes.includes(node.type))) {
      return scaleOf(node.counts[cb.countEdge] || 0, cb.scale || [])?.color || "#888"
    }
    if (cb.property) {
      const v = readPath(node.properties, cb.property)
      const entry = v != null && cb.map ? cb.map[String(v)] : undefined
      if (entry) return typeof entry === "string" ? entry : entry.color
      // A node the classification does not reach is usually an aggregator, not an unknown
      // value; the mode may tint only some types (a synthetic root is not a gap).
      if (cb.fallback) {
        const fb = typeof cb.fallback === "string" ? cb.fallback : cb.fallback[node.type]
        if (fb) return fb
      }
    }
  }
  return colors[node.type] || "#888"
}
