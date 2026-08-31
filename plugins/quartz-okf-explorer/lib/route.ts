import type { RouteStep } from "./types.ts"

/**
 * How to get from the graph on screen to another one: back to the deepest common ancestor
 * in one step, then one dive per portal. Paths are lists of subgraph ids from the root.
 */
export function routeTo(currentPath: string[], targetPath: string[]): RouteStep[] {
  let common = 0
  while (common < currentPath.length && common < targetPath.length && currentPath[common] === targetPath[common]) common++
  const steps: RouteStep[] = []
  if (currentPath.length > common) steps.push({ back: common })
  for (const id of targetPath.slice(common)) steps.push({ dive: id })
  return steps
}
