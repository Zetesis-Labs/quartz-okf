import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { loadConsumerConfig } from "../lib/consumer-config.js"

const overlay = {
  propertyGroups: [
    {
      id: "service-runtime",
      appliesTo: ["service"],
      rule: "hygiene/service-tier-recommended",
      fields: [
        {
          source: "service_tier",
          required: true,
          graphPath: ["runtime", "tier"],
        },
      ],
    },
  ],
  ruleLevels: { "hygiene/service-tier-recommended": "warn" },
}

test("loads a consumer profile overlay without losing reference defaults", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-consumer-config-"))
  await fs.writeFile(
    path.join(root, "okf.config.mjs"),
    `export const branding = { site: "Consumer" }\nexport const profile = ${JSON.stringify(overlay)}\n`,
  )

  const consumer = await loadConsumerConfig(root)
  assert.equal(consumer.branding.site, "Consumer")
  assert.equal(consumer.profile.types.includes("service"), true)
  assert.deepEqual(consumer.profile.propertyGroups, overlay.propertyGroups)
  assert.equal(
    consumer.profile.ruleLevels["hygiene/service-tier-recommended"],
    "warn",
  )
})

test("loads the profile serialized into an exported bundle", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-exported-profile-"))
  await fs.writeFile(
    path.join(root, "okf-profile.json"),
    `${JSON.stringify(overlay, null, 2)}\n`,
  )

  const consumer = await loadConsumerConfig(root)
  assert.deepEqual(consumer.profile.propertyGroups, overlay.propertyGroups)
})

test("rejects a corrupt serialized profile instead of silently using defaults", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-corrupt-profile-"))
  await fs.writeFile(path.join(root, "okf-profile.json"), "{not-json}\n")

  await assert.rejects(loadConsumerConfig(root), SyntaxError)
})
