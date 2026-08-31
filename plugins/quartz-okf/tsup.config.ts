import { defineConfig } from "tsup"

// The contract (`../../lib`, a symlink to core/lib in this tree and a copy in every
// consumer's cache) is bundled in: Quartz loads plain JavaScript from dist.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  sourcemap: false,
  clean: true,
  target: "es2022",
  splitting: false,
  outDir: "dist",
  platform: "node",
})
