/**
 * Every word the panel puts on screen. Until now they were written in English inside the
 * client script and three consumers rewrote that source at build time; a string that moved
 * by one character sent the panel back to English without a word from anyone.
 */

export const KEYS = ["panel.title", "panel.relations", "panel.referenced", "panel.knowledge", "panel.properties"] as const

export type PanelKey = (typeof KEYS)[number]
export type PanelWording = Record<PanelKey, string>

const en: PanelWording = {
  "panel.title": "Blast radius",
  "panel.relations": "Relations",
  "panel.referenced": "Referenced by",
  "panel.knowledge": "Related knowledge",
  "panel.properties": "Properties",
}

const es: PanelWording = {
  "panel.title": "Radio de impacto",
  "panel.relations": "Relaciones",
  "panel.referenced": "Referenciado por",
  "panel.knowledge": "Conocimiento relacionado",
  "panel.properties": "Propiedades",
}

export const CATALOGUES: Record<string, PanelWording> = { en, es }

export interface ResolvedLocale {
  locale: string
  problem: string | null
}

/** The site's `locale` is a tag (`es-ES`); a catalogue answers to its language. */
export function resolveLocale(requested: string | undefined, available: string[] = Object.keys(CATALOGUES)): ResolvedLocale {
  const language = String(requested || "")
    .toLowerCase()
    .split(/[-_]/)[0]
  if (available.includes(language)) return { locale: language, problem: null }
  return {
    locale: "en",
    problem: requested ? `locale "${requested}" has no wording catalogue; using "en"` : null,
  }
}

export interface Wording {
  wording: PanelWording
  problems: string[]
}

/** The catalogue for a locale with the consumer's overrides on top; unknown keys are named. */
export function panelWording(locale: string, overrides: Record<string, string> = {}): Wording {
  const base = CATALOGUES[locale] ?? CATALOGUES.en
  const wording = { ...base }
  const problems: string[] = []
  for (const [key, text] of Object.entries(overrides)) {
    if ((KEYS as readonly string[]).includes(key)) wording[key as PanelKey] = text
    else problems.push(`wording key "${key}" is not a panel key`)
  }
  return { wording, problems }
}
