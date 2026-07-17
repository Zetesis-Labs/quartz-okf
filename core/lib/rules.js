import path from "node:path"
import { DEFAULT_RULE_LEVELS, PROFILE } from "../profile.js"
import { parseTopologyEdges } from "./topology.js"
import { buildResolver } from "./resolver.js"

function violation(rule, message, configuredLevels, detail = {}) {
  const level = configuredLevels[rule] ?? DEFAULT_RULE_LEVELS[rule] ?? "off"
  if (level === "off") return null
  return { level, rule, message, ...detail }
}

export function isReserved(filePath) {
  const name = path.posix.basename(String(filePath).replaceAll("\\", "/"))
  return name === "index.md" || name === "log.md"
}

export function validateDocument(document, options = {}) {
  const profile = options.profile ?? PROFILE
  const levels = { ...profile.ruleLevels, ...(options.ruleLevels ?? {}) }
  const violations = []
  const add = (entry) => entry && violations.push(entry)
  const relativePath = String(document.path).replaceAll("\\", "/")
  const basename = path.posix.basename(relativePath, ".md")
  const directory = path.posix.basename(path.posix.dirname(relativePath))
  const reserved = document.reserved ?? isReserved(relativePath)

  if (document.parseError) {
    add(
      violation(
        "core/frontmatter-parse",
        document.parseError.message,
        levels,
      ),
    )
    return { ...document, reserved, edges: [], violations }
  }

  if (reserved) {
    if (
      path.posix.basename(relativePath) === "index.md" &&
      relativePath !== "index.md" &&
      document.frontmatter
    ) {
      add(
        violation(
          "core/index-frontmatter",
          "frontmatter is only permitted in the bundle-root index.md",
          levels,
        ),
      )
    }
    if (path.posix.basename(relativePath) === "log.md") {
      if (document.frontmatter) {
        add(violation("core/log-frontmatter", "log.md must not have frontmatter", levels))
      }
      for (const match of document.body.matchAll(/^##\s+(.+)$/gm)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(match[1].trim())) {
          add(
            violation(
              "core/log-date",
              `log date heading must be YYYY-MM-DD, got "${match[1].trim()}"`,
              levels,
            ),
          )
        }
      }
    }
    return { ...document, reserved, edges: [], violations }
  }

  const frontmatter = document.frontmatter ?? {}
  if (typeof frontmatter.type !== "string" || frontmatter.type.trim() === "") {
    add(violation("core/type-required", "concept must have a non-empty type", levels))
  } else if (!profile.types.includes(frontmatter.type)) {
    add(
      violation(
        "profile/type-closed",
        `unknown type "${frontmatter.type}"; allowed: ${profile.types.join(", ")}`,
        levels,
      ),
    )
  }
  if (basename === directory && directory) {
    const aliases = Array.isArray(frontmatter.aliases)
      ? frontmatter.aliases.map(String)
      : frontmatter.aliases
        ? [String(frontmatter.aliases)]
        : []
    if (!aliases.includes(basename)) {
      add(
        violation(
          "profile/folder-note-alias",
          `folder note must declare aliases: [${basename}]`,
          levels,
        ),
      )
    }
  }
  if (!frontmatter.title) {
    add(violation("hygiene/title-recommended", "title is recommended", levels))
  }
  if (!frontmatter.description) {
    add(violation("hygiene/description-recommended", "description is recommended", levels))
  }
  if (
    frontmatter.tags !== undefined &&
    (!Array.isArray(frontmatter.tags) ||
      frontmatter.tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(tag))))
  ) {
    add(
      violation(
        "hygiene/tags-shape",
        "tags must be a YAML list of lowercase kebab-case strings",
        levels,
      ),
    )
  }
  const edges = parseTopologyEdges(document.body, profile.topologyHeading)
  for (const edge of edges) {
    if (!profile.edgeLabels.includes(edge.label)) {
      add(
        violation(
          "profile/edge-label-closed",
          `unknown edge label "${edge.label}"; allowed: ${profile.edgeLabels.join(", ")}`,
          levels,
          { edge },
        ),
      )
    }
  }
  return { ...document, reserved, edges, violations }
}

export function validateDocuments(documents, options = {}) {
  const profile = options.profile ?? PROFILE
  const levels = { ...profile.ruleLevels, ...(options.ruleLevels ?? {}) }
  const validated = documents.map((document) => validateDocument(document, options))
  const unresolvedLevel =
    levels["hygiene/unresolved-edge"] ??
    DEFAULT_RULE_LEVELS["hygiene/unresolved-edge"] ??
    "off"
  if (unresolvedLevel !== "off") {
    const resolve = buildResolver(validated)
    for (const document of validated) {
      for (const edge of document.edges ?? []) {
        if (!resolve(edge.target)) {
          document.violations.push({
            level: unresolvedLevel,
            rule: "hygiene/unresolved-edge",
            message: `unresolved topology target "${edge.target}"`,
            edge,
          })
        }
      }
    }
  }
  return validated
}
