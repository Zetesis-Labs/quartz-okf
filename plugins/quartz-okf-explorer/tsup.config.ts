import { defineConfig } from "tsup"
import fs from "node:fs/promises"
import path from "node:path"

// Dos builds: el emitter para Node y el shell del explorador para el navegador (un IIFE que
// el emitter incrusta en explorer.html). tsup los compila en paralelo, así que ninguno
// limpia `dist`: lo hace el script `prepare` antes de arrancar.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    tsconfig: "tsconfig.build.json",
    sourcemap: false,
    clean: false,
    target: "es2022",
    splitting: false,
    outDir: "dist",
    platform: "node",
    async onSuccess() {
      const from = path.resolve("src/assets")
      const to = path.resolve("dist/assets")
      await fs.mkdir(to, { recursive: true })
      for (const f of await fs.readdir(from)) {
        await fs.copyFile(path.join(from, f), path.join(to, f))
      }
      console.log("[quartz-okf-explorer] assets copiados a dist/assets")
    },
  },
  {
    entry: { "assets/hud": "src/hud/main.js" },
    format: ["iife"],
    platform: "browser",
    target: "es2022",
    sourcemap: false,
    clean: false,
    splitting: false,
    minify: false,
    outDir: "dist",
    outExtension: () => ({ js: ".js" }),
  },
])
