const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

function splitInline(value) {
  const values = []
  let current = ""
  let quote = null
  let escaped = false
  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
    } else if (char === "\\") {
      current += char
      escaped = true
    } else if (quote) {
      current += char
      if (char === quote) quote = null
    } else if (char === "'" || char === '"') {
      quote = char
      current += char
    } else if (char === ",") {
      values.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  if (current.trim() || value.endsWith(",")) values.push(current.trim())
  return values
}

function parseScalar(raw) {
  const value = raw.trim()
  if (value === "") return ""
  if (value === "null" || value === "~") return null
  if (value === "true") return true
  if (value === "false") return false
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim()
    return inner ? splitInline(inner).map(parseScalar) : []
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const result = {}
    const inner = value.slice(1, -1).trim()
    for (const item of inner ? splitInline(inner) : []) {
      const separator = item.indexOf(":")
      if (separator < 1) throw new Error(`invalid inline mapping item: ${item}`)
      result[item.slice(0, separator).trim()] = parseScalar(item.slice(separator + 1))
    }
    return result
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    if (value[0] === '"') return JSON.parse(value)
    return value.slice(1, -1).replaceAll("''", "'")
  }
  return value
}

export function parseYamlSubset(source) {
  const result = {}
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  let activeSequence = null
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue
    const sequence = raw.match(/^\s+-\s+(.+)$/)
    if (sequence && activeSequence) {
      result[activeSequence].push(parseScalar(sequence[1]))
      continue
    }
    if (/^\s/.test(raw)) {
      throw new Error(`unsupported nested YAML at line ${index + 1}`)
    }
    const entry = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/)
    if (!entry) throw new Error(`invalid YAML at line ${index + 1}`)
    const [, key, value = ""] = entry
    if (Object.hasOwn(result, key)) throw new Error(`duplicate key "${key}"`)
    if (value === "") {
      const next = lines.slice(index + 1).find((line) => line.trim() !== "")
      if (next?.match(/^\s+-\s+/)) {
        result[key] = []
        activeSequence = key
      } else {
        result[key] = ""
        activeSequence = null
      }
    } else {
      result[key] = parseScalar(value)
      activeSequence = null
    }
  }
  return result
}

export function parseFrontmatter(source) {
  const match = source.match(FRONTMATTER_RE)
  if (!match) {
    return { data: null, body: source, raw: null, error: new Error("missing frontmatter") }
  }
  try {
    const body = source.slice(match[0].length).replace(/^\r?\n/, "")
    return {
      data: parseYamlSubset(match[1]),
      body,
      raw: match[1],
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      body: source.slice(match[0].length).replace(/^\r?\n/, ""),
      raw: match[1],
      error,
    }
  }
}

function quote(value) {
  if (typeof value === "string") {
    if (
      value !== "" &&
      !/^(?:true|false|null|~|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/.test(value) &&
      !/[:#[\]{},&*!|>'"%@`]/.test(value) &&
      value.trim() === value
    ) {
      return value
    }
    return JSON.stringify(value)
  }
  if (value === null) return "null"
  if (typeof value === "boolean" || typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(quote).join(", ")}]`
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, item]) => `${key}: ${quote(item)}`)
      .join(", ")}}`
  }
  return JSON.stringify(String(value))
}

export function stringifyFrontmatter(data) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${quote(value)}`)
    .join("\n")
}

export function withFrontmatter(source, additions, fallback = {}) {
  const parsed = parseFrontmatter(source)
  const data = parsed.data ? { ...parsed.data, ...additions } : { ...fallback, ...additions }
  const body = parsed.data ? parsed.body : source
  return `---\n${stringifyFrontmatter(data)}\n---\n\n${body.replace(/^\s+/, "")}`
}
