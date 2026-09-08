export interface NotePage<T> {
  page: T
  url: string
  refresh: string | null
}

function redirectTarget(content: string, base: string): URL {
  const match = /^\s*0(?:\.0+)?\s*;\s*url\s*=\s*(.+?)\s*$/i.exec(content)
  if (!match) throw new Error(`Unsupported note redirect at ${base}`)
  const value = match[1].replace(/^(["'])(.*)\1$/, "$2")
  const target = new URL(value, base)
  const source = new URL(base)
  if (!/^https?:$/.test(target.protocol) || target.origin !== source.origin || target.username || target.password) {
    throw new Error(`Unsupported note redirect from ${base} to ${target.origin}`)
  }
  return target
}

export async function resolveNotePage<T>(url: string, read: (url: string) => Promise<NotePage<T>>): Promise<{ page: T; fragment: string }> {
  let request = new URL(url)
  const requestedFragment = request.hash.slice(1)
  let fragment = requestedFragment
  const visited = new Set<string>()
  for (let hops = 0; ; hops++) {
    request.hash = ""
    if (visited.has(request.href)) throw new Error(`Note redirect loop at ${request.href}`)
    visited.add(request.href)
    const result = await read(request.href)
    if (!result.refresh) return { page: result.page, fragment }
    if (hops === 5) throw new Error(`Too many note redirects from ${url}`)
    request = redirectTarget(result.refresh, result.url)
    if (!requestedFragment && request.hash) fragment = request.hash.slice(1)
  }
}
