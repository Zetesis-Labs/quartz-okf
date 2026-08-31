import { dockOpen } from "../../../lib/dock.ts"
import { useHud } from "../context.ts"

/** A short confirmation ("Link copied"), bottom right, gone by itself. */
export function Toast() {
  const { state } = useHud()
  const msg = state.toast.value
  if (!msg) return null
  const shifted = dockOpen(state.dock.value)
  return (
    <div
      id="toast"
      class={`okf-island tw:absolute tw:bottom-3 tw:z-70 tw:rounded-full tw:px-3 tw:py-1.5 tw:text-[0.8rem] ${shifted ? "tw:right-[calc(var(--dock-w)+1.6rem)]" : "tw:right-3"}`}
      role="status"
    >
      {msg}
    </div>
  )
}
