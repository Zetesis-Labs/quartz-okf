import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import { panelWording, resolveLocale } from "../../lib/i18n.ts";
import style from "./styles/blast-radius.scss";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/blast-radius.inline.ts";

export interface PanelsOptions {
  /** Overrides the site's own `locale`; `es` and `en` have catalogues. */
  locale?: string;
  /** Per-key overrides of the panel's wording; an unknown key is a build warning. */
  wording?: Record<string, string>;
}

export default ((opts?: PanelsOptions) => {
  let warned = false;

  const BlastRadius: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const { locale, problem } = resolveLocale(opts?.locale ?? cfg.locale);
    const { wording, problems } = panelWording(locale, opts?.wording);
    if (!warned) {
      warned = true;
      for (const message of [problem, ...problems].filter(Boolean)) {
        console.warn(`[quartz-okf-panels] warning: ${message}`);
      }
    }
    // The words travel with the panel: the client script carries none of its own, so a
    // consumer translates it by declaring a locale instead of patching this plugin.
    return (
      <div
        class={["okf-blast", displayClass].filter(Boolean).join(" ")}
        data-okf-panels={JSON.stringify(wording)}
      ></div>
    );
  };
  BlastRadius.css = style;
  BlastRadius.afterDOMLoaded = script;
  return BlastRadius;
}) satisfies QuartzComponentConstructor;
