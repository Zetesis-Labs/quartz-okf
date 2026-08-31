import { createContext } from "preact"
import { useContext } from "preact/hooks"
import type { ExplorerEmitConfig, Translator } from "../../lib/types.ts"
import type { Actions } from "./actions.ts"
import type { Engine } from "./canvas/engine.ts"
import type { Controller } from "./controller.ts"
import type { HudState } from "./state.ts"

/** Everything a HUD component may reach: the state it renders from and the actions it triggers. */
export interface HudApi {
  cfg: ExplorerEmitConfig
  t: Translator
  state: HudState
  ctl: Controller
  engine: Engine
  actions: Actions
}

export const HudContext = createContext<HudApi | null>(null)

export function useHud(): HudApi {
  const api = useContext(HudContext)
  if (!api) throw new Error("quartz-okf-explorer: HUD components must render inside HudContext")
  return api
}
