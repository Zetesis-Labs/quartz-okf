import { makeT, resolveLocale } from "./i18n.ts"
import type { ExplorerEmitConfig, ExplorerOptions } from "./types.ts"

const SURFACES = ["flat", "glass"] as const
type Surfaces = (typeof SURFACES)[number]

const isSurfaces = (value: string): value is Surfaces => (SURFACES as readonly string[]).includes(value)

export interface EmittedConfig {
  config: ExplorerEmitConfig
  problems: string[]
}

/**
 * The configuration inlined into the explorer page: the consumer's vocabulary as declared,
 * plus the resolved wording catalogue and the HUD switches. Problems are returned, not
 * thrown, so the emitter can log each one with its name.
 */
export function explorerConfig(opts: ExplorerOptions, siteLocale?: string): EmittedConfig {
  const { locale, problem } = resolveLocale(opts.locale ?? siteLocale)
  const { catalogue, problems } = makeT(locale, opts.wording || {})
  const all = problem ? [problem, ...problems] : [...problems]

  const hud = opts.hud || {}
  const requested = hud.surfaces ?? "flat"
  let surfaces: Surfaces = "flat"
  if (isSurfaces(requested)) surfaces = requested
  else all.push(`hud.surfaces "${requested}" is not one of ${SURFACES.join(", ")}; using "flat"`)

  const accessTitle = opts.accessTitle ?? catalogue["access.title"]
  const graphInput = (opts.graphInput ?? "static/okf-graph.json").replace(/^\/+/, "")
  return {
    config: {
      graphUrl: "/" + graphInput,
      title: opts.title ?? accessTitle,
      accessTitle,
      typeColors: opts.typeColors ?? {},
      typeLabels: opts.typeLabels ?? {},
      edgeColors: opts.edgeColors ?? {},
      knowledgeTypes: opts.knowledgeTypes ?? [],
      typeOrder: opts.typeOrder ?? null,
      layout: opts.layout ?? null,
      radius: opts.radius ?? null,
      tooltip: opts.tooltip ?? null,
      backTo: opts.backTo ?? null,
      modes: opts.modes ?? [],
      locale,
      wording: catalogue,
      hud: { surfaces, tokens: hud.tokens ?? {} },
    },
    problems: all,
  }
}
