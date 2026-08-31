import { indexGraph } from "./model.ts"
import type { HudModel, RawGraph, Registry, RegistryEntry } from "./types.ts"

const entry = (key: string, title: string, url: string, path: string[], model: HudModel | null): RegistryEntry => ({
  key,
  title,
  url,
  path,
  model,
  error: null,
})

function addPortals(registry: Registry, model: HudModel, path: string[]): void {
  for (const n of model.nodes.values()) {
    if (!n.subgraph || registry.has(n.subgraph.id)) continue
    const s = n.subgraph
    registry.set(s.id, entry(s.id, s.title || s.id, s.graph, [...path, s.id], null))
  }
}

/** Every graph the site publishes, as far as the loaded graphs reveal it: the root and each portal. */
export function registryFrom(model: HudModel, { title, url }: { title: string; url: string }): Registry {
  const registry: Registry = new Map()
  registry.set("", entry("", title, url, [], model))
  addPortals(registry, model, [])
  return registry
}

export function expandRegistry(registry: Registry, key: string, model: HudModel): void {
  const e = registry.get(key)
  if (!e) throw new Error(`quartz-okf-explorer: graph "${key}" is not in the registry`)
  e.model = model
  e.error = null
  addPortals(registry, model, e.path)
}

/** Loads the graphs still missing. A failure is recorded on its entry, named after the graph. */
export async function loadGraphs(registry: Registry, keys: string[], fetchGraph: (url: string) => Promise<RawGraph>): Promise<Registry> {
  await Promise.all(
    keys.map(async (key) => {
      const e = registry.get(key)
      if (!e || e.model) return
      try {
        expandRegistry(registry, key, indexGraph(await fetchGraph(e.url)))
      } catch (err) {
        e.error = `${e.title}: ${err instanceof Error ? err.message : String(err)}`
      }
    }),
  )
  return registry
}
