import { defineConfig } from "tsup"
import fs from "node:fs/promises"
import path from "node:path"

// Este plugin no tiene componentes preact: solo el emitter y dos assets estáticos que
// se copian tal cual, porque el emitter los lee en tiempo de build del sitio.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  sourcemap: false,
  clean: true,
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
})
