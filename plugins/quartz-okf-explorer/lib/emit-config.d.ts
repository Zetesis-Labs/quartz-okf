export interface ExplorerEmitConfig {
  graphUrl: string
  title: string
  accessTitle: string
  locale: string
  wording: Record<string, string>
  hud: { surfaces: "flat" | "glass"; tokens: Record<string, string> }
  [key: string]: unknown
}

export function explorerConfig(
  opts: Record<string, unknown>,
  siteLocale?: string,
): { config: ExplorerEmitConfig; problems: string[] }
