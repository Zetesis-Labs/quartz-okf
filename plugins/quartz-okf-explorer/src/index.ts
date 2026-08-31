import fs from "node:fs/promises"
import path from "node:path"
import type { ExplorerHud, ExplorerMode, ExplorerOptions, ExplorerScale } from "../../lib/types.ts"
// @ts-expect-error - the tsup loader turns the inline script into a bundled string
import redirect from "./redirect.inline.ts"

// The options are declared once, in the contract; they are re-exported here so the
// plugin's public surface does not move.
export type { ExplorerHud, ExplorerMode, ExplorerOptions, ExplorerScale }
export { OkfExplorer } from "./components/index.ts"

interface EmitContext {
  argv: { output: string }
}

/**
 * Since 004 the explorer is the `OkfExplorer` component; what remains to emit is the
 * address of the old standalone page, which now forwards `graph` and `focus` to the
 * in-page explorer so published links keep working.
 */
export const OkfExplorerRedirect = (userOpts?: ExplorerOptions) => {
  const output = userOpts?.output ?? "static/explorer.html"
  return {
    name: "OkfExplorerRedirect",
    async emit(ctx: EmitContext): Promise<string[]> {
      const page = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Graph explorer</title>
<meta http-equiv="refresh" content="1; url=/?explorer">
<script>${redirect}</script>
</head><body><p><a href="/?explorer">Graph explorer</a></p></body></html>
`
      const file = path.join(ctx.argv.output, output)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, page)
      return [file]
    },
  }
}

OkfExplorerRedirect.quartzCategory = "emitter"

export default OkfExplorerRedirect
