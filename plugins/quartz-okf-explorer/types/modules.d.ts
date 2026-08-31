// Ambient modules: what the tsup loaders turn into strings, and the slice of Quartz's component
// contract this plugin uses. `@quartz-community/types` ships from GitHub without a built
// `dist`, so its own declarations cannot be resolved; this file stands in when they cannot.
declare module "*.css" {
  const content: string
  export default content
}

declare module "*.inline.ts" {
  const content: string
  export default content
}

declare module "@quartz-community/types" {
  export interface GlobalConfiguration {
    pageTitle?: string
    locale?: string
    baseUrl?: string
    enableSPA?: boolean
    [key: string]: unknown
  }

  export type QuartzComponentProps = {
    cfg: GlobalConfiguration
    displayClass?: "mobile-only" | "desktop-only"
    fileData: Record<string, unknown>
    allFiles: Record<string, unknown>[]
    [key: string]: unknown
  }

  export type QuartzComponent = ((props: QuartzComponentProps) => unknown) & {
    css?: string | string[] | undefined
    beforeDOMLoaded?: string | string[] | undefined
    afterDOMLoaded?: string | string[] | undefined
  }

  export type QuartzComponentConstructor<Options extends object | undefined = undefined> = (opts?: Options) => QuartzComponent
}
