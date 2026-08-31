import { defineConfig } from "tsup"
import type { Plugin } from "esbuild"
import path from "node:path"

// The component ships two kinds of code: the SSR module Quartz imports at build time
// (Preact stays external, Quartz has it) and the browser script `afterDOMLoaded` carries
// as a string — bundled here, in the plugin, with its own Preact, signals and d3 modules.
const inlineScriptPlugin: Plugin = {
  name: "inline-script-loader",
  setup(parentBuild) {
    const absWorkingDir = parentBuild.initialOptions.absWorkingDir ?? process.cwd()

    // Tailwind v4 compiles the component's stylesheet with only the utilities the TSX uses.
    // The full import is the one that honours `prefix(tw)`, but it also brings preflight and
    // wraps everything in cascade layers: preflight would restyle the whole Quartz page and
    // layered rules lose to Quartz's unlayered ones, so both are undone here.
    // tsup's own CSS loader claims every path ending in `.css`, whatever the namespace: the
    // stylesheet is resolved under a suffix of its own so it reaches this loader instead.
    parentBuild.onResolve({ filter: /\.css$/ }, (args) => ({ path: `${path.resolve(args.resolveDir, args.path)}.okf`, namespace: "okf-css" }))
    parentBuild.onLoad({ filter: /\.okf$/, namespace: "okf-css" }, async (args) => {
      const { default: postcss } = await import("postcss")
      const { default: tailwind } = await import("@tailwindcss/postcss")
      const fs = await import("node:fs")
      const file = args.path.replace(/\.okf$/, "")
      const source = await fs.promises.readFile(file, "utf8")
      const result = await postcss([tailwind()]).process(source, { from: file })
      const root = result.root
      root.walkAtRules("layer", (rule) => {
        if (!rule.nodes) {
          rule.remove()
          return
        }
        if (rule.params === "base") rule.remove()
        else rule.replaceWith(...rule.nodes)
      })
      const css = root.toString()
      console.log(`[quartz-okf-explorer] stylesheet ${path.relative(absWorkingDir, file)}: ${(css.length / 1024).toFixed(1)} KB`)
      return { contents: css, loader: "text" }
    })

    parentBuild.onLoad({ filter: /\.inline\.ts$/ }, async (args) => {
      const esbuild = await import("esbuild")
      const fs = await import("node:fs")
      let text = await fs.promises.readFile(args.path, "utf8")
      text = text.replace(/^export default /gm, "")
      text = text.replace(/^export /gm, "")

      const resolveDir = path.dirname(args.path)
      const sourcefile = path.relative(absWorkingDir, args.path)

      const result = await esbuild.build({
        stdin: { contents: text, loader: "ts", resolveDir, sourcefile },
        write: false,
        bundle: true,
        minify: true,
        platform: "browser",
        format: "esm",
        target: "es2020",
        sourcemap: false,
        jsx: "automatic",
        jsxImportSource: "preact",
        external: ["http://*", "https://*"],
      })

      const js = result.outputFiles?.[0]?.text
      if (!js) throw new Error(`inline-script-loader: no JS output for ${args.path}`)
      console.log(`[quartz-okf-explorer] inline script ${sourcefile}: ${(js.length / 1024).toFixed(1)} KB`)
      return { contents: js, loader: "text" }
    })
  },
}

const SINGLETON_EXTERNALS = ["preact", "preact/hooks", "preact/jsx-runtime", "preact/compat", "@jackyzha0/quartz", "@jackyzha0/quartz/*"]

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "components/index": "src/components/index.ts",
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  sourcemap: false,
  clean: false,
  treeshake: true,
  target: "es2022",
  splitting: false,
  noExternal: [/.*/],
  external: SINGLETON_EXTERNALS,
  outDir: "dist",
  platform: "node",
  esbuildOptions(options) {
    options.jsx = "automatic"
    options.jsxImportSource = "preact"
  },
  esbuildPlugins: [inlineScriptPlugin],
})
