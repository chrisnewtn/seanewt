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
 * Appends the sha256sum of all each local CSS file to their `href` property
 * using a query parameter.
 * @type {import('unified').Plugin<[], import('hast').Root>}
 */
function cacheBustCss({pathToFile}) {
  const pathToDir = path.dirname(pathToFile);

  return async tree => {
    for (const el of selectAll("link[rel=stylesheet]", tree)) {
      const href = el.properties.href;

      if (href.startsWith("http:")) {
        break;
      }

      const [pathPart, searchString] = href.split("?");

      const hash = await shasum(path.resolve(pathToDir, pathPart));

      const searchParams = new URLSearchParams(searchString);
      searchParams.set("sha256", hash);

      el.properties.href = `${pathPart}?${searchParams}`;
    }
  };
}

/**
 * Applies HTML formatting and cache-busts the CSS of a given HTML file.
 * @param {string} pathToFile
 * @param {string} fileContents
 */
export async function processDocument(pathToFile, fileContents) {
  return await unified()
    .use(rehypeParse, {
      fragment: false
    })
    .use(cacheBustCss, {pathToFile})
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
    .process(fileContents);
}
