// The anchor of a row must equal the one Quartz derives for `[[note#Heading]]`, which it
// takes from `github-slugger`; core has no runtime dependencies, so the algorithm lives
// here and `anchor.test.ts` pins it to that package's verified output.
const DROPPED = /[^\p{L}\p{N}\p{M}\-_ ]/gu

export function anchorSlug(value: string): string {
  return String(value).trim().toLowerCase().replace(DROPPED, "").replaceAll(" ", "-")
}
