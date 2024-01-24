import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import path from "node:path";
import {unified} from "unified";
import rehypeParse from "rehype-parse";
import rehypeFormat from "rehype-format";
import rehypeStringify from "rehype-stringify";
import {selectAll} from "hast-util-select";

/**
 * Returns the sha256sum of the given file.
 * @param {string} pathToFile
 */
async function shasum(pathToFile) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(pathToFile)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

/**
 * Renames each locally referenced CSS file with a 7 character short hash of its
 * contents. This renders it permanently cachable, as any changes to its content
 * will result in a different hash causing it to be re-downloaded.
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
function cacheBustCss({
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
        break;
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

/**
 * Applies HTML formatting and cache-busts the CSS of a given HTML file.
 * @param {string} pathToFile
 * @param {string} fileContents
 */
export async function processDocument({
  inputFile,
  outputDir
}) {
  const assets = new Map();

  const vFile = await unified()
    .use(rehypeParse, {
      fragment: false
    })
    .use(cacheBustCss, {
      pathToFile: inputFile.name,
      outputDir,
      assets
    })
    .use(rehypeFormat, {
      indentInitial: false,
    })
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
      characterReferences: {
        useNamedReferences: true
      }
    })
    .process(inputFile.text);

  return {
    vFile,
    assets
  };
}
