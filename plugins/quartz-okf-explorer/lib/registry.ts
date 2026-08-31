import { indexGraph } from "./model.js"

const entry = (key, title, url, path, model) => ({ key, title, url, path, model, error: null })

function addPortals(registry, model, path) {
  for (const n of model.nodes.values()) {
    if (!n.subgraph || registry.has(n.subgraph.id)) continue
    const s = n.subgraph
    registry.set(s.id, entry(s.id, s.title || s.id, s.graph, [...path, s.id], null))
  }
}

/** Every graph the site publishes, as far as the loaded graphs reveal it: the root and each portal. */
export function registryFrom(model, { title, url }) {
  const registry = new Map()
  registry.set("", entry("", title, url, [], model))
  addPortals(registry, model, [])
  return registry
}

export function expandRegistry(registry, key, model) {
  const e = registry.get(key)
  if (!e) throw new Error(`quartz-okf-explorer: graph "${key}" is not in the registry`)
  e.model = model
  e.error = null
  addPortals(registry, model, e.path)
}

/** Loads the graphs still missing. A failure is recorded on its entry, named after the graph. */
export async function loadGraphs(registry, keys, fetchGraph) {
  await Promise.all(
    keys.map(async (key) => {
      const e = registry.get(key)
      if (!e || e.model) return
      try {
        expandRegistry(registry, key, indexGraph(await fetchGraph(e.url)))
      } catch (err) {
        e.error = `${e.title}: ${err.message}`
      }
    }),
  )
  return registry
}
