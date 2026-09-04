import assert from "node:assert/strict"
import test from "node:test"
import { validateAnnotations, validateDocument, validateDocuments } from "../lib/rules.ts"
import { PROFILE } from "../lib/reference-profile.ts"

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

const CATALOG_NOTE = `---
type: report
title: Catalogue
---

# Topology

* **Part of**: [[standards]]

# Entries

<!-- okf:rows type=component id=Code label=Name -->

| Code | Name |
|---|---|
| AC001 | Student Recruitment |
| AC002 | Agent Management |
`

test("a catalog note carries its rows and their edges after validation", () => {
  const document = validateDocument({
    id: "standards/arm",
    path: "standards/arm.md",
    source: CATALOG_NOTE,
    body: CATALOG_NOTE,
    frontmatter: { type: "report", title: "Catalogue", description: "d" },
    parseError: null,
    reserved: false,
  })
  assert.deepEqual(
    document.rows?.map((row) => row.slug),
    ["standards/arm#ac001", "standards/arm#ac002"],
  )
  assert.deepEqual(document.rows?.[0].edges, [{ label: "Part of", target: "standards/arm" }])
  assert.deepEqual(document.violations, [])
})

test("catalog problems become violations at the profile's levels", () => {
  const body = "<!-- okf:rows type=component id=Missing -->\n\n| Code |\n|---|\n| AC001 |\n"
  const document = validateDocument({
    id: "standards/arm",
    path: "standards/arm.md",
    source: body,
    body,
    frontmatter: { type: "report", title: "t", description: "d" },
    parseError: null,
    reserved: false,
  })
  const violation = document.violations.find((item) => item.rule === "catalog/column-unknown")
  assert.equal(violation?.level, "error")
  assert.match(violation?.message ?? "", /table 1/)
  assert.equal(document.rows?.length, 0)
})

test("a row type outside the profile and an unknown row edge are profile violations", () => {
  const body = [
    "<!-- okf:rows type=nonesuch id=Code edge=Invents -->",
    "",
    "| Code |",
    "|---|",
    "| AC001 |",
  ].join("\n")
  const document = validateDocument({
    id: "standards/arm",
    path: "standards/arm.md",
    source: body,
    body,
    frontmatter: { type: "report", title: "t", description: "d" },
    parseError: null,
    reserved: false,
  })
  const rules = document.violations.map((item) => item.rule)
  assert.ok(rules.includes("profile/type-closed"))
  assert.ok(rules.includes("profile/edge-label-closed"))
})

test("frontmatter defaults reach the note's tables", () => {
  const body = "<!-- okf:rows -->\n\n| Code | Name |\n|---|---|\n| AC001 | Student Recruitment |\n"
  const document = validateDocument({
    id: "standards/arm",
    path: "standards/arm.md",
    source: body,
    body,
    frontmatter: {
      type: "report",
      title: "t",
      description: "d",
      okf_rows: { type: "component", id: "Code", label: "Name" },
    },
    parseError: null,
    reserved: false,
  })
  assert.deepEqual(document.violations, [])
  assert.equal(document.rows?.[0].title, "AC001 — Student Recruitment")
})

test("a row cannot take the suffixed anchor of a duplicate heading", () => {
  const body = "# Alpha\n\n# Alpha\n\n<!-- okf:rows type=component id=Code -->\n\n| Code |\n|---|\n| alpha-1 |\n"
  const document = validateDocument({
    id: "standards/arm",
    path: "standards/arm.md",
    source: body,
    body,
    frontmatter: { type: "report", title: "t", description: "d" },
    parseError: null,
    reserved: false,
  })
  assert.ok(document.violations.some((violation) => violation.rule === "catalog/anchor-collision"))
  assert.equal(document.rows?.length, 0)
})

const annotated = (id: string, annotations: unknown[]) => ({
  id,
  path: `${id}.md`,
  source: "",
  body: "",
  frontmatter: { type: "report", title: id, description: "d" },
  parseError: null,
  reserved: false,
  edges: [],
  violations: [],
  annotations,
})

test("an annotation that reaches no node, and two that disagree, are reported", () => {
  const catalogue = {
    id: "standards/arm",
    path: "standards/arm.md",
    source: "",
    body: "",
    frontmatter: { type: "report", title: "Catalogue", description: "d" },
    parseError: null,
    reserved: false,
    edges: [],
    violations: [],
    rows: [
      {
        id: "AC001",
        anchor: "ac001",
        slug: "standards/arm#ac001",
        type: "concept",
        title: "AC001",
        label: "AC001",
        edges: [],
        table: 1,
      },
    ],
  }
  const problems = validateAnnotations([
    catalogue,
    annotated("analysis/gap", [
      { ref: "AC001", edge: "About", properties: { state: "core" }, table: 1, row: 1 },
      { ref: "AC404", edge: "About", properties: { state: "core" }, table: 1, row: 2 },
    ]),
    annotated("analysis/other", [{ ref: "AC001", edge: "About", properties: { state: "integrate" }, table: 1, row: 3 }]),
  ])
  assert.deepEqual(
    problems.map((problem) => [problem.path, problem.violation.rule]),
    [
      ["analysis/gap.md", "catalog/ref-unresolved"],
      ["analysis/other.md", "catalog/property-conflict"],
    ],
  )
  assert.match(problems[0].violation.message, /table 1, row 2/)
  assert.match(problems[1].violation.message, /table 1, row 3/)
  assert.match(problems[1].violation.message, /state/)
})
