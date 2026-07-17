#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

async function walk(directory) {
  const results = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) results.push(...(await walk(absolute)))
    else results.push(absolute)
  }
  return results
}

export async function finalizeSite(directory) {
  const publicDirectory = path.resolve(directory)
  const rawDirectory = path.join(publicDirectory, "raw")
  let updated = 0
  for (const htmlPath of (await walk(publicDirectory)).filter((file) => file.endsWith(".html"))) {
    const relative = path.relative(publicDirectory, htmlPath).replaceAll("\\", "/")
    const slug =
      relative === "index.html"
        ? "index"
        : relative.replace(/\.html$/, "").replace(/\/index$/, "")
    const rawPath = path.join(rawDirectory, `${slug}.md`)
    try {
      await fs.access(rawPath)
    } catch {
      continue
    }
    const html = await fs.readFile(htmlPath, "utf8")
    if (html.includes('rel="alternate" type="text/markdown"')) continue
    const link = `<link rel="alternate" type="text/markdown" href="/raw/${slug}.md">`
    await fs.writeFile(htmlPath, html.replace("</head>", `${link}</head>`))
    updated += 1
  }
  return updated
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const updated = await finalizeSite(process.argv[2] ?? "public")
  console.log(`[okf] alternate markdown links injected into ${updated} HTML page(s)`)
}
