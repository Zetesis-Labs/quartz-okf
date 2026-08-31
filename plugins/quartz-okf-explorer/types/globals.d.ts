// What Quartz's SPA router exposes to inline scripts (quartz/components/scripts/spa.inline.ts).
declare global {
  interface Window {
    addCleanup(fn: () => void): void
    spaNavigate?(url: URL, isBack?: boolean): Promise<void>
  }
  interface DocumentEventMap {
    nav: CustomEvent<{ url: string }>
    prenav: CustomEvent<undefined>
    themechange: CustomEvent<{ theme: "light" | "dark" }>
  }
}

export {}
