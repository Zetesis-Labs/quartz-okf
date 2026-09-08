import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = fs.readFileSync(
  new URL("../src/components/scripts/blast-radius.inline.ts", import.meta.url),
  "utf8",
)

async function renderGraph(
  nodes: { slug: string; title: string; type: string; url?: string }[],
  edges: { source: string; target: string; label: string }[],
  pathname: string,
): Promise<string> {
  const listeners = new Map<string, () => void>()
  const container = {
    innerHTML: "",
    style: { display: "" },
    getAttribute: () => "{}",
  }
  const document = {
    documentElement: { getAttribute: () => "light" },
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    querySelector: (selector: string) => (selector === ".okf-blast" ? container : null),
    createElement: () => {
      let value = ""
      return {
        set textContent(text: string) {
          value = String(text)
        },
        get innerHTML() {
          return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        },
      }
    },
  }

  vm.runInNewContext(source, {
    console,
    document,
    location: { pathname },
    fetch: async () => ({ ok: true, json: async () => ({ nodes, edges, propertyGroups: [] }) }),
  })
  listeners.get("render")?.()
  await new Promise((resolve) => setImmediate(resolve))
  return container.innerHTML
}

async function renderWith(neighbours: number): Promise<string> {
  const nodes = [
    { slug: "catalog", title: "Catalog", type: "report" },
    ...Array.from({ length: neighbours }, (_, index) => ({
      slug: `catalog#row-${index + 1}`,
      title: `Row ${index + 1}`,
      type: "component",
    })),
  ]
  const edges = nodes.slice(1).map((node) => ({
    source: "catalog",
    target: node.slug,
    label: "Contains",
  }))
  return renderGraph(nodes, edges, "/catalog")
}

test("a relation group folds only when it has more than eight visible neighbours", async () => {
  const eight = await renderWith(8)
  const nine = await renderWith(9)

  assert.doesNotMatch(eight, /Contains \(8\)/)
  assert.match(nine, /<details class="okf-blast-rel okf-blast-fold">/)
  assert.match(nine, /Contains \(9\)/)
})

test("a materialized page finds its symbolic row by the node URL", async () => {
  const html = await renderGraph(
    [
      { slug: "catalog#ap012", title: "Digital Identity", type: "component", url: "/details/digital-identity" },
      { slug: "decision", title: "Identity first", type: "decision" },
    ],
    [{ source: "catalog#ap012", target: "decision", label: "About" }],
    "/details/digital-identity",
  )

  assert.match(html, /Identity first/)
  assert.match(html, /About/)
})
