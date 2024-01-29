import {unified} from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import hashCss from './src/unified-plugins/hashCss.js';
import hashImages from './src/unified-plugins/hashImages.js';

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
    .use(hashCss, {
      pathToFile: inputFile.name,
      outputDir,
      assets
    })
    .use(hashImages, {
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
