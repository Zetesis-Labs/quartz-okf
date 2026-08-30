export const PALETTE = [
  "#4c7ecf", "#4caf7c", "#e08a3c", "#c2544d", "#9a6fbf",
  "#3fa3a3", "#b58b6a", "#8a8a8a", "#7f93ad", "#c9b04a",
]

export const FULL_MODE_ID = "__full__"

export function fullMode(t) {
  return { id: FULL_MODE_ID, label: t("mode.full"), edges: "*", desc: t("mode.full.desc") }
}

/** The vocabulary the consumer declared in `okf.config.mjs`. */
export function baseDisplay(cfg, t) {
  return {
    colors: { ...(cfg.typeColors || {}) },
    labels: { ...(cfg.typeLabels || {}) },
    edgeColors: { ...(cfg.edgeColors || {}) },
    modes: cfg.modes && cfg.modes.length ? cfg.modes : [fullMode(t)],
    kindOrder: cfg.typeOrder || cfg.knowledgeTypes || [],
    knowledgeTypes: cfg.knowledgeTypes || [],
    tooltip: cfg.tooltip || {},
  }
}

/**
 * Vocabulary of the graph on screen. At the root the consumer wins and the graph's own
 * `display` (the union of its children's) fills gaps. Inside a subgraph the child's
 * display wins — the subgraph is its explorer — and the base fills gaps. Whatever is still
 * unnamed takes a palette colour by its position in the graph's type and label lists, so
 * the assignment is stable across loads.
 */
export function displayFor(base, model, { inSubgraph, t }) {
  const d = model.display || {}
  const colors = inSubgraph ? { ...base.colors, ...(d.typeColors || {}) } : { ...(d.typeColors || {}), ...base.colors }
  const labels = inSubgraph ? { ...base.labels, ...(d.typeLabels || {}) } : { ...(d.typeLabels || {}), ...base.labels }
  const edgeColors = inSubgraph ? { ...base.edgeColors, ...(d.edgeColors || {}) } : { ...(d.edgeColors || {}), ...base.edgeColors }
  model.types.forEach((type, i) => {
    if (!colors[type]) colors[type] = PALETTE[i % PALETTE.length]
    if (!labels[type]) labels[type] = type
  })
  model.edgeLabels.forEach((label, i) => {
    if (!edgeColors[label]) edgeColors[label] = PALETTE[i % PALETTE.length]
  })
  if (!inSubgraph) {
    return { ...base, colors, labels, edgeColors }
  }
  return {
    colors,
    labels,
    edgeColors,
    modes: d.modes && d.modes.length ? d.modes : [fullMode(t)],
    kindOrder: d.typeOrder || d.knowledgeTypes || base.kindOrder,
    knowledgeTypes: d.knowledgeTypes || base.knowledgeTypes,
    tooltip: d.tooltip || base.tooltip,
  }
}

export function modeById(display, id) {
  return display.modes.find((m) => m.id === id) || display.modes[0]
}

/**
 * The document a mode draws. A mode may name its own; otherwise it asks about the graph
 * on screen — inside a subgraph, the child's, never the root's.
 */
export function modeGraphUrl(mode, currentUrl) {
  if (!mode || !mode.graph) return currentUrl
  return mode.graph[0] === "/" ? mode.graph : "/" + mode.graph
}
