import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import style from "./styles/blast-radius.scss";
// @ts-expect-error - inline script imported as string by esbuild loader
import script from "./scripts/blast-radius.inline.ts";

export default (() => {
  const BlastRadius: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return <div class={["okf-blast", displayClass].filter(Boolean).join(" ")}></div>;
  };
  BlastRadius.css = style;
  BlastRadius.afterDOMLoaded = script;
  return BlastRadius;
}) satisfies QuartzComponentConstructor;
