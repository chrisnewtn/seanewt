import path from "node:path";
import {selectAll} from "hast-util-select";
import {shasum} from "../util.js";

/**
 * Renames each locally referenced CSS file with a 7 character short hash of its
 * contents. This renders it permanently cachable, as any changes to its content
 * will result in a different hash causing it to be re-downloaded.
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
export default function hashCss({
  pathToFile,
  outputDir,
  assets
}) {
  const pathToDir = path.dirname(pathToFile);

  return async tree => {
    for (const el of selectAll("link[rel=stylesheet]", tree)) {
      const href = el.properties.href;

      if (href.startsWith("http")) {
        // It's an external asset. Ignore it.
        continue;
      }

      const [pathPart, searchString] = href.split("?");
      const pathToAsset = path.resolve(pathToDir, pathPart);

      const hash = await shasum(pathToAsset);

      const extname = path.extname(pathPart);
      const basename = path.basename(pathPart, extname);

      const newName = `${basename}-${hash.substring(0, 7)}${extname}`;

      assets.set(path.join(outputDir, newName), pathToAsset);

      el.properties.href = `${newName}${searchString ? `?${searchString}` : ''}`;
    }
  };
}
