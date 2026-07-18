import assert from "node:assert/strict"
import test from "node:test"
import { validateDocument, validateDocuments } from "../lib/rules.js"
import { PROFILE } from "../profile.js"

test("separates core, profile, and hygiene violations", () => {
  const result = validateDocument({
    id: "apps/apps",
    path: "apps/apps.md",
    body: "# Topology\n\n* **Invented**: [[target]]\n",
    frontmatter: { type: "invented", tags: "Not A List" },
    parseError: null,
  })
  assert.deepEqual(
    result.violations.map(({ rule, level }) => [rule, level]),
    [
      ["profile/type-closed", "error"],
      ["profile/folder-note-alias", "error"],
      ["hygiene/title-recommended", "warn"],
      ["hygiene/description-recommended", "warn"],
      ["hygiene/tags-shape", "warn"],
      ["profile/edge-label-closed", "warn"],
    ],
  )
})

test("permits root index metadata but rejects it in nested indexes", () => {
  const root = validateDocument({
    id: "index",
    path: "index.md",
    body: "# Root\n",
    frontmatter: { okf_version: "0.1" },
    parseError: null,
  })
  const nested = validateDocument({
    id: "nested/index",
    path: "nested/index.md",
    body: "# Nested\n",
    frontmatter: { type: "concept" },
    parseError: null,
  })
  assert.equal(root.violations.length, 0)
  assert.equal(nested.violations[0].rule, "core/index-frontmatter")
})

test("can opt into unresolved-edge diagnostics without changing core conformance", () => {
  const documents = validateDocuments(
    [
      {
        id: "service",
        path: "service.md",
        body: "# Topology\n\n* **Uses**: [[pending]]\n",
        frontmatter: { type: "service", title: "Service", description: "Test." },
        parseError: null,
      },
    ],
    { ruleLevels: { "hygiene/unresolved-edge": "warn" } },
  )
  assert.equal(
    documents[0].violations.some((violation) => violation.rule === "hygiene/unresolved-edge"),
    true,
  )
})

test("executes property groups without domain-specific core logic", () => {
  const profile = {
    ...PROFILE,
    propertyGroups: [
      {
        id: "service-runtime",
        label: "service runtime",
        appliesTo: ["service"],
        rule: "hygiene/service-tier-recommended",
        fields: [
          {
            source: "service_tier",
            required: true,
            type: "string",
            enum: ["edge", "core"],
            graphPath: ["runtime", "tier"],
          },
        ],
      },
    ],
    ruleLevels: {
      ...PROFILE.ruleLevels,
      "hygiene/service-tier-recommended": "warn",
    },
  }
  const documents = [
    {
      id: "valid-service",
      path: "valid-service.md",
      body: "# Purpose\n",
      frontmatter: {
        type: "service",
        title: "Valid service",
        description: "Test.",
        service_tier: "edge",
      },
      parseError: null,
    },
    {
      id: "service",
      path: "service.md",
      body: "# Purpose\n",
      frontmatter: {
        type: "service",
        title: "Service",
        description: "Test.",
        service_tier: "batch",
      },
      parseError: null,
    },
    {
      id: "node",
      path: "node.md",
      body: "# Purpose\n",
      frontmatter: { type: "node", title: "Node", description: "Test." },
      parseError: null,
    },
  ].map((document) => validateDocument(document, { profile }))

  assert.match(
    documents[1].violations.find((v) => v.rule === "hygiene/service-tier-recommended")
      .message,
    /use service_tier from: edge, core/,
  )
  assert.equal(documents[0].violations.length, 0)
  assert.equal(documents[2].violations.length, 0)
})

test("nudges isolated knowledge notes but not linked templates or structural notes", () => {
  const documents = validateDocuments([
    {
      id: "docs/decisions/choice",
      path: "docs/decisions/choice.md",
      body: "# Context\n",
      frontmatter: { type: "decision", title: "Choice", description: "Test." },
      parseError: null,
    },
    {
      id: "services/template/template",
      path: "services/template/template.md",
      body: "# Purpose\n",
      frontmatter: {
        type: "concept",
        title: "Template",
        description: "Test.",
        aliases: ["template"],
      },
      parseError: null,
    },
    {
      id: "host",
      path: "host.md",
      body: "# Topology\n\n* **Uses**: [[template]]\n",
      frontmatter: {
        type: "node",
        title: "Host",
        description: "Test.",
        node_kind: "physical",
        os_family: "linux",
      },
      parseError: null,
    },
    {
      id: "service",
      path: "service.md",
      body: "# Purpose\n",
      frontmatter: { type: "service", title: "Service", description: "Test." },
      parseError: null,
    },
  ])
  const flagged = documents
    .filter((document) =>
      document.violations.some((v) => v.rule === "hygiene/knowledge-edges-recommended"),
    )
    .map((document) => document.id)
  assert.deepEqual(flagged, ["docs/decisions/choice"])
})

test("flags manually declared inverse pairs on both endpoints", () => {
  const documents = validateDocuments([
    {
      id: "host",
      path: "host.md",
      body: "# Topology\n\n* **Uses**: [[tool]]\n",
      frontmatter: {
        type: "node",
        title: "Host",
        description: "Test.",
        node_kind: "physical",
        os_family: "linux",
      },
      parseError: null,
    },
    {
      id: "tool",
      path: "tool.md",
      body: "# Topology\n\n* **Consumed by**: [[host]]\n",
      frontmatter: { type: "technology", title: "Tool", description: "Test." },
      parseError: null,
    },
  ])
  for (const document of documents) {
    assert.equal(
      document.violations.filter((v) => v.rule === "hygiene/redundant-inverse").length,
      1,
      document.id,
    )
  }
})
